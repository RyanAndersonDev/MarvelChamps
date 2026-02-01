    import { defineStore } from "pinia";
    import { type Ally, type Event, type Upgrade, type Support, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme } 
        from '../types/card'
    import { GamePhase, type GamePhaseType } from "../types/phases";
    import { createHandCard, createMainSchemeCard, createTableauCard, createVillainCard, createVillainIdentityCard, createEngagedMinion, createSideScheme, createIdentityCard } from "../cards/cardFactory";

export const useGameStore = defineStore('game', {
  state: () => ({
    // Game phase info
    currentPhase: GamePhase.PLAYER_TURN as GamePhaseType,
    encounterResolveSignal: null as (() => void) | null,

    // Identification
    idIncrementer: 0,
    
    // Villain Side
    villainCard: createVillainIdentityCard(1, 1) as VillainIdentityCardInstance,
    mainScheme: createMainSchemeCard(1, 1) as MainSchemeInstance,
    villainDeckIds: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    villainDiscardIds: [] as number[],
    activeSideSchemes: [] as SideScheme[],
    engagedMinions: [] as Minion[],
    
    // Encounter Logic
    encounterPileIds: [] as number[],
    revealedEncounterCard: null as (Treachery | Attachment | Minion | SideScheme) | null,

    // Player Side
    idCardId: 1,
    playerIdentity: createIdentityCard(1),
    hand: [] as (Ally | Event | Upgrade | Support)[],
    deckIds: [8, 7, 6, 5, 4, 3, 2, 1],
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
    } as any
  }),

  actions: {
    // Game Phase Actions
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
        }
    },

    async processMainSchemeThreat() {
        const incrementAmt = this.mainScheme.threatIncrementIsPerPlayer
            ? this.mainScheme.threatIncrement * 1 // TODO: Implement amount of players!
            : this.mainScheme.threatIncrement;
            
        this.mainScheme.currentThreat += incrementAmt;

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
        this.mainScheme.currentThreat += this.villainCard.sch;
    },

    villainActivationAttack() {
        this.playerIdentity.hitPointsRemaining! -= this.villainCard.atk
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
        this.mainScheme.currentThreat += minion.sch!;
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

    discardPlayerCardsFromHand(cardIds: number[]) {
        this.playerDiscardIds.push(...cardIds);
        this.hand = this.hand.filter(c => !cardIds.includes(c.storageId!));
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

        for (let i = this.deckIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            
            const temp = this.deckIds[i]!; 
            this.deckIds[i] = this.deckIds[j]!;
            this.deckIds[j] = temp;
        }
    },

    resolveCurrentEncounterCard(currentInstanceId: number) {
        if (currentInstanceId === this.revealedEncounterCard?.instanceId) {
        const card = this.revealedEncounterCard;
        const idToUse = card.storageId!;

        switch (card.type) {
            case 'attachment':
                this.villainCard.attachments.push(createVillainCard(card.storageId!, 1));
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
        // TODO: Implement thwart
        console.log(`Thwarting for ${this.playerIdentity.thw}!`);
        this.toggleIdentityExhaust();
    },

    attackWithIdentity(id: number) {
        // TODO: Implement attack
        console.log(`Attacking for ${this.playerIdentity.atk}!`);
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

        this.engagedMinions = this.engagedMinions.filter(m => m.instanceId !== instanceIdToDc);
        this.villainDiscardIds.push(instanceIdToDc);
    },

    // TARGETING ACTIONS
    async requestTarget(sourceCard: any, type: "minion" | "villain" | "enemy" | "scheme" | "main-scheme") {
        this.targeting.isActive = true;
        this.targeting.sourceCard = sourceCard;
        this.targeting.targetType = type;

        return new Promise<number>((resolve, reject) => {
            this.targeting.resolve = resolve;
        })
    },

    selectTarget(instanceId: number) {
        if (this.targeting.resolve) {
            this.targeting.resolve(instanceId);

            this.targeting.isActive = false;
            this.targeting.sourceCard = null;
            this.targeting.resolve = null;
        }
    }
  }
});
