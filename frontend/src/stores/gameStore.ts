import { defineStore } from "pinia";
import { type Ally, type Event, type Upgrade, type Support, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme, type PlayerCardInstance } 
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
    playerIdentity: createIdentityCard(1),
    idCardHasFlippedThisTurn: false,
    hand: [] as (Ally | Event | Upgrade | Support)[],
    deckIds: [] as number[],
    playerDiscardIds: [] as number[],
    tableauCards: [] as (Ally | Upgrade | Support)[],

    // Assets
    playerCardBackImg: "/cards/misc/player-card-back.png",
    villainCardBackImg: "/cards/misc/villain-card-back.png",

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

  getters: {
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
    }
  },

  actions: {
    // Game Phase Actions
    initializeGame() {
        let initIdCounter = 0;

        this.playerIdentity = createIdentityCard(1);
        this.deckIds = [1, 2, 2, 3, 3, 4, 4, 4, 5, 6, 6, 7, 7, 8, 8];
        this.shufflePile(this.deckIds);
        this.villainCard = createVillainIdentityCard(1, ++initIdCounter);
        this.mainScheme = createMainSchemeCard(1, ++initIdCounter);
        this.villainDeckIds = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        this.shufflePile(this.villainDeckIds);

        this.drawToHandSize();
    },

    async advanceGame() {
        if (this.currentPhase === GamePhase.PLAYER_TURN) {
            this.readyAllCards();
            this.drawToHandSize();

            this.currentPhase = GamePhase.VILLAIN_STEP_1_THREAT;
            await this.processMainSchemeThreat();

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

    async processMainSchemeThreat() {
        const incrementAmt = this.mainScheme!.threatIncrementIsPerPlayer
            ? this.mainScheme!.threatIncrement * 1 // TODO: Implement amount of players!
            : this.mainScheme!.threatIncrement;
            
        this.mainScheme!.currentThreat += incrementAmt;

        await new Promise(resolve => setTimeout(resolve, 1000));
    },

    async processVillainActivation() {
        if (this.playerIdentity.identityStatus === "alter-ego") {
            this.villainActivationScheme();
        }
        else {
            this.villainActivationAttack();
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    },

    villainActivationScheme() {
        this.mainScheme!.currentThreat += this.villainCard!.sch;
    },

    villainActivationAttack() {
        this.playerIdentity.hitPointsRemaining! -= this.villainCard!.atk
    },

    async processMinionActivations() {
        this.engagedMinions.forEach(minion => {
            if (this.playerIdentity.identityStatus === "alter-ego") {
                this.minionActivationScheme(minion);
            }
            else {
                this.minionActivationAttack(minion);
            }  
        })

        await new Promise(resolve => setTimeout(resolve, 1000));
    },

    minionActivationScheme(minion: Minion) {
        this.mainScheme!.currentThreat += minion.sch!;
    },

    minionActivationAttack(minion: Minion) {
        this.playerIdentity.hitPointsRemaining! -= minion.atk!;
    },

    async dealEncounterCards() {
        this.drawFromVillainDeckAsEncounterCard();

        await new Promise(resolve => setTimeout(resolve, 1000));
    },

    async readyAllCards() {
        this.playerIdentity.exhausted = false;
        this.tableauCards.forEach((card) => {
            card.exhausted = false;
        })
    },

    async drawToHandSize() {
        const currentHandSize = this.playerIdentity.identityStatus! === "alter-ego"
            ? this.playerIdentity.handsizeAe
            : this.playerIdentity.handSizeHero

        while (this.hand.length < currentHandSize) {
            this.drawCardFromDeck();
        }
    },

    // TODO: Organize the rest

    getNextId() {
        return ++this.idIncrementer;
    },

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

    discardVillainCards(cardIds: number[]) {
        this.villainDiscardIds.push(...cardIds);
    },

    destroyHandCard(cardId: number) {
        this.hand = this.hand.filter(c => c.instanceId !== cardId);
    },

    drawEncounterCardFromPlayerPile() {
        if (this.encounterPileIds.length === 0) 
            return;

        const id = this.encounterPileIds.shift()!;
        this.revealedEncounterCard = createVillainCard(id, this.getNextId());
    },

    shuffleDiscardPileIntoDrawPile() {
        this.deckIds.push(...this.playerDiscardIds);
        this.playerDiscardIds = [];

        this.shufflePile(this.deckIds);
    },

    shufflePile(pile: number[]) {
        for (let i = pile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            
            const temp = pile[i]!; 
            pile[i] = pile[j]!;
            pile[j] = temp;
        }
    },

    resolveCurrentEncounterCard(currentInstanceId: number) {
        if (currentInstanceId === this.revealedEncounterCard?.instanceId) {
        const card = this.revealedEncounterCard;
        const idToUse = card.storageId!;

        switch (card.type) {
            case 'attachment':
                this.villainCard!.attachments.push(createVillainCard(card.storageId!, 1));
                break;
            case 'minion':
                this.engagedMinions.push(createEngagedMinion(idToUse, this.getNextId()));
                break;
            case 'side-scheme':
                this.activeSideSchemes.push(createSideScheme(idToUse, this.getNextId()));
                break;
            case 'treachery':
                this.villainDiscardIds.push(idToUse);
                break;
        }

        this.revealedEncounterCard = null;
        }
    },

    drawFromVillainDeckAsEncounterCard() {
        if (this.villainDeckIds.length > 0) {
            this.encounterPileIds.push(this.villainDeckIds.shift()!);
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

    triggerIdentityCardAbility() {
        // TODO: Implement ability trigger 
        console.log(`Doing ${this.playerIdentity.name}'s ability.`)
    },

    toggleIdentityExhaust() {
        this.playerIdentity.exhausted = !this.playerIdentity.exhausted;
    },

    flipIdentity() {
        this.playerIdentity.identityStatus === "hero" 
            ? this.playerIdentity.identityStatus = "alter-ego"
            : this.playerIdentity.identityStatus = "hero"

        this.idCardHasFlippedThisTurn = !this.idCardHasFlippedThisTurn;
    },

    healIdentity() {
        if (!this.playerIdentity.hitPointsRemaining) {
            console.log("HP remaining was not set.");
            return;
        }

        if (this.playerIdentity.hitPointsRemaining >= this.playerIdentity.hitPoints) {
            return;
        }

        const amtToAdjustBy = 0; // TODO: Check tableau for healing upgrades

        this.playerIdentity.hitPointsRemaining! 
            += (this.playerIdentity.healing + (amtToAdjustBy || 0));

        if (this.playerIdentity.hitPointsRemaining! > this.playerIdentity.hitPoints) {
            this.playerIdentity.hitPointsRemaining! = this.playerIdentity.hitPoints;
        }

        this.toggleIdentityExhaust();
    },

    thwartWithIdentity(id: number) {
        if (this.playerIdentity.exhausted) 
            return;

        if (this.playerIdentity.identityStatus === 'alter-ego') {
            console.warn("You cannot thwart in Alter-Ego form!");
            return;
        }

        const thwAmt = this.playerIdentity.thw;
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
        if (this.playerIdentity.exhausted) 
            return;

        if (this.playerIdentity.identityStatus === 'alter-ego') {
            console.warn("You cannot attack in Alter-Ego form!");
            return;
        }

        const atkAmt = this.playerIdentity.atk;
        console.log(`Attacking for ${this.playerIdentity.atk}!`);

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
        console.log(`Defending for ${this.playerIdentity.def}!`)
        this.toggleIdentityExhaust();
    },

    discardFromEngagedMinions(instanceIdToDc: number) {
        const minion = this.engagedMinions.find(m => m.instanceId === instanceIdToDc);

        if (!minion) {
            console.log(`Could not find minion with id ${instanceIdToDc} to discard.`);
            return;
        }

        if (minion.attachments && minion.attachments.length > 0) {
            minion.attachments.forEach((card) => {
                if (card.type === 'upgrade') {
                    this.playerDiscardIds.push(card.instanceId!);
                } else {
                    this.villainDiscardIds.push(card.instanceId!);
                }
            });
        }

        this.villainDiscardIds.push(minion.storageId!);
        this.engagedMinions = this.engagedMinions.filter(m => m.instanceId !== instanceIdToDc);
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
            effect(this, card.logic.effectValue, targetId);
        }
    },
  }
});
