    import { defineStore } from "pinia";
    import { type Ally, type Event, type Upgrade, type Support, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme } 
        from '../types/card'
    import { createHandCard, createMainSchemeCard, createTableauCard, createVillainCard, createVillainIdentityCard, createEngagedMinion, createSideScheme } from "../cards/cardFactory";

export const useGameStore = defineStore('game', {
  state: () => ({
    // Identification
    idIncrementer: 0,
    
    // Villain Side
    villainCard: createVillainIdentityCard(1, 1) as VillainIdentityCardInstance,
    mainScheme: createMainSchemeCard(1) as MainSchemeInstance,
    villainDeckIds: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    villainDiscardIds: [] as number[],
    activeSideSchemes: [] as SideScheme[],
    engagedMinions: [] as Minion[],
    
    // Encounter Logic
    encounterPileIds: [] as number[],
    revealedEncounterCard: null as (Treachery | Attachment | Minion | SideScheme) | null,

    // Player Side
    idCardId: 1,
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
    getNextId() {
        return ++this.idIncrementer;
    },

    drawCardFromDeck() {
        if (this.deckIds.length === 0) 
            return;

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

    // TARGETING ACTIONS
    async requestTarget(sourceCard: any, type: "minion" | "villain" | "enemy" | "side-scheme") {
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
