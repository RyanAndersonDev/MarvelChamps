import { defineStore } from "pinia";
import { type Ally, type Event, type Upgrade, type Support, type IdentityCardInstance, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme, type PlayerCardInstance, type Resource }
    from '../types/card'
import type { LogEntry, LogType } from '../types/log';
import { villainCardMap } from "../cards/cardStore";
import { GamePhase, type GamePhaseType } from "../types/phases";
import { createHandCard, createMainSchemeCard, createTableauCard, createVillainCard, createVillainIdentityCard, createEngagedMinion, createSideScheme, createIdentityCard } from "../cards/cardFactory";
import { executeEffects } from "../engine/effectLibrary";

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
    abilityUseCounts: {} as Record<string, number>,
    abilityResetOn: {} as Record<string, string>,
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
    generatedResources: [] as Resource[],

    pendingInterruptCard: null as any,
    pendingInterruptPayload: null as any,
    pendingInterruptResolve: null as ((value: string) => void) | null,

    isTargeting: false,
    targetType: null as string | null,
    resolveTargetPromise: null as ((id: number) => void) | null,

    // Game Log
    roundNumber: 1,
    logIdCounter: 0,
    gameLog: [] as LogEntry[],
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

        state.generatedResources.forEach((r: string) => {
            counts[r]!++;
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
    },

    hasGuardMinion(): boolean {
        return this.engagedMinions.some(m => m.guard);
    },

    hasCrisisScheme(): boolean {
        return this.activeSideSchemes.some(ss => ss.crisis);
    },

    isHandCardPlayable: (state) => (card: any): boolean => {
        if (!card?.logic) return false;

        // Non-events (allies, supports, upgrades) can always be played from hand during player turn.
        // formRequired only restricts their tableau ABILITY, not playing them from hand.
        if (card.type !== 'event') {
            if (state.currentPhase !== 'PLAYER_TURN') return false;
            if (card.attachmentLocation === 'minion') return state.engagedMinions.length > 0;
            if (card.attachmentLocation === 'enemy') return state.engagedMinions.length > 0 || !!state.villainCard;
            return true;
        }

        // Events: playing IS using, so form restriction applies here.
        const form = card.logic.formRequired;
        const identityStatus = state.playerIdentity?.identityStatus;
        if (form && form !== 'any' && form !== identityStatus) return false;

        // Action events are directly playable during player turn
        if (card.logic.type === 'action') return state.currentPhase === 'PLAYER_TURN';

        // Interrupt/response events only appear via the interrupt window
        return false;
    }
  },

  actions: {
    // ****************************** LOGGING ******************************
    addLog(message: string, type: LogType = 'system') {
        console.log(`[R${this.roundNumber}][${type}] ${message}`);
        this.gameLog.push({
            id: ++this.logIdCounter,
            round: this.roundNumber,
            type,
            message
        });
    },

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

        this.idIncrementer = initIdCounter;
        this.drawToHandSize();
        this.addLog('--- Round 1 ---', 'phase');
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

            this.roundNumber++;
            this.addLog(`--- Round ${this.roundNumber} ---`, 'phase');
            this.currentPhase = GamePhase.PLAYER_TURN;
            this.idCardHasFlippedThisTurn = false;
            this.resetAbilityLimits('round');
            this.resetAbilityLimits('turn');
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
        if (this.villainCard?.stunned) {
            this.addLog(`${this.villainCard.name} is stunned — activation skipped, stun removed.`, 'status');
            this.villainCard.stunned = false;
            return;
        }

        if (this.hero.identityStatus === "alter-ego") {
            if (this.villainCard?.confused) {
                this.addLog(`${this.villainCard.name} is confused — scheme skipped, confused removed.`, 'status');
                this.villainCard.confused = false;
                return;
            }

            const initialPayload = {
                attacker: this.villainCard?.name || 'Villain',
                baseThreat: this.villainCard?.sch || 0,
                boostThreat: 0,
                isCanceled: false
            };

            await this.villainActivationScheme(initialPayload);
        }
        else {
            const atkBonus = (this.villainCard?.attachments || [])
                .reduce((sum, att) => sum + ((att as Attachment).atkMod || 0), 0);

            const initialPayload = {
                attacker: this.villainCard?.name || 'Villain',
                baseDamage: (this.villainCard?.atk || 0) + atkBonus,
                boostDamage: 0,
                isDefended: false,
                targetType: 'identity',
                targetId: 'hero',
                isCanceled: false,
                overkill: (this.villainCard?.attachments || []).some(att => (att as Attachment).overkill)
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

            this.mainScheme!.threatRemaining += threatPayload.amount;

            await this.emitEvent('THREAT_PLACED', threatPayload, async () => {
                if (this.mainScheme!.threatRemaining >= this.mainScheme!.threatThreshold) {
                    // handle victory
                }
            });
        });
    },

    async villainActivationAttack(attackPayload: any) {
        // Check for player attachments that trigger when this enemy attacks (e.g. Webbed Up)
        const playerAttachments = (this.villainCard?.attachments || []).filter(a => a.side === 'player');
        for (const att of playerAttachments) {
            await this.emitEvent('attachedAttacks', {
                attachment: att,
                attacker: this.villainCard,
                sourceCard: att,
                attackPayload
            }, async () => {});
        }

        if (attackPayload.isCanceled) return;

        // Emit ENEMY_ATTACK so Spider-Sense can trigger on both villain and minion attacks
        await this.emitEvent('ENEMY_ATTACK', attackPayload, async () => {});
        if (attackPayload.isCanceled) return;

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
                            return;
                        }

                        await this.applyDamageToEntity(damagePayload);
                        attackPayload.damageWasDealt = true;
                    });
                }
            }
            else if (attackPayload.targetType === 'ally') {
                const ally = this.tableauCards.find(c => c.instanceId === attackPayload.targetId) as Ally | undefined;
                const allyHpBefore = ally?.hitPointsRemaining ?? 0;

                const damagePayload = {
                    amount: finalDamage,
                    isCanceled: false,
                    targetId: attackPayload.targetId
                };

                await this.emitEvent('takeAllyDamage', damagePayload, async () => {
                    if (damagePayload.isCanceled || damagePayload.amount <= 0) {
                        return;
                    }

                    await this.applyDamageToEntity(damagePayload);
                    attackPayload.damageWasDealt = true;
                });

                // Overkill: excess damage spills to hero
                if (attackPayload.overkill && ally) {
                    const excess = finalDamage - allyHpBefore;
                    if (excess > 0) {
                        this.addLog(`Overkill! ${excess} excess damage dealt to hero.`, 'damage');
                        await this.applyDamageToEntity({ targetId: this.hero.instanceId, amount: excess });
                    }
                }

                // Check if ally was defeated
                if (ally && ally.hitPointsRemaining <= 0) {
                    this.discardFromTableau(ally.instanceId!);
                }
            }

            await this.emitEvent('VILLAIN_ATTACK_CONCLUDED', attackPayload, async () => {});
        });
    },

    async processMinionActivations() {
        for (const minion of this.engagedMinions) {
            if (minion.stunned) {
                this.addLog(`${minion.name} is stunned — activation skipped, stun removed.`, 'status');
                minion.stunned = false;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            if (this.hero.identityStatus === "alter-ego") {
                if (minion.confused) {
                    this.addLog(`${minion.name} is confused — scheme skipped, confused removed.`, 'status');
                    minion.confused = false;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

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
            isCanceled: false,
            damageWasDealt: false
        };

        // Check for player attachments on this minion (e.g. Webbed Up)
        const playerAttachments = (minion.attachments || []).filter(a => a.side === 'player');
        for (const att of playerAttachments) {
            await this.emitEvent('attachedAttacks', {
                attachment: att,
                attacker: minion,
                sourceCard: att,
                attackPayload
            }, async () => {});
        }

        if (attackPayload.isCanceled) return;

        // Emit ENEMY_ATTACK so Spider-Sense triggers
        await this.emitEvent('ENEMY_ATTACK', attackPayload, async () => {});
        if (attackPayload.isCanceled) return;

        await this.emitEvent('MINION_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled)
                return;

            if (this.canAnyoneDefend) {
                await this.handleDefenseStep(attackPayload);
            }

            let reduction = 0;
            if (attackPayload.isDefended && attackPayload.targetType === 'identity') {
                reduction = this.hero.def || 0;
            }

            const finalDamage = Math.max(0, attackPayload.baseDamage - reduction);

            if (finalDamage > 0) {
                const damagePayload = { amount: finalDamage, isCanceled: false, targetId: this.hero.instanceId };

                await this.emitEvent('takeIdentityDamage', damagePayload, async () => {
                    if (damagePayload.isCanceled || damagePayload.amount <= 0) return;

                    await this.applyDamageToEntity(damagePayload);
                    attackPayload.damageWasDealt = true;
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
                    this.addLog(`Dealt 1 encounter card to the player.`, 'villain');
                } else {
                    // Logic for deck running out (Acceleration tokens)
                    // TODO await this.handleEmptyVillainDeck();
                }
            }

            // Hazard: each active Hazard side scheme deals one additional encounter card
            for (const scheme of this.activeSideSchemes.filter(ss => ss.hazard)) {
                const cardId = this.villainDeckIds.pop();
                if (cardId) {
                    this.encounterPileIds.push(cardId);
                    this.addLog(`${scheme.name} (Hazard) dealt an additional encounter card.`, 'villain');
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

    // ****************************** ALLY ACTIONS ******************************
    async thwartWithAlly(instanceId: number) {
        const ally = this.findTableauCardById(instanceId) as Ally;
        if (!ally || ally.exhausted)
            return;

        const targetId = await this.requestTarget(null, 'scheme');
        if (!targetId)
            return;

        const target: MainSchemeInstance | SideScheme = this.findSchemeById(targetId);
        if (!target)
            return;

        // Crisis: can't remove threat from main scheme while a crisis side scheme is active
        if (target.type === 'main-scheme' && this.hasCrisisScheme) {
            this.addLog("Cannot remove threat from main scheme while a Crisis side scheme is in play!", 'system');
            return;
        }

        const thwartContext = { source: ally, target, value: ally.thw };

        await this.emitEvent('ALLY_THWARTS', thwartContext, async () => {
            const threatEventName = target.type === "side-scheme" ? 'SIDE_SCHEME_LOSES_THREAT' : 'MAIN_SCHEME_LOSES_THREAT';
            const threatContext = { target, amount: thwartContext.value, source: ally };

            await this.emitEvent(threatEventName, threatContext, async () => {
                target.threatRemaining = Math.max(0, target.threatRemaining - threatContext.amount);
                this.addLog(`${target.name} lost ${threatContext.amount} threat.`, 'threat');
            });

            ally.exhausted = true;

            const consDamage = ally.thwPain ?? 0;
            ally.hitPointsRemaining -= consDamage;

            if (target.type === 'side-scheme' && target.threatRemaining === 0) {
                this.discardSideScheme(target.instanceId);
            }

            if (ally.hitPointsRemaining <= 0) {
                this.discardFromTableau(ally.instanceId!);
            }

            this.addLog(`${ally.name} successfully thwarted ${target.name}.`, 'play');
        });
    },

    async attackWithAlly(instanceId: number) {
        const ally = this.findTableauCardById(instanceId) as Ally;
        if (!ally || ally.exhausted)
            return;

        // Guard: must target guard minions before the villain
        const targetId = await this.requestTarget(null, 'enemy');
        if (!targetId)
            return;

        const target: VillainIdentityCardInstance | Minion = this.findEnemyById(targetId);
        if (!target)
            return;

        if (target.type === 'villain' && this.hasGuardMinion) {
            this.addLog("Cannot attack the villain while a Guard minion is engaged!", 'system');
            return;
        }

        const attackContext = { source: ally, target, damage: ally.atk };

        await this.emitEvent('ALLY_ATTACKS', attackContext, async () => {
            await this.applyDamageToEntity({ targetId: target.instanceId, amount: attackContext.damage });

            ally.exhausted = true;
            const consDamage = ally.atkPain ?? 0;
            ally.hitPointsRemaining -= consDamage;

            if (target.type === 'minion' && target.hitPointsRemaining === 0) {
                this.discardFromEngagedMinions(target.instanceId);
            }

            if (ally.hitPointsRemaining <= 0) {
                this.discardFromTableau(ally.instanceId!);
            }
        });
    },

    findTableauCardById(lookupId: number): PlayerCardInstance | undefined {
        const cardToUse = this.tableauCards.find(c => c.instanceId === lookupId);

        if (!cardToUse) {
            this.addLog(`No tableau card found with instance ID ${lookupId}`, 'system');
            return undefined;
        }

        return cardToUse;
    },

    tableauCardIsAlly(card: PlayerCardInstance | undefined): card is Ally {
        if (!card || card.type !== "ally") {
            return false;
        }

        return true;
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
        const treacheryPayload: any = {
            card,
            isCanceled: false,
            surge: false
        };

        await this.emitEvent('treacheryRevealed', treacheryPayload, async () => {
            if (treacheryPayload.isCanceled) {
                this.addLog(`${card.name} was canceled!`, 'system');
                return;
            }

            this.addLog(`Executing Treachery: ${card.name}`, 'villain');

            if (card.logic?.effects) {
                await executeEffects(card.logic.effects, this, treacheryPayload);
            }
        });

        this.villainDiscardIds.push(card.storageId);

        // Surge: reveal an additional encounter card
        if (treacheryPayload.surge) {
            this.addLog(`${card.name} surges! Drawing additional encounter card.`, 'surge');
            this.drawFromVillainDeckAsEncounterCard();
        }
    },

    async handleMinionEntry(card: any) {
        const minion = createEngagedMinion(card.storageId, this.getNextId());
        this.engagedMinions.push(minion);

        // Check for When Revealed effect on the minion
        if (minion.logic?.effects) {
            await executeEffects(minion.logic.effects, this, { minion, sourceCard: minion });
        }

        await this.emitEvent('MINION_ENTERED_PLAY', { minion }, async () => {});
    },

    async handleSideSchemeEntry(card: any) {
        const sideScheme = createSideScheme(card.storageId, this.getNextId());
        const blueprint = villainCardMap.get(card.storageId);
        const payload = { sideScheme, isCanceled: false };

        await this.emitEvent('SIDE_SCHEME_ENTERING', payload, async () => {
            if (payload.isCanceled) return;

            // When Revealed: place additional threat
            if (blueprint?.whenRevealedThreat) {
                sideScheme.threatRemaining += blueprint.whenRevealedThreat;
            }

            this.activeSideSchemes.push(sideScheme);
            this.addLog(`Side Scheme ${card.name} entered with ${sideScheme.threatRemaining} threat.`, 'villain');

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
                this.addLog(`Attached ${card.name} to ${this.villainCard.name}.`, 'villain');
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
            this.addLog(`Could not find minion with id ${instanceIdToDc} to discard.`, 'system');
            return;
        }

        await this.emitEvent('MINION_DEFEATED', { minion }, async () => {
            if (minion.attachments && minion.attachments.length > 0) {
                // Fire attachedDefeated for player upgrades (e.g. Spider-Tracer)
                for (const att of minion.attachments.filter(a => a.side === 'player')) {
                    await this.emitEvent('attachedDefeated', {
                        attachment: att,
                        minion,
                        sourceCard: att,
                        isCanceled: false
                    }, async () => {});
                }

                minion.attachments.forEach((card) => {
                    const dest = card.type === 'upgrade' ? this.playerDiscardIds : this.villainDiscardIds;

                    if (card.storageId) {
                        dest.push(card.storageId);
                    }
                });
            }

            if (minion.storageId) {
                this.villainDiscardIds.push(minion.storageId);
            }
            
            this.engagedMinions = this.engagedMinions.filter(m => m.instanceId !== instanceIdToDc);

            this.addLog(`${minion.name} has been removed from the board.`, 'discard');
        });
    },

    async discardSideScheme(instanceIdToDc: number) {
        const sideScheme = this.activeSideSchemes.find(s => s.instanceId === instanceIdToDc);

        if (!sideScheme) {
            this.addLog(`Could not find side scheme with id ${instanceIdToDc} to discard.`, 'system');
            return;
        }

        const context = { scheme: sideScheme };

        await this.emitEvent('SIDE_SCHEME_DEFEATED', context, async () => {
            
            // TODO: Check for attachments
            
            if (sideScheme.storageId) {
                this.villainDiscardIds.push(sideScheme.storageId);
            }

            this.activeSideSchemes = this.activeSideSchemes.filter(
                s => s.instanceId !== instanceIdToDc
            );

            this.addLog(`Side Scheme ${sideScheme.name} has been defeated and discarded.`, 'discard');
        });
    },

    findEnemyById(id: number): VillainIdentityCardInstance | Minion {
        if (this.villainCard && this.villainCard.instanceId === id) {
            return this.villainCard as VillainIdentityCardInstance;
        }

        return this.engagedMinions.find(m => m.instanceId === id) as Minion;
    },

    findSchemeById(id: number): MainSchemeInstance | SideScheme {
        if (this.mainScheme && this.mainScheme.instanceId === id) {
            return this.mainScheme as MainSchemeInstance;
        }

        return this.activeSideSchemes.find(s => s.instanceId === id) as SideScheme;
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
            this.addLog(`Attached ${attachment.name} to target ${targetId}`, 'play');
        } else {
            this.addLog(`Target with ID ${targetId} not found anywhere on board!`, 'system');
        }
    },

    // ****************************** IDENTITY UTILS ******************************

    async triggerIdentityCardAbility() {
        await this.useResourceAbility('identity');
    },

    resetAbilityLimits(resetOn: string) {
        for (const key in this.abilityResetOn) {
            if (this.abilityResetOn[key] === resetOn) {
                delete this.abilityUseCounts[key];
                delete this.abilityResetOn[key];
            }
        }
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
            this.addLog("HP remaining was not set.", 'system');
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
            this.addLog("You cannot thwart in Alter-Ego form!", 'system');
            return;
        }

        // Crisis: can't remove threat from main scheme
        if (this.mainScheme!.instanceId === id && this.hasCrisisScheme) {
            this.addLog("Cannot remove threat from main scheme while a Crisis side scheme is in play!", 'system');
            return;
        }

        const thwAmt = this.hero.thw;
        this.addLog(`Thwarting for ${thwAmt}!`, 'play');

        if (this.mainScheme!.instanceId === id) {
            this.mainScheme!.threatRemaining = Math.max(0, this.mainScheme!.threatRemaining - thwAmt);
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

    async attackWithIdentity(id: number) {
        if (this.hero.exhausted)
            return;

        if (this.hero.identityStatus === 'alter-ego') {
            this.addLog("You cannot attack in Alter-Ego form!", 'system');
            return;
        }

        // Guard: must defeat guard minions before attacking villain
        if (this.villainCard!.instanceId === id && this.hasGuardMinion) {
            this.addLog("Cannot attack the villain while a Guard minion is engaged!", 'system');
            return;
        }

        const atkAmt = this.hero.atk;
        this.addLog(`Attacking for ${atkAmt}!`, 'play');

        await this.applyDamageToEntity({ targetId: id, amount: atkAmt });

        const target = this.findTargetById(id);
        if (target && 'type' in target && target.type === 'minion') {
            const minion = target as Minion;
            if (minion.hitPointsRemaining <= 0) {
                await this.discardFromEngagedMinions(minion.instanceId);
            }
        }

        this.toggleIdentityExhaust();
    },

    defend() {
        // TODO: Implement defense
        this.addLog(`Defending for ${this.hero.def}!`, 'play');
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
        // Pending paid interrupt — execute the interrupt effect then resume the interrupt promise
        if (this.pendingInterruptCard) {
            const card = this.pendingInterruptCard;
            const context = this.pendingInterruptPayload;
            const resolve = this.pendingInterruptResolve;

            this.pendingInterruptCard = null;
            this.pendingInterruptPayload = null;
            this.pendingInterruptResolve = null;

            this.discardPlayerCardsFromHand(this.paymentBufferIds);
            this.discardPlayerCardsFromHand([card.instanceId]);
            this.resetPayment();

            if (card.logic?.effects) {
                await executeEffects(card.logic.effects, this, context);
            }

            if (resolve) resolve("played");
            return;
        }

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
                this.addLog("Play cancelled during targeting.", 'system');
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
        this.generatedResources = [];
        // If cancelling a pending paid interrupt, resolve the suspended promise as "passed"
        if (this.pendingInterruptResolve) {
            const resolve = this.pendingInterruptResolve;
            this.pendingInterruptCard = null;
            this.pendingInterruptPayload = null;
            this.pendingInterruptResolve = null;
            resolve("passed");
        }
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

    discardFromTableau(instanceId: number) {
        const card = this.tableauCards.find(c => c.instanceId === instanceId);
        if (!card) return;
        if (card.storageId) this.playerDiscardIds.push(card.storageId);
        this.tableauCards = this.tableauCards.filter(c => c.instanceId !== instanceId);
        this.addLog(`${card.name} was discarded from the tableau.`, 'discard');
    },

    async useResourceAbility(instanceId: number | string) {
        let card: any;
        let logic: any;

        if (instanceId === 'identity') {
            card = this.playerIdentity;
            logic = this.hero.identityStatus === 'hero' ? card.heroLogic : card.aeLogic;
        } else {
            card = this.tableauCards.find(c => c.instanceId === instanceId);
            logic = card?.logic;
        }

        if (!card || !logic || logic.type !== 'resource') return;

        // Resource abilities can only be used during payment
        if (logic.type === 'resource' && !this.activeCardId) return;

        // Use limit check
        const abilityKey = String(instanceId);
        if (logic.limit && (this.abilityUseCounts[abilityKey] ?? 0) >= logic.limit.uses) return;

        // Exhaustion check
        if (card.abilityExhausts && card.exhausted) return;

        if (!logic.effects) return;

        const context: any = { sourceCard: card };

        await executeEffects(logic.effects, this, context);

        if (logic.limit) {
            this.abilityUseCounts[abilityKey] = (this.abilityUseCounts[abilityKey] ?? 0) + 1;
            this.abilityResetOn[abilityKey] = logic.limit.resetOn;
        }

        // Add generated resource to payment
        if (context.generatedResource) {
            this.generatedResources.push(context.generatedResource);
        }

        // Check if cost is now met
        if (this.activeCardId && this.isCostMet) {
            await this.finalizePlay();
        }
    },

    // ****************************** TIMING WINDOWS ******************************
    async emitEvent(eventName: string, payload: Record<string, any>, actionFn: () => Promise<void> | void) {
        await this.checkTriggers('interrupt', eventName, payload);
        await actionFn();
        await this.checkTriggers('response', eventName, payload);
    },

    async checkTriggers(timing: string, eventName: string, payload: any) {
        const boardTriggers: any[] = [];
        
        if (!payload.usedInstanceIds) 
            payload.usedInstanceIds = [];

        this.collectIdentityTriggers(timing, eventName, boardTriggers);
        this.collectTableauTriggers(timing, eventName, boardTriggers);
        this.collectEnemyTriggers(timing, eventName, boardTriggers);
        this.collectSchemeTriggers(timing, eventName, boardTriggers);

        for (const card of boardTriggers.filter(c => c.logic.forced)) {
            if (card.logic.effects) {
                payload.sourceCard = card;
                await executeEffects(card.logic.effects, this, payload);
                payload.usedInstanceIds.push(card.instanceId || 'identity');
            }
        }

        let windowActive = true;
        while (windowActive) {
            if (payload.isCanceled || payload.isResolved) {
                windowActive = false;
                break;
            }

            const optionalBoard = boardTriggers.filter(c =>
                !c.logic.forced &&
                !c.exhausted &&
                !payload.usedInstanceIds.includes(c.instanceId || 'identity')
            );

            const handCards = this.hand.filter(card => 
                this.isValidTrigger(card, timing, eventName) && 
                this.canAfford(card) &&
                !payload.usedInstanceIds.includes(card.instanceId)
            );
            
            const allOptions = [...optionalBoard, ...handCards];

            if (allOptions.length > 0) {
                const result = await this.requestPlayerInterrupt(eventName, payload, allOptions);

                if (result === 'passed' || result === 'cancel') {
                    windowActive = false; 
                }
            } else {
                windowActive = false;
            }
        }
    },

    collectIdentityTriggers(timing: string, event: string, list: any[]) {
        const hero = this.playerIdentity;
        if (!hero) return;

        const activeLogic = this.hero.identityStatus === 'hero' ? hero.heroLogic : hero.aeLogic;

        if (activeLogic) {
            const trigger = {
                ...hero,
                logic: activeLogic
            };

            if (this.isValidTrigger(trigger, timing, event)) {
                list.push(trigger);
            }
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

        // Check villain attachments for triggers (e.g. Armored Rhino Suit)
        this.villainCard?.attachments?.forEach(att => {
            if (this.isValidTrigger(att, timing, event)) {
                list.push(att);
            }
        });

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
        const logic = card?.logic;
        if (!logic)
            return false;

        return (
            logic.timing === event &&
            logic.type === timing &&
            (!logic.formRequired || logic.formRequired === 'any' || logic.formRequired === this.hero.identityStatus)
        );
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
            
            const ally = this.tableauCards.find(c => c.instanceId === choice.id) as Ally | undefined;

            if (ally) {
                const defenseAction = async () => {
                    ally.exhausted = true;
                };

                await this.emitEvent(
                    "ALLY_DEFENDS", 
                    { name: ally.name, instanceId: ally.instanceId }, 
                    defenseAction
                );

                if (payload.isCanceled) 
                    return;

                await this.applyDamageToEntity({ 
                    targetId: ally.instanceId!, 
                    amount: payload.baseDamage
                });
            }
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

    async applyDamageToEntity(damageData: { targetId: number, amount: number }) {
        const target = this.findTargetById(damageData.targetId);
        if (!target)
            return;

        // Tough status absorbs the hit
        if ('tough' in target && target.tough) {
            target.tough = false;
            this.addLog(`${target.name} lost Tough status — damage prevented.`, 'status');
            return;
        }

        const eventName = target === this.villainCard ? 'VILLAIN_TAKES_DAMAGE' : 'ENTITY_DAMAGED';

        const performDamage = () => {
            target.hitPointsRemaining = Math.max(0, (target.hitPointsRemaining || 0) - damageData.amount);
        };

        await this.emitEvent(
            eventName,
            { targetId: damageData.targetId, amount: damageData.amount, isCanceled: false },
            performDamage
        );
    },

    findTargetById(instanceId: number): IdentityCardInstance | VillainIdentityCardInstance | Minion | Ally | undefined {
        if (this.hero?.instanceId === instanceId) 
            return this.hero;

        if (this.villainCard?.instanceId === instanceId) 
            return this.villainCard;

        const minion = this.engagedMinions.find(m => m.instanceId === instanceId);
        if (minion) 
            return minion;

        const ally = this.tableauCards.find(a => a.instanceId === instanceId && a.type === "ally");
        if (ally) 
            return ally as Ally;

        this.addLog(`Entity with instanceId ${instanceId} not found in active zones.`, 'system');
        return undefined;
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
        if (!card.logic?.effects) return;
        const form = card.logic.formRequired;
        if (form && form !== 'any' && form !== this.hero.identityStatus) {
            this.addLog(`${card.name} requires ${form} form.`, 'system');
            return;
        }
        await executeEffects(card.logic.effects, this, {
            sourceCard: card,
            playerForm: this.hero.identityStatus
        });
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

        const isEventFromHand = card.type === 'event' && this.hand.some(c => c.instanceId === card.instanceId);
        const isIdentityAbility = card.type === 'player' || card.type === 'identity';

        // Paid event interrupt — enter payment mode; resume in finalizePlay
        if (isEventFromHand && card.cost > 0) {
            const context = this.activePrompt.payload;
            if (!context.usedInstanceIds) context.usedInstanceIds = [];
            context.usedInstanceIds.push(card.instanceId);
            context.sourceCard = card;

            this.pendingInterruptCard = card;
            this.pendingInterruptPayload = context;
            this.pendingInterruptResolve = this.activePrompt.resolve;
            this.activePrompt = null;

            this.startPayment(card.instanceId);
            return;
        }

        if (isEventFromHand) {
            this.discardPlayerCardsFromHand([card.instanceId]);
        } else if (!isIdentityAbility) {
            card.exhausted = true;
        }

        if (card.logic?.effects) {
            const context = this.activePrompt.payload;

            if (!context.usedInstanceIds) context.usedInstanceIds = [];
            context.usedInstanceIds.push(card.instanceId || 'identity');

            context.sourceCard = card;

            await executeEffects(card.logic.effects, this, context);
        } else {
            this.addLog(`No effects defined on card: "${card.name}"`, 'system');
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
