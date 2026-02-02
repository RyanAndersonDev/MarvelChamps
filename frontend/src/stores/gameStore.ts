import { defineStore } from "pinia";
import { type Ally, type Event, type Upgrade, type Support, type IdentityCardInstance, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme, type PlayerCardInstance } 
    from '../types/card'
import { GamePhase, type GamePhaseType } from "../types/phases";
import { createHandCard, createMainSchemeCard, createTableauCard, createVillainCard, createVillainIdentityCard, createEngagedMinion, createSideScheme, createIdentityCard } from "../cards/cardFactory";
import { EffectLibrary } from "../engine/effectLibrary";

export const useGameStore = defineStore('game', {
  state: () => ({
    // Game phase info
    currentPhase: GamePhase.PLAYER_TURN as GamePhaseType,
    encounterResolveSignal: null as (() => void) | null,

    // Identification
    idIncrementer: 0,
    
    // Villain Side
    villainCard: null as VillainIdentityCardInstance | null,
    mainScheme: null as MainSchemeInstance | null,
    villainDeckIds: [] as number[],
    villainDiscardIds: [] as number[],
    activeSideSchemes: [] as SideScheme[],
    engagedMinions: [] as Minion[],
    
    // Encounter Logic
    encounterPileIds: [] as number[],
    revealedEncounterCard: null as (Treachery | Attachment | Minion | SideScheme) | null,

    // Player Side
    playerIdentity: null as IdentityCardInstance | null,
    idCardHasFlippedThisTurn: false,
    hand: [] as (Ally | Event | Upgrade | Support)[],
    deckIds: [] as number[],
    playerDiscardIds: [] as number[],
    tableauCards: [] as (Ally | Upgrade | Support)[],

    // Assets
    playerCardBackImg: "/cards/misc/player-card-back.png",
    villainCardBackImg: "/cards/misc/villain-card-back.png",

    // Timing Windows
    activePrompt: null as {
        type: "INTERRUPT_WINDOW" | "DEFENSE_CHOICE",
        event: string,
        payload: any,
        cards: any[],
        resolve: (value: string) => void 
    } | null,

    eventStack: [] as { name: string, payload: any, timing: 'PRE' | 'POST' }[],

    // Targeting
    targeting: {
      isActive: false,
      sourceCard: null,
      targetType: 'minion',
      resolve: null,
    } as any,

    activeCardId: null as number | null,
    paymentBufferIds: [] as number[],

    isTargeting: false,
    targetType: null as string | null,
    resolveTargetPromise: null as ((id: number) => void) | null
  }),

  // ****************************** GETTERS ******************************
  getters: {
    hero(state): IdentityCardInstance {
        if (!state.playerIdentity) {
            throw new Error("Attempted to access Player Identity before it was initialized.");
        }

        return state.playerIdentity;
    },

    activeCard(state): any {
        return state.hand.find(c => c.instanceId === state.activeCardId);
    },

    committedResources(state): Record<string, number> {
        const counts: Record<string, number> = { physical: 0, mental: 0, energy: 0, wild: 0 };
        
        state.paymentBufferIds.forEach(id => {
            const card = state.hand.find(c => c.instanceId === id);

            card?.resources?.forEach((r: string) => {
                counts[r]!++;
            });
        });
        return counts;
    },

    isCostMet(): boolean {
        if (!this.activeCard) return false;
        
        const totalSpent = Object.values(this.committedResources).reduce((a, b) => a + b, 0);
        return totalSpent >= (this.activeCard.cost || 0);
    },

    canAnyoneDefend(): boolean {
        const heroCanDefend = !this.hero.exhausted;
        const alliesCanDefend = this.tableauCards.some(c => c.type === 'ally' && !c.exhausted);
        
        return heroCanDefend || alliesCanDefend;
    }
  },

  actions: {
    // ****************************** Game Phase Actions ******************************
    initializeGame() {
        let initIdCounter = 0;

        this.playerIdentity = createIdentityCard(1, ++initIdCounter);
        this.deckIds = [1, 2, 2, 3, 3, 4, 4, 4, 5, 6, 6, 7, 7, 8, 8];
        this.shufflePile(this.deckIds);
        this.villainCard = createVillainIdentityCard(1, ++initIdCounter);
        this.mainScheme = createMainSchemeCard(1, ++initIdCounter);
        this.villainDeckIds = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        this.shufflePile(this.villainDeckIds);

        this.drawToHandSize();
        this.idIncrementer = initIdCounter;
    },

    async advanceGame() {
        if (this.currentPhase === GamePhase.PLAYER_TURN) {
            this.readyAllCards();
            this.drawToHandSize();

            this.currentPhase = GamePhase.VILLAIN_STEP_1_THREAT;
            await this.processMainSchemeStepOne();

            this.currentPhase = GamePhase.VILLAIN_STEP_2_ACTIVATION;
            await this.processVillainActivation();

            this.currentPhase = GamePhase.VILLAIN_STEP_3_MINIONS;
            await this.processMinionActivations();

            this.currentPhase = GamePhase.VILLAIN_STEP_4_DEAL;
            await this.dealEncounterCards();

            this.currentPhase = GamePhase.VILLAIN_STEP_5_REVEAL;
            while (this.encounterPileIds.length > 0 || this.revealedEncounterCard !== null) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            this.currentPhase = GamePhase.PLAYER_TURN;
            this.idCardHasFlippedThisTurn = false;
        }
    },

    async processMainSchemeStepOne() {
        const amount = this.mainScheme!.threatIncrementIsPerPlayer
            ? this.mainScheme!.threatIncrement * 1 // TODO: Multiply by player count
            : this.mainScheme!.threatIncrement;

        const threatPayload = {
            amount,
            source: 'step_one',
            isCanceled: false
        };

        await this.applyThreatToMainScheme(threatPayload);
    },

    async processVillainActivation() {
        if (this.hero.identityStatus === "alter-ego") {
            const initialPayload = {
                attacker: this.villainCard?.name || 'Villain',
                baseThreat: this.villainCard?.sch || 0,
                boostThreat: 0,
                isCanceled: false
            };

            await this.villainActivationScheme(initialPayload);
        }
        else {
            const initialPayload = {
                attacker: this.villainCard?.name || 'Villain',
                baseDamage: this.villainCard?.atk || 0,
                boostDamage: 0,
                isDefended: false,
                targetType: 'identity',
                targetId: 'hero',
                isCanceled: false
            };

            await this.villainActivationAttack(initialPayload);
        }
    },

    async villainActivationScheme(payload: any) {
        await this.emitEvent('VILLAIN_SCHEME', payload, async () => {
            if (payload.isCanceled) return;

            //payload.boostThreat = await this.flipBoostCard(); TODO: BOOST CARD IMPLEMENTATION
            const total = payload.baseThreat + payload.boostThreat;

            const threatPayload = {
                amount: total,
                source: 'villain_scheme',
                isCanceled: false
            };

            await this.applyThreatToMainScheme(threatPayload);

            await this.emitEvent('VILLAIN_SCHEME_CONCLUDED', payload, async () => {});
        });
    },

    async applyThreatToMainScheme(threatPayload: any) {
        await this.emitEvent('MAIN_SCHEME_THREAT', threatPayload, async () => {
            if (threatPayload.isCanceled) 
                return;

            this.mainScheme!.currentThreat += threatPayload.amount;

            await this.emitEvent('THREAT_PLACED', threatPayload, async () => {
                if (this.mainScheme!.currentThreat >= this.mainScheme!.threatThreshold) {
                    // handle victory
                }
            });
        });
    },

    async villainActivationAttack(attackPayload: any) {
        await this.emitEvent('VILLAIN_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled) return;

            if (this.canAnyoneDefend) {
                await this.handleDefenseStep(attackPayload);
            }

            let reduction = 0;
            if (attackPayload.isDefended && attackPayload.targetType === 'identity') {
                reduction = this.hero.def || 0;
            }

            const finalDamage = Math.max(0, attackPayload.baseDamage - reduction);

            if (attackPayload.targetType === 'identity') {
                if (finalDamage > 0) {
                    const damagePayload = { 
                        amount: finalDamage,
                        isCanceled: false,
                        targetId: this.hero.instanceId 
                    };

                    await this.emitEvent('takeIdentityDamage', damagePayload, async () => {
                        
                        if (damagePayload.isCanceled || damagePayload.amount <= 0) {
                            console.log("Backflip worked! Stopping damage application.");
                            return;
                        }

                        await this.applyDamageToEntity(damagePayload);
                    });
                }
            }
            else if (attackPayload.targetType === 'ally') {
                const damagePayload = { 
                    amount: finalDamage, 
                    isCanceled: false,
                    targetId: attackPayload.targetId 
                };

                await this.emitEvent('takeAllyDamage', damagePayload, async () => {
                    if (damagePayload.isCanceled || damagePayload.amount <= 0) {
                        console.log("Ally damage was prevented.");
                        return;
                    }
                    
                    await this.applyDamageToEntity(damagePayload);
                });
            }
            
            await this.emitEvent('VILLAIN_ATTACK_CONCLUDED', attackPayload, async () => {});
        });
    },

    async processMinionActivations() {
        for (const minion of this.engagedMinions) {
            if (this.hero.identityStatus === "alter-ego") {
                await this.minionActivationScheme(minion);
            } else {
                await this.minionActivationAttack(minion);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    },

    async minionActivationScheme(minion: Minion) {
        const schemePayload = {
            attacker: minion.name,
            attackerId: minion.instanceId,
            baseThreat: minion.sch,
            isCanceled: false
        };

        await this.emitEvent('MINION_SCHEME', schemePayload, async () => {
            if (schemePayload.isCanceled) return;

            const threatPayload = {
                amount: schemePayload.baseThreat,
                source: 'minion_scheme',
                isCanceled: false
            };

            await this.applyThreatToMainScheme(threatPayload);
            
            await this.emitEvent('MINION_SCHEME_CONCLUDED', schemePayload, async () => {});
        });
    },

    async minionActivationAttack(minion: Minion) {
        const attackPayload = {
            attacker: minion.name,
            attackerId: minion.instanceId,
            baseDamage: minion.atk,
            isDefended: false,
            targetType: 'identity',
            targetId: 'hero',
            isCanceled: false
        };

        await this.emitEvent('MINION_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled) return;

            if (this.canAnyoneDefend) {
                await this.handleDefenseStep(attackPayload);
            }

            let reduction = 0;
            if (attackPayload.isDefended && attackPayload.targetType === 'identity') {
                reduction = this.hero.def || 0;
            }

            const finalDamage = Math.max(0, attackPayload.baseDamage - reduction);

            if (finalDamage > 0) {
                const damagePayload = { amount: finalDamage, isCanceled: false };
                
                await this.emitEvent('takeIdentityDamage', damagePayload, async () => {
                    this.hero.hitPointsRemaining! -= damagePayload.amount;
                });
            }
        });
    },

    async dealEncounterCards() {
        const payload = {
            count: 1,
            isCanceled: false
        };

        await this.emitEvent('DEAL_ENCOUNTER_CARDS', payload, async () => {
            if (payload.isCanceled) 
                return;

            for (let i = 0; i < payload.count; i++) {
                const cardId = this.villainDeckIds.pop();

                if (cardId) {
                    this.encounterPileIds.push(cardId);
                    console.log(`Dealt 1 encounter card to the player.`);
                } else {
                    // Logic for deck running out (Acceleration tokens)
                    // TODO await this.handleEmptyVillainDeck();
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
    },

    async readyAllCards() {
        this.hero.exhausted = false;
        this.tableauCards.forEach((card) => {
            card.exhausted = false;
        })
    },

    async drawToHandSize() {
        const currentHandSize = this.hero.identityStatus! === "alter-ego"
            ? this.hero.handsizeAe
            : this.hero.handSizeHero

        while (this.hand.length < currentHandSize) {
            this.drawCardFromDeck();
        }
    },

    // ****************************** STATE ******************************

    getNextId() {
        return ++this.idIncrementer;
    },

    // ****************************** PLAYER CARDS ******************************

    drawCardFromDeck() {
        if (this.deckIds.length === 0) {
            this.shuffleDiscardPileIntoDrawPile();
        }

        const id = this.deckIds.shift()!;
        this.hand.push(createHandCard(id, this.getNextId()));
    },

    makeTableauCardFromHand(cardId: number) {
        this.tableauCards.push(createTableauCard(cardId, this.getNextId()));
    },

    discardPlayerCardsFromHand(instanceIds: number[]) {
        instanceIds.forEach(instId => {
            const index = this.hand.findIndex(c => c.instanceId === instId);
            
            if (index !== -1) {
                const card = this.hand[index];
                this.playerDiscardIds.push(card!.storageId!);
                this.hand.splice(index, 1);
            }
        });
    },

    destroyHandCard(cardId: number) {
        this.hand = this.hand.filter(c => c.instanceId !== cardId);
    },

    shuffleDiscardPileIntoDrawPile() {
        this.deckIds.push(...this.playerDiscardIds);
        this.playerDiscardIds = [];

        this.shufflePile(this.deckIds);
    },

    // ****************************** VILLAIN CARDS ******************************

    discardVillainCards(cardIds: number[]) {
        this.villainDiscardIds.push(...cardIds);
    },

    drawEncounterCardFromPlayerPile() {
        if (this.encounterPileIds.length === 0) 
            return;

        const id = this.encounterPileIds.shift()!;
        this.revealedEncounterCard = createVillainCard(id, this.getNextId());
    },

    async resolveCurrentEncounterCard(currentInstanceId: number) {
        if (currentInstanceId !== this.revealedEncounterCard?.instanceId) return;

        const card = this.revealedEncounterCard;
        const payload = { card, isCanceled: false };

        await this.emitEvent('REVEAL_ENCOUNTER_CARD', payload, async () => {
            if (payload.isCanceled) return;

            switch (card.type) {
                case 'treachery':
                    await this.handleTreacheryResolution(card);
                    break;

                case 'minion':
                    await this.handleMinionEntry(card);
                    break;

                case 'side-scheme':
                    await this.handleSideSchemeEntry(card);
                    break;

                case 'attachment':
                    await this.handleAttachmentEntry(card);
                    break;
            }
        });

        this.revealedEncounterCard = null;
    },

    async handleTreacheryResolution(card: any) {
        const treacheryPayload = { 
            card, 
            isCanceled: false 
        };

        await this.emitEvent('TREACHERY_REVEALED', treacheryPayload, async () => {
            
            if (treacheryPayload.isCanceled) {
                console.log(`${card.name} was canceled!`);
                return; 
            }

            console.log(`Executing Treachery: ${card.name}`);
            
            const effect = EffectLibrary[card.storageId];

            if (effect) {
                await effect(this, treacheryPayload); 
            }
        });

        this.villainDiscardIds.push(card.storageId);
    },

    async handleMinionEntry(card: any) {
        const minion = createEngagedMinion(card.storageId, this.getNextId());
        this.engagedMinions.push(minion);

        await this.emitEvent('MINION_ENTERED_PLAY', { minion }, async () => {});
    },

    async handleSideSchemeEntry(card: any) {
        const sideScheme = createSideScheme(card.storageId, this.getNextId());
        const payload = { sideScheme, isCanceled: false };

        await this.emitEvent('SIDE_SCHEME_ENTERING', payload, async () => {
            if (payload.isCanceled) return;

            this.activeSideSchemes.push(sideScheme);
            console.log(`Side Scheme ${card.name} entered with ${sideScheme.threatRemaining} threat.`);

            await this.emitEvent('SIDE_SCHEME_ENTERED', payload, async () => {});
        });
    },

    async handleAttachmentEntry(card: any) {
        const attachment = createVillainCard(card.storageId, this.getNextId());
        const payload = { attachment, target: this.villainCard, isCanceled: false };

        await this.emitEvent('ATTACHMENT_ENTERING', payload, async () => {
            if (payload.isCanceled) return;

            if (this.villainCard) {
                this.villainCard.attachments.push(attachment);
                console.log(`Attached ${card.name} to ${this.villainCard.name}.`);
            }

            await this.emitEvent('ATTACHMENT_ENTERED', payload, async () => {});
        });
    },

    drawFromVillainDeckAsEncounterCard() {
        if (this.villainDeckIds.length > 0) {
            this.encounterPileIds.push(this.villainDeckIds.shift()!);
        }
    },

    async discardFromEngagedMinions(instanceIdToDc: number) {
        const minion = this.engagedMinions.find(m => m.instanceId === instanceIdToDc);

        if (!minion) {
            console.log(`Could not find minion with id ${instanceIdToDc} to discard.`);
            return;
        }

        await this.emitEvent('MINION_DEFEATED', { minion }, async () => {
            if (minion.attachments && minion.attachments.length > 0) {
                minion.attachments.forEach((card) => {
                    const dest = card.type === 'upgrade' ? this.playerDiscardIds : this.villainDiscardIds;
                    dest.push(card.instanceId!);
                });
            }

            this.villainDiscardIds.push(minion.storageId!);
            this.engagedMinions = this.engagedMinions.filter(m => m.instanceId !== instanceIdToDc);
            
            console.log(`${minion.name} has been removed from the board.`);
        });
    },

    discardSideScheme(instanceIdToDc: number) {
        const sideScheme = this.activeSideSchemes.find(s => s.instanceId === instanceIdToDc);

        if (!sideScheme) {
            console.log(`Could not find side scheme with id ${instanceIdToDc} to discard.`);
            return;
        }

        // TODO: add logic to handle discarding attachments

        this.villainDiscardIds.push(sideScheme.storageId!)
        this.activeSideSchemes = this.activeSideSchemes.filter(s => s.instanceId !== instanceIdToDc);
    },

    findEnemyById(id: number) {
        if (this.villainCard && this.villainCard.instanceId === id) {
            return this.villainCard;
        }

        return this.engagedMinions.find(m => m.instanceId === id);
    },

    // ****************************** GENERAL UTILS ******************************

    shufflePile(pile: number[]) {
        for (let i = pile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            
            const temp = pile[i]!; 
            pile[i] = pile[j]!;
            pile[j] = temp;
        }
    },

    attachToTarget(attachment: Upgrade, targetId: number) {
        const targetMinion = this.engagedMinions.find(m => m.instanceId === targetId);
        const targetVillain = this.villainCard?.instanceId === targetId ? this.villainCard : null;

        const finalTarget = targetMinion || targetVillain;

        if (finalTarget) {
            if (!finalTarget.attachments) {
                finalTarget.attachments = [];
            }
            finalTarget.attachments.push(attachment);
            console.log(`Attached ${attachment.name} to target ${targetId}`);
        } else {
            console.error(`Target with ID ${targetId} not found anywhere on board!`);
        }
    },

    // ****************************** IDENTITY UTILS ******************************

    triggerIdentityCardAbility() {
        // TODO: Implement ability trigger 
        console.log(`Doing ${this.hero.name}'s ability.`)
    },

    toggleIdentityExhaust() {
        this.hero.exhausted = !this.hero.exhausted;
    },

    flipIdentity() {
        this.hero.identityStatus === "hero" 
            ? this.hero.identityStatus = "alter-ego"
            : this.hero.identityStatus = "hero"

        this.idCardHasFlippedThisTurn = !this.idCardHasFlippedThisTurn;
    },

    healIdentity() {
        if (!this.hero.hitPointsRemaining) {
            console.log("HP remaining was not set.");
            return;
        }

        if (this.hero.hitPointsRemaining >= this.hero.hitPoints) {
            return;
        }

        const amtToAdjustBy = 0; // TODO: Check tableau for healing upgrades

        this.hero.hitPointsRemaining! 
            += (this.hero.healing + (amtToAdjustBy || 0));

        if (this.hero.hitPointsRemaining! > this.hero.hitPoints) {
            this.hero.hitPointsRemaining! = this.hero.hitPoints;
        }

        this.toggleIdentityExhaust();
    },

    thwartWithIdentity(id: number) {
        if (this.hero.exhausted) 
            return;

        if (this.hero.identityStatus === 'alter-ego') {
            console.warn("You cannot thwart in Alter-Ego form!");
            return;
        }

        const thwAmt = this.hero.thw;
        console.log(`Thwarting for ${thwAmt}!`);

        if (this.mainScheme!.instanceId === id) {
            this.mainScheme!.currentThreat = Math.max(0, this.mainScheme!.currentThreat - thwAmt);
        } else {
            const sideScheme = this.activeSideSchemes.find(ss => ss.instanceId === id);

            if (sideScheme) {
                sideScheme.threatRemaining = Math.max(0, sideScheme.threatRemaining - thwAmt);
                
                if (sideScheme.threatRemaining === 0) {
                    this.discardSideScheme(id);
                }
            }
        }

        this.toggleIdentityExhaust();
    },

    attackWithIdentity(id: number) {
        if (this.hero.exhausted) 
            return;

        if (this.hero.identityStatus === 'alter-ego') {
            console.warn("You cannot attack in Alter-Ego form!");
            return;
        }

        const atkAmt = this.hero.atk;
        console.log(`Attacking for ${this.hero.atk}!`);

        if (this.villainCard!.instanceId === id) {
            this.villainCard!.hitPointsRemaining = Math.max(0, this.villainCard!.hitPointsRemaining! - atkAmt);
        } else {
            const minion = this.engagedMinions.find(m => m.instanceId === id);

            if (minion) {
                minion.hitPointsRemaining = Math.max(0, minion.hitPointsRemaining! - atkAmt);

                if (minion.hitPointsRemaining === 0) {
                    this.discardFromEngagedMinions(minion.instanceId);
                }
            }
        }
        this.toggleIdentityExhaust();
    },

    defend() {
        // TODO: Implement defense
        console.log(`Defending for ${this.hero.def}!`)
        this.toggleIdentityExhaust();
    },

    // ****************************** CARD PAYMENT ******************************

    startPayment(cardId: number) {
        const card = this.hand.find(c => c.instanceId === cardId);
        if (!card) return;

        this.activeCardId = cardId;

        if (card.cost === 0) {
            this.finalizePlay();
        }
    },

    addResourceToPayment(instanceId: number) {
        if (this.activeCardId === instanceId) return; 

        if (!this.paymentBufferIds.includes(instanceId)) {
            this.paymentBufferIds.push(instanceId);
        }

        if (this.isCostMet) {
            this.finalizePlay();
        }
    },

    async finalizePlay() {
        const card = { ...this.activeCard } as (Upgrade | Event | Ally | Support);
        if (!card) 
            return;

        this.discardPlayerCardsFromHand(this.paymentBufferIds);

        if (card.type === "event") {
            await this.executeCardEffect(card as any);
            this.discardPlayerCardsFromHand([card.instanceId!]);
        } 
        else if (card.type === "upgrade" && card.attachmentLocation !== "tableau") {
            try {
                const targetId = await this.requestTarget(card, card.attachmentLocation!);
                this.attachToTarget(card as any, targetId);
                this.destroyHandCard(card.instanceId!);
            } catch (error) {
                console.warn("Play cancelled during targeting.");
                return;
            }
        } 
        else {
            this.makeTableauCardFromHand(card.storageId!);
            this.destroyHandCard(card.instanceId!);
        }

        if (card.logic?.timing === "afterPlay") {
            await this.executeCardEffect(card as any);
        }

        this.resetPayment();
    },

    resetPayment() {
        this.activeCardId = null;
        this.paymentBufferIds = [];
    },

    canAfford(card: any): boolean {
        if (card.cost === 0) 
            return true;

        if (!card.cost) 
            return true;

        // TODO: Make more nuanced resource checking in hand
        const cardsInHand = this.hand.length - 1;
        const totalAvailable = cardsInHand; // TODO: + boardResources
        return totalAvailable >= card.cost;
    },

    // ****************************** TIMING WINDOWS ******************************
    async emitEvent(eventName: string, payload: Record<string, any>, actionFn: () => Promise<void> | void) {
        await this.checkTriggers('interrupt', eventName, payload);
        await actionFn();
        await this.checkTriggers('response', eventName, payload);
    },

    async checkTriggers(timing: string, eventName: string, payload: any) {
        const boardTriggers: any[] = [];

        this.collectIdentityTriggers(timing, eventName, boardTriggers);
        this.collectTableauTriggers(timing, eventName, boardTriggers);
        this.collectEnemyTriggers(timing, eventName, boardTriggers);
        this.collectSchemeTriggers(timing, eventName, boardTriggers);

        for (const card of boardTriggers.filter(c => c.logic.isForced)) {
            const effect = EffectLibrary[card.logic.effectName];
            if (effect) {
                await effect(this, {
                    ...payload,
                    sourceCard: card,
                    effectValue: card.logic.value
                });
            }
        }

        let windowActive = true;
        while (windowActive) {
            if (payload.isCanceled || payload.isResolved) {
                windowActive = false;
                break;
            }

            const optionalBoard = boardTriggers.filter(c => !c.logic.isForced && !c.isExhausted);
            const handCards = this.hand.filter(card => 
                this.isValidTrigger(card, timing, eventName) && this.canAfford(card)
            );
            
            const allOptions = [...optionalBoard, ...handCards];

            if (allOptions.length > 0) {
                const result = await this.requestPlayerInterrupt(eventName, payload, allOptions);

                if (result === 'passed') {
                    windowActive = false; 
                }
            } else {
                windowActive = false;
            }
        }
    },

    collectIdentityTriggers(timing: string, event: string, list: any[]) {
        const hero = this.playerIdentity;

        if (this.isValidTrigger(hero, timing, event)) {
            list.push(hero);
        }
    },

    collectTableauTriggers(timing: string, event: string, list: any[]) {
        this.tableauCards.forEach(card => {
            if (this.isValidTrigger(card, timing, event)) {
                list.push(card);
            }
        });
    },

    collectEnemyTriggers(timing: string, event: string, list: any[]) {
        if (this.isValidTrigger(this.villainCard, timing, event)) {
            list.push(this.villainCard);
        }

        this.engagedMinions.forEach(minion => {
            if (this.isValidTrigger(minion, timing, event)) {
                list.push(minion);
            }
            
            minion.attachments?.forEach(att => {
                if (this.isValidTrigger(att, timing, event)) {
                    list.push(att);
                }
            });
        });
    },

    collectSchemeTriggers(timing: string, event: string, list: any[]) {
        if (this.isValidTrigger(this.mainScheme, timing, event)) {
            list.push(this.mainScheme);
        }
        this.activeSideSchemes.forEach(ss => {
            if (this.isValidTrigger(ss, timing, event)) {
                list.push(ss);
            }
        });
    },

    async collectHandTriggers(timing: string, event: string, payload: any) {
        const playableCards = this.hand.filter(card => 
            this.isValidTrigger(card, timing, event) && this.canAfford(card)
        );

        if (playableCards.length > 0) {
            await this.requestPlayerInterrupt(event, payload, playableCards);
        }
    },

    isValidTrigger(card: any, timing: string, event: string): boolean {
        const l = card?.logic;

        if (!l) 
            return false;

        const matchesTiming = (l.timing === timing || l.type === timing);
        const matchesEvent = (l.trigger === event || l.timing === event);
        const matchesForm = !l.formRequired || l.formRequired === this.hero.identityStatus;

        return matchesTiming && matchesEvent && matchesForm;
    },

    async handleDefenseStep(payload: any) {
        const defenders = [];

        if (!this.hero.exhausted) {
            defenders.push({ id: 'hero', name: `Hero (${this.hero.def} DEF)` });
        }

        this.tableauCards.filter(c => c.type === 'ally' && !c.exhausted).forEach(ally => {
            defenders.push({ id: ally.instanceId, name: ally.name });
        });

        if (defenders.length === 0) 
            return;

        const choice = await this.requestChoice("Who will defend this attack?", [
            ...defenders,
            { id: 'none', name: "No one (Take it undefended)" }
        ]);

        if (choice.id === 'hero') {
            payload.isDefended = true;
            this.hero.exhausted = true;
        } else if (choice.id !== 'none') {
            payload.isDefended = true;
            payload.targetType = 'ally';
            payload.targetId = choice.id;
            
            const ally = this.tableauCards.find(c => c.instanceId === choice.id);
            if (ally) ally.exhausted = true;
        }
    },

    async requestChoice(title: string, options: any[]) {
        return new Promise<any>((resolve) => {
            this.activePrompt = {
                type: "CHOICE_WINDOW",
                event: title,
                cards: options,
                resolve: (value: string) => {
                    const choice = options.find(o => o.id === value);
                    this.activePrompt = null;
                    resolve(choice || { id: 'none' });
                }
            } as any;
        });
    },

    async applyDamageToEntity(payload: { targetId: number, amount: number }) {
        const target = this.findTargetById(payload.targetId);
        if (!target) return;

        const oldHp = target.hitPointsRemaining;
        target.hitPointsRemaining = Math.max(0, (target.hitPointsRemaining || 0) - payload.amount);
        
        console.log(`Worker: Subtracted ${payload.amount} from ${target.name}.`);
    },

    findTargetById(instanceId: number) {
        if (this.hero?.instanceId === instanceId) return this.hero;

        if (this.villainCard?.instanceId === instanceId) return this.villainCard;

        const minion = this.engagedMinions.find(m => m.instanceId === instanceId);
        if (minion) return minion;

        console.warn(`Entity with instanceId ${instanceId} not found in active zones.`);
        return null;
    },

    // --- TARGETING ACTIONS ---
    async requestTarget(sourceCard: any, type: string): Promise<number> {
        this.targeting.isActive = true;
        this.targeting.sourceCard = sourceCard;
        this.targeting.targetType = type;

        return new Promise<number>((resolve) => {
            this.targeting.resolve = resolve;
        });
    },

    selectTarget(instanceId: number) {
        if (this.targeting.resolve) {
            this.targeting.resolve(instanceId);

            this.targeting.isActive = false;
            this.targeting.sourceCard = null;
            this.targeting.targetType = null;
            this.targeting.resolve = null;
        }
    },

    async executeCardEffect(card: any) {
        const effectName = card.logic?.effectName;
        const effect = EffectLibrary[effectName];

        if (effect) {
            let targetId = null;
            if (card.logic.targetType && card.logic.targetType !== 'none') {
                targetId = await this.requestTarget(card, card.logic.targetType);
            }
            await effect(this, {
                amount: card.logic.effectValue, 
                targetId: targetId,
                sourceCard: card,
                playerForm: this.hero.identityStatus 
            });
        }
    },

    async requestPlayerInterrupt(event: string, payload: any, playableCards: any[]) {
        return new Promise<string>((resolve) => {
            this.activePrompt = {
                type: "INTERRUPT_WINDOW",
                event: event,
                payload: payload,
                cards: playableCards,
                resolve: (resolve as unknown) as (value: string) => void 
            };
        });
    },

    async selectInterruptCard(card: any) {
        if (!this.activePrompt) return;

        const isFromHand = this.hand.some(c => c.instanceId === card.instanceId);

        if (isFromHand) {
            this.discardPlayerCardsFromHand([card.instanceId])
        } else {
            card.isExhausted = true;
        }

        const effect = EffectLibrary[card.logic.effectName];
        if (effect) {
            const context = this.activePrompt.payload;
            context.sourceCard = card;
            context.effectValue = card.logic.effectValue;

            await effect(this, context);
        }

        const resolve = this.activePrompt.resolve;
        this.activePrompt = null; 
        resolve("played");
    },

    passInterrupt() {
        if (this.activePrompt) {
            const resolve = this.activePrompt.resolve;
            this.activePrompt = null;
            resolve("passed");
        }
    }
  }
});
