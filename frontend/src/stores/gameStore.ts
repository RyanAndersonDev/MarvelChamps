import { defineStore } from "pinia";

// Module-level resolver for end-of-turn async pause
let _endOfTurnResolve: (() => void) | null = null;
import { type Ally, type Event, type Upgrade, type Support, type IdentityCardInstance, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme, type PlayerCardInstance, type Resource }
    from '../types/card'
import type { LogEntry, LogType } from '../types/log';
import { villainCardMap, villainIdCardMap } from "../cards/cardStore";
import { GamePhase, type GamePhaseType } from "../types/phases";
import { createHandCard, createMainSchemeCard, createTableauCard, createVillainCard, createVillainIdentityCard, createEngagedMinion, createSideScheme, createIdentityCard } from "../cards/cardFactory";
import { executeEffects } from "../engine/effectLibrary";

export const useGameStore = defineStore('game', {
  state: () => ({
    // Game phase info
    currentPhase: GamePhase.PLAYER_TURN as GamePhaseType,
    encounterResolveSignal: null as (() => void) | null,

    // End-of-turn hand management
    endOfTurnPhase: null as null | 'discard' | 'mulligan',
    endOfTurnSelectedIds: [] as number[],

    // Game outcome
    gameOver: null as null | 'win' | 'lose',

    // Acceleration tokens (villain deck exhausted = +1 permanent threat per round)
    accelerationTokens: 0,

    // Identification
    idIncrementer: 0,
    
    // Villain Side
    villainCard: null as VillainIdentityCardInstance | null,
    mainScheme: null as MainSchemeInstance | null,
    villainPhaseChain: [] as number[],
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
    pendingCostReduction: 0,

    pendingInterruptCard: null as any,
    pendingInterruptPayload: null as any,
    pendingInterruptResolve: null as ((value: string) => void) | null,

    pendingRemoval: null as { attachmentInstanceId: number; hostId: number; cost: number; resourceType?: string; name: string } | null,

    pendingHandDiscard: null as { maxCount: number; resolve: (ids: number[] | null) => void } | null,

    // Transaction snapshot: saved at startPayment, restored on abortPlay
    playSnapshot: null as { hand: any[]; playerDiscardIds: number[] } | null,

    pendingResourcePayment: null as { needed: string[]; resolve: (ids: number[]) => void } | null,

    boostCard: null as { storageId: number; boostIcons: number; imgPath: string; name: string } | null,

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

    currentHandSizeLimit(state): number {
        if (!state.playerIdentity) return 6;
        return state.playerIdentity.identityStatus === 'alter-ego'
            ? state.playerIdentity.handsizeAe
            : state.playerIdentity.handSizeHero;
    },

    effectiveAtk(state): number {
        if (!state.playerIdentity) return 0;
        const base = state.playerIdentity.atk ?? 0;
        const mods = state.tableauCards.reduce((sum, c) => sum + ((c as any).atkMod ?? 0), 0);
        return base + mods;
    },

    effectiveDef(state): number {
        if (!state.playerIdentity) return 0;
        const base = state.playerIdentity.def ?? 0;
        const mods = state.tableauCards.reduce((sum, c) => sum + ((c as any).defMod ?? 0), 0);
        return base + mods;
    },

    endOfTurnDiscardCount(state): number {
        if (!state.playerIdentity) return 0;
        const limit = state.playerIdentity.identityStatus === 'alter-ego'
            ? state.playerIdentity.handsizeAe
            : state.playerIdentity.handSizeHero;
        return Math.max(0, state.hand.length - limit);
    },

    activeCard(state): any {
        if (state.activeCardId === -1 && state.pendingRemoval)
            return { cost: state.pendingRemoval.cost, name: state.pendingRemoval.name, instanceId: -1 };
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
        if (this.pendingRemoval?.resourceType) {
            const typed = this.committedResources[this.pendingRemoval.resourceType] ?? 0;
            const wild = this.committedResources['wild'] ?? 0;
            return (typed + wild) >= this.pendingRemoval.cost;
        }
        const totalSpent = Object.values(this.committedResources).reduce((a, b) => a + b, 0);
        const effectiveCost = Math.max(0, (this.activeCard.cost || 0) - this.pendingCostReduction);
        return totalSpent >= effectiveCost;
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

    tableauDefBonus(): number {
        return this.tableauCards.reduce((sum: number, c: any) => sum + (c.defMod ?? 0), 0);
    },

    isHandCardPlayable: (state) => (card: any): boolean => {
        // Non-events (allies, supports, upgrades) can always be played from hand during player turn.
        // formRequired only restricts their tableau ABILITY, not playing them from hand.
        if (card.type !== 'event') {
            if (state.currentPhase !== 'PLAYER_TURN') return false;
            if (card.uniqueInPlay && state.tableauCards.some((c: any) => c.storageId === card.storageId)) return false;
            if (card.attachmentLocation === 'minion') return state.engagedMinions.length > 0;
            if (card.attachmentLocation === 'enemy') return state.engagedMinions.length > 0 || !!state.villainCard;
            return true;
        }

        if (!card?.logic) return false;

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
    async initializeGame(config: { heroId: number; playerDeckIds: number[]; villainId: number; mainSchemeId: number; villainDeckIds: number[]; villainPhaseChain: number[] }) {
        // Reset gameplay state
        this.currentPhase = 'PLAYER_TURN' as any;
        this.gameOver = null;
        this.accelerationTokens = 0;
        this.villainCard = null;
        this.mainScheme = null;
        this.villainDeckIds = [];
        this.villainDiscardIds = [];
        this.activeSideSchemes = [];
        this.engagedMinions = [];
        this.encounterPileIds = [];
        this.revealedEncounterCard = null;
        this.playerIdentity = null;
        this.hand = [];
        this.deckIds = [];
        this.playerDiscardIds = [];
        this.tableauCards = [];
        this.activeCardId = null;
        this.paymentBufferIds = [];
        this.generatedResources = [];
        this.boostCard = null;

        let initIdCounter = 0;
        this.playerIdentity = createIdentityCard(config.heroId, ++initIdCounter);
        this.deckIds = [...config.playerDeckIds];
        this.shufflePile(this.deckIds);
        this.villainCard = createVillainIdentityCard(config.villainId, ++initIdCounter);
        this.mainScheme = createMainSchemeCard(config.mainSchemeId, ++initIdCounter);
        this.villainPhaseChain = [...config.villainPhaseChain];
        this.villainDeckIds = [...config.villainDeckIds];
        this.shufflePile(this.villainDeckIds);

        this.idIncrementer = initIdCounter;
        this.drawToHandSize();

        // Execute the starting villain's "When Revealed" effects (fires at game start)
        const startingBlueprint = villainIdCardMap.get(config.villainId);
        if (startingBlueprint?.whenFlipped?.length) {
            this.addLog(`${startingBlueprint.name} — When Revealed:`, 'villain');
            await executeEffects(startingBlueprint.whenFlipped, this, {});
        }

        this.addLog('--- Round 1 ---', 'phase');
    },

    async advanceGame() {
        if (this.gameOver) return;

        if (this.currentPhase === GamePhase.PLAYER_TURN) {
            // Discard down to hand size if over limit
            if (this.endOfTurnDiscardCount > 0) {
                this.endOfTurnSelectedIds = [];
                this.endOfTurnPhase = 'discard';
                await new Promise<void>(resolve => { _endOfTurnResolve = resolve; });
            }

            // Mulligan opportunity — player selects cards to swap, then clicks Done
            if (this.hand.length > 0) {
                this.endOfTurnSelectedIds = [];
                this.endOfTurnPhase = 'mulligan';
                await new Promise<void>(resolve => { _endOfTurnResolve = resolve; });
                this.endOfTurnPhase = null;
            }

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

            await this.checkTriggers('response', 'roundEnd', {});

            this.roundNumber++;
            this.addLog(`--- Round ${this.roundNumber} ---`, 'phase');
            this.currentPhase = GamePhase.PLAYER_TURN;
            this.idCardHasFlippedThisTurn = false;
            this.resetAbilityLimits('round');
            this.resetAbilityLimits('turn');
        }
    },

    async processMainSchemeStepOne() {
        const base = this.mainScheme!.threatIncrementIsPerPlayer
            ? this.mainScheme!.threatIncrement * 1 // TODO: Multiply by player count
            : this.mainScheme!.threatIncrement;

        const sideSchemeAcceleration = this.activeSideSchemes.filter(ss => ss.acceleration).length;
        const amount = base + this.accelerationTokens + sideSchemeAcceleration;

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

            const accelerationBonus = this.activeSideSchemes.filter(ss => ss.acceleration).length;
            const initialPayload = {
                attacker: this.villainCard?.name || 'Villain',
                baseThreat: (this.villainCard?.sch || 0) + accelerationBonus,
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

    async flipBoostCard(): Promise<number> {
        const cardId = this.drawOneVillainCard();
        if (cardId === null) return 0;

        const blueprint = villainCardMap.get(cardId);
        const boostIcons = blueprint?.boostIcons ?? 0;

        this.boostCard = {
            storageId: cardId,
            boostIcons,
            imgPath: blueprint?.imgPath ?? '',
            name: blueprint?.name ?? 'Unknown'
        };

        await this.emitEvent('BOOST_CARD_DRAWN', { cardId, boostIcons }, async () => {});

        await new Promise(resolve => setTimeout(resolve, 2000));

        await this.emitEvent('BOOST_CARD_REVEALED', { cardId, boostIcons }, async () => {});

        this.villainDiscardIds.push(cardId);

        await new Promise(resolve => setTimeout(resolve, 600));
        this.boostCard = null;

        return boostIcons;
    },

    async villainActivationScheme(payload: any) {
        await this.emitEvent('VILLAIN_SCHEME', payload, async () => {
            if (payload.isCanceled) return;

            payload.boostThreat = await this.flipBoostCard();
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

            attackPayload.boostDamage = await this.flipBoostCard();

            let reduction = 0;
            if (attackPayload.isDefended && attackPayload.targetType === 'identity') {
                reduction = this.effectiveDef + (attackPayload.defBonus ?? 0);
            }

            const finalDamage = Math.max(0, attackPayload.baseDamage + (attackPayload.boostDamage ?? 0) - reduction);

            if (attackPayload.targetType === 'identity') {
                if (finalDamage > 0) {
                    const damagePayload = {
                        amount: finalDamage,
                        isCanceled: false,
                        targetId: this.hero.instanceId,
                        isDefended: attackPayload.isDefended ?? false
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
                    await this.handleAllyDefeat(ally);
                }
            }

            await this.emitEvent('VILLAIN_ATTACK_CONCLUDED', attackPayload, async () => {});

            if (attackPayload.defBonus && !attackPayload.damageWasDealt) {
                this.hero.exhausted = false;
                this.addLog(`${this.hero.name} readied — no damage taken (Desperate Defense).`, 'status');
            }
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
            damageWasDealt: false,
            defBonus: 0,
        };

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
                reduction = this.effectiveDef + (attackPayload.defBonus ?? 0);
            }

            const finalDamage = Math.max(0, attackPayload.baseDamage - reduction);

            if (finalDamage > 0) {
                const damagePayload = { amount: finalDamage, isCanceled: false, targetId: this.hero.instanceId, isDefended: attackPayload.isDefended ?? false };

                await this.emitEvent('takeIdentityDamage', damagePayload, async () => {
                    if (damagePayload.isCanceled || damagePayload.amount <= 0) return;

                    await this.applyDamageToEntity(damagePayload);
                    attackPayload.damageWasDealt = true;
                });
            }
        });

        if (attackPayload.defBonus && !attackPayload.damageWasDealt) {
            this.hero.exhausted = false;
            this.addLog(`${this.hero.name} readied — no damage taken (Desperate Defense).`, 'status');
        }
    },

    // Draws one card from the villain deck, shuffling discard back in (+ acceleration) if empty.
    // Returns the storageId, or null if both deck and discard are empty.
    drawOneVillainCard(): number | null {
        if (this.villainDeckIds.length === 0) {
            if (this.villainDiscardIds.length === 0) return null;
            this.villainDeckIds.push(...this.villainDiscardIds);
            this.villainDiscardIds = [];
            this.shufflePile(this.villainDeckIds);
            this.accelerationTokens++;
            this.addLog(`Villain deck exhausted — discard shuffled into new deck. Acceleration token added (${this.accelerationTokens} bonus threat/round).`, 'villain');
        }
        return this.villainDeckIds.pop() ?? null;
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
                const cardId = this.drawOneVillainCard();
                if (cardId !== null) {
                    this.encounterPileIds.push(cardId);
                    this.addLog(`Dealt 1 encounter card to the player.`, 'villain');
                }
            }

            // Hazard: each active Hazard side scheme deals one additional encounter card
            for (const scheme of this.activeSideSchemes.filter(ss => ss.hazard)) {
                const cardId = this.drawOneVillainCard();
                if (cardId !== null) {
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

    toggleEndOfTurnCard(instanceId: number) {
        const idx = this.endOfTurnSelectedIds.indexOf(instanceId);
        if (idx === -1) this.endOfTurnSelectedIds.push(instanceId);
        else this.endOfTurnSelectedIds.splice(idx, 1);
    },

    confirmEndOfTurnDiscard() {
        if (this.endOfTurnSelectedIds.length !== this.endOfTurnDiscardCount) return;
        this.discardPlayerCardsFromHand(this.endOfTurnSelectedIds);
        this.endOfTurnSelectedIds = [];
        _endOfTurnResolve?.();
        _endOfTurnResolve = null;
    },

    confirmMulligan() {
        if (this.endOfTurnSelectedIds.length > 0) {
            const count = this.endOfTurnSelectedIds.length;
            this.discardPlayerCardsFromHand(this.endOfTurnSelectedIds);
            for (let i = 0; i < count; i++) this.drawCardFromDeck();
        }
        this.endOfTurnSelectedIds = [];
        _endOfTurnResolve?.();
        _endOfTurnResolve = null;
    },

    shuffleDiscardPileIntoDrawPile() {
        this.deckIds.push(...this.playerDiscardIds);
        this.playerDiscardIds = [];
        this.shufflePile(this.deckIds);
        const encounterId = this.drawOneVillainCard();
        if (encounterId !== null) {
            this.encounterPileIds.push(encounterId);
            this.addLog(`Player deck exhausted — shuffled discard into new draw pile and dealt 1 encounter card.`, 'villain');
        } else {
            this.addLog(`Player deck exhausted — shuffled discard into new draw pile.`, 'villain');
        }
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
                await this.handleAllyDefeat(ally);
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
                await this.handleAllyDefeat(ally);
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
            surge: 0
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

        // Surge keyword: fires unconditionally even if When Revealed was canceled
        const surgeKeyword = villainCardMap.get(card.storageId)?.surgeKeyword ?? 0;
        for (let i = 0; i < surgeKeyword; i++) {
            this.addLog(`${card.name} — Surge! Drawing additional encounter card.`, 'surge');
            this.drawFromVillainDeckAsEncounterCard();
        }

        // When Revealed surge effects (cancelable): set by { op: 'surge' } in effects array
        for (let i = 0; i < treacheryPayload.surge; i++) {
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
                const extra = blueprint.whenRevealedThreatIsPerPlayer
                    ? blueprint.whenRevealedThreat * 1 // TODO: multiply by number of players
                    : blueprint.whenRevealedThreat;
                sideScheme.threatRemaining += extra;
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
        const cardId = this.drawOneVillainCard();
        if (cardId !== null) {
            this.encounterPileIds.push(cardId);
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

    async flipIdentity() {
        const wasHero = this.hero.identityStatus === "hero";
        this.hero.identityStatus = wasHero ? "alter-ego" : "hero";
        this.idCardHasFlippedThisTurn = !this.idCardHasFlippedThisTurn;

        if (!wasHero) {
            await this.checkTriggers('response', 'FLIP_TO_HERO', {});
        }
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

        if (this.hero.confused) {
            this.addLog(`${this.hero.name} is confused — thwart canceled, confused removed.`, 'status');
            this.hero.confused = false;
            this.toggleIdentityExhaust();
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

        if (this.hero.stunned) {
            this.addLog(`${this.hero.name} is stunned — attack canceled, stun removed.`, 'status');
            this.hero.stunned = false;
            this.toggleIdentityExhaust();
            return;
        }

        // Guard: must defeat guard minions before attacking villain
        if (this.villainCard!.instanceId === id && this.hasGuardMinion) {
            this.addLog("Cannot attack the villain while a Guard minion is engaged!", 'system');
            return;
        }

        const atkAmt = this.effectiveAtk;
        this.addLog(`Attacking for ${atkAmt}!`, 'play');

        this.toggleIdentityExhaust();

        const attackPayload = { targetId: id, isCanceled: false };
        await this.emitEvent('BASIC_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled) return;
            await this.applyDamageToEntity({ targetId: id, amount: atkAmt });

            const target = this.findTargetById(id);
            if (target && 'type' in target && target.type === 'minion') {
                const minion = target as Minion;
                if (minion.hitPointsRemaining <= 0) {
                    await this.discardFromEngagedMinions(minion.instanceId);
                }
            }
        });
    },

    defend() {
        // TODO: Implement defense
        this.addLog(`Defending for ${this.hero.def}!`, 'play');
        this.toggleIdentityExhaust();
    },

    // ****************************** CARD PAYMENT ******************************

    startAttachmentRemoval(attachment: any, hostId: number) {
        this.pendingRemoval = {
            attachmentInstanceId: attachment.instanceId,
            hostId,
            cost: attachment.removal.cost,
            resourceType: attachment.removal.resourceType,
            name: `Remove: ${attachment.name}`
        };
        this.activeCardId = -1;
    },

    removeAttachment(attachmentInstanceId: number, hostId: number) {
        if (this.villainCard?.instanceId === hostId) {
            const att = this.villainCard.attachments.find(a => a.instanceId === attachmentInstanceId);
            if (att?.storageId) this.villainDiscardIds.push(att.storageId);
            this.villainCard.attachments = this.villainCard.attachments.filter(a => a.instanceId !== attachmentInstanceId);
            return;
        }
        const minion = this.engagedMinions.find(m => m.instanceId === hostId);
        if (minion) {
            const att = minion.attachments.find(a => a.instanceId === attachmentInstanceId);
            if (att?.storageId) this.villainDiscardIds.push(att.storageId);
            minion.attachments = minion.attachments.filter(a => a.instanceId !== attachmentInstanceId);
        }
    },

    startPayment(cardId: number) {
        const card = this.hand.find(c => c.instanceId === cardId);
        if (!card) return;

        // Save transaction snapshot before any state changes
        this.playSnapshot = {
            hand: JSON.parse(JSON.stringify(this.hand)),
            playerDiscardIds: [...this.playerDiscardIds],
        };

        this.activeCardId = cardId;

        if (card.cost === 0) {
            this.finalizePlay();
        }
    },

    addResourceToPayment(instanceId: number) {
        if (this.activeCardId === instanceId) return;

        // If removal requires a specific resource type, reject cards that don't provide it
        if (this.pendingRemoval?.resourceType) {
            const card = this.hand.find(c => c.instanceId === instanceId);
            if (!card?.resources?.includes(this.pendingRemoval.resourceType as any)) {
                this.addLog(`Removal requires ${this.pendingRemoval.resourceType} resources only.`, 'system');
                return;
            }
        }

        if (!this.paymentBufferIds.includes(instanceId)) {
            this.paymentBufferIds.push(instanceId);
        }

        if (this.isCostMet) {
            this.finalizePlay();
        }
    },

    async finalizePlay() {
        // Pending attachment removal
        if (this.pendingRemoval) {
            const { attachmentInstanceId, hostId, name } = this.pendingRemoval;
            this.pendingRemoval = null;
            this.discardPlayerCardsFromHand(this.paymentBufferIds);
            this.resetPayment();
            this.removeAttachment(attachmentInstanceId, hostId);
            this.addLog(`${name} removed.`, 'play');
            return;
        }

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

            this.pendingCostReduction = 0;
            if (resolve) resolve("played");
            return;
        }

        const card = { ...this.activeCard } as (Upgrade | Event | Ally | Support);
        if (!card)
            return;

        if (card.type === "event") {
            if ((card as any).tags?.includes('attack') && this.hero.stunned) {
                this.addLog(`${this.hero.name} is stunned — attack blocked, stun removed.`, 'status');
                this.hero.stunned = false;
                this.discardPlayerCardsFromHand([card.instanceId!]);
            } else if ((card as any).tags?.includes('thwart') && this.hero.confused) {
                this.addLog(`${this.hero.name} is confused — thwart blocked, confused removed.`, 'status');
                this.hero.confused = false;
                this.discardPlayerCardsFromHand([card.instanceId!]);
            } else {
                this.discardPlayerCardsFromHand(this.paymentBufferIds);
                this.discardPlayerCardsFromHand([card.instanceId!]);
                this.resetPayment();
                await this.executeCardEffect(card as any);
                this.playSnapshot = null; // Commit transaction after successful effect
            }
        }
        else if (card.type === "upgrade" && card.attachmentLocation !== "tableau") {
            try {
                const targetId = await this.requestTarget(card, card.attachmentLocation!);
                this.attachToTarget(card as any, targetId);
                this.destroyHandCard(card.instanceId!);
            } catch (error) {
                this.addLog("Play cancelled during targeting.", 'system');
                this.abortPlay();
                this.resetPayment();
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

        this.pendingCostReduction = 0;
        this.discardPlayerCardsFromHand(this.paymentBufferIds);
        this.resetPayment();
    },

    // Abort the current card play transaction and restore pre-play state
    abortPlay() {
        if (!this.playSnapshot) return;
        this.hand = this.playSnapshot.hand;
        this.playerDiscardIds = this.playSnapshot.playerDiscardIds;
        this.playSnapshot = null;
        this.addLog('Play cancelled — cards returned to hand.', 'system');
    },

    resetPayment() {
        this.activeCardId = null;
        this.paymentBufferIds = [];
        this.generatedResources = [];
        this.pendingRemoval = null;
        this.pendingCostReduction = 0;
        this.playSnapshot = null; // Clear snapshot when cancelling before finalization

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

    async handleAllyDefeat(ally: any) {
        if (!ally || ally.hitPointsRemaining > 0) return;
        const payload = { instanceId: ally.instanceId, name: ally.name, isCanceled: false, sourceCard: ally };
        await this.emitEvent('allyDefeated', payload, async () => {
            if (!payload.isCanceled) {
                this.discardFromTableau(ally.instanceId!);
            }
        });
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
        if (!payload.usedStorageIds)
            payload.usedStorageIds = [];

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

            const seenStorageIds = new Set<number>();
            const handCards = this.hand.filter(card => {
                if (card.type !== 'event') return false;
                if (card.logic?.actionType === 'defense' && !payload.isDefended) return false;
                if (!this.isValidTrigger(card, timing, eventName)) return false;
                if (!this.canAfford(card)) return false;
                if (payload.usedInstanceIds.includes(card.instanceId)) return false;
                if (card.storageId != null && payload.usedStorageIds.includes(card.storageId)) return false;
                if (card.storageId != null) {
                    if (seenStorageIds.has(card.storageId)) return false;
                    seenStorageIds.add(card.storageId);
                }
                return true;
            });

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
                logic: activeLogic,
                type: 'identity',
                imgPath: this.hero.identityStatus === 'hero' ? hero.heroImgPath : hero.imgPath,
            };

            if (this.isValidTrigger(trigger, timing, event)) {
                if (activeLogic.limit) {
                    const key = `identity_${hero.instanceId}`;
                    if ((this.abilityUseCounts[key] ?? 0) >= activeLogic.limit.uses) return;
                }
                list.push(trigger);
            }
        }
    },

    collectTableauTriggers(timing: string, event: string, list: any[]) {
        this.tableauCards.forEach(card => {
            if (this.isValidTrigger(card, timing, event)) {
                list.push(card);
            }
            card.logics?.forEach((logic: any) => {
                const wrapper = { ...card, logic };
                if (this.isValidTrigger(wrapper, timing, event)) {
                    list.push(wrapper);
                }
            });
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
            defenders.push({ id: 'hero', name: `Hero (${this.effectiveDef} DEF)` });
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
            await this.emitEvent('HERO_DEFENDS', payload, async () => {});
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

        const dmgPayload = { targetId: damageData.targetId, amount: damageData.amount, isCanceled: false };

        const performDamage = () => {
            if (dmgPayload.isCanceled || dmgPayload.amount <= 0) return;
            target.hitPointsRemaining = Math.max(0, (target.hitPointsRemaining || 0) - dmgPayload.amount);
        };

        await this.emitEvent(eventName, dmgPayload, performDamage);

        // Check if villain was defeated
        if (target === this.villainCard && (this.villainCard.hitPointsRemaining ?? 0) <= 0) {
            await this.handleVillainDefeated();
        }
    },

    async handleVillainDefeated() {
        const current = this.villainCard!;
        const currentIdx = this.villainPhaseChain.indexOf(current.storageId!);
        const nextPhaseId = currentIdx >= 0 ? this.villainPhaseChain[currentIdx + 1] : undefined;

        if (nextPhaseId != null) {
            const nextBlueprint = villainIdCardMap.get(nextPhaseId);
            if (nextBlueprint) {
                this.addLog(`${current.name} Phase ${current.phase} defeated! Flipping to Phase ${current.phase + 1}!`, 'villain');
                this.villainCard = createVillainIdentityCard(nextPhaseId, current.instanceId);
                if (nextBlueprint.whenFlipped?.length) {
                    await executeEffects(nextBlueprint.whenFlipped, this, {});
                }
                return;
            }
        }

        this.addLog(`${current.name} has been defeated! PLAYER WINS!`, 'villain');
        this.gameOver = 'win';
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

    async requestHandDiscard(maxCount: number): Promise<number[] | null> {
        return new Promise<number[] | null>((resolve) => {
            this.pendingHandDiscard = { maxCount, resolve };
        });
    },

    confirmHandDiscard(selectedIds: number[]) {
        if (this.pendingHandDiscard) {
            const resolve = this.pendingHandDiscard.resolve;
            this.pendingHandDiscard = null;
            this.playSnapshot = null; // Commit transaction on confirm
            resolve(selectedIds);
        }
    },

    cancelHandDiscard() {
        if (this.pendingHandDiscard) {
            const resolve = this.pendingHandDiscard.resolve;
            this.pendingHandDiscard = null;
            resolve(null); // null signals cancellation to the effect
        }
        this.abortPlay();
    },

    async requestResourcePayment(needed: string[]): Promise<number[]> {
        return new Promise<number[]>((resolve) => {
            this.pendingResourcePayment = { needed, resolve };
        });
    },

    confirmResourcePayment(selectedIds: number[]) {
        if (this.pendingResourcePayment) {
            const resolve = this.pendingResourcePayment.resolve;
            this.pendingResourcePayment = null;
            resolve(selectedIds);
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

    async activateCardAbility(instanceId: number) {
        const card = this.tableauCards.find(c => c.instanceId === instanceId);
        if (!card?.logic) return;

        const logic = card.logic;

        const form = logic.formRequired;
        if (form && form !== 'any' && form !== this.hero.identityStatus) {
            this.addLog(`${card.name} requires ${form} form.`, 'system');
            return;
        }

        let paymentIds: number[] = [];
        if (logic.resourceCost && logic.resourceCost.length > 0) {
            paymentIds = await this.requestResourcePayment(logic.resourceCost);
            if (paymentIds.length < logic.resourceCost.length) {
                this.addLog(`${card.name} — payment canceled.`, 'system');
                return;
            }
        }

        const context: any = { sourceCard: card, actionBlocked: false };
        await executeEffects(logic.effects, this, context);

        if (context.actionBlocked) {
            this.addLog(`${card.name} — action was blocked, payment refunded.`, 'system');
            return;
        }

        for (const id of paymentIds) {
            const paid = this.hand.find((c: any) => c.instanceId === id);
            if (paid) {
                this.hand = this.hand.filter((c: any) => c.instanceId !== id);
                if (paid.storageId != null) this.playerDiscardIds.push(paid.storageId);
                this.addLog(`${paid.name} discarded as payment.`, 'discard');
            }
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

        const isEventFromHand = card.type === 'event' && this.hand.some(c => c.instanceId === card.instanceId);
        const isIdentityAbility = card.type === 'player' || card.type === 'identity';

        // Paid event interrupt — enter payment mode; resume in finalizePlay
        if (isEventFromHand && card.cost > 0) {
            const context = this.activePrompt.payload;
            if (!context.usedInstanceIds) context.usedInstanceIds = [];
            if (!context.usedStorageIds) context.usedStorageIds = [];
            context.usedInstanceIds.push(card.instanceId);
            if (card.storageId != null) context.usedStorageIds.push(card.storageId);
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
        } else if (isIdentityAbility) {
            if (card.logic?.limit) {
                const key = `identity_${card.instanceId}`;
                this.abilityUseCounts[key] = (this.abilityUseCounts[key] ?? 0) + 1;
                this.abilityResetOn[key] = card.logic.limit.resetOn;
            }
        } else {
            card.exhausted = true;
        }

        if (card.logic?.effects) {
            const context = this.activePrompt.payload;

            if (!context.usedInstanceIds) context.usedInstanceIds = [];
            if (!context.usedStorageIds) context.usedStorageIds = [];
            context.usedInstanceIds.push(card.instanceId || 'identity');
            if (card.storageId != null) context.usedStorageIds.push(card.storageId);

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
