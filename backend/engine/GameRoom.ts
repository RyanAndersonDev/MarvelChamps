import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import type { AuthPayload } from '../types/user';
import type {
    Ally, Event, Upgrade, Support, IdentityCardInstance, VillainIdentityCardInstance,
    MainSchemeInstance, Treachery, Obligation, Attachment, Minion, SideScheme, PlayerCardInstance, Resource
} from '../../shared/types/card';
import type { LogEntry, LogType } from '../../frontend/src/types/log';
import type { GamePhaseType } from '../../shared/types/phases';
import type { ActivePrompt, PlayerGameView, PlayerGameState, GameConfig, PromptResponse } from '../types/game';
import { GamePhase } from '../../shared/types/phases';
import { villainCardMap, villainIdCardMap, villainMainSchemeMap, heroLibrary } from '../cards/cardStore';
import {
    createHandCard, createMainSchemeCard, createTableauCard, createVillainCard,
    createVillainIdentityCard, createEngagedMinion, createSideScheme, createIdentityCard
} from '../cards/cardFactory';
import { executeEffects, satisfiesResourceRequirements } from './effectLibrary';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;

export class GameRoom {

    // ── Connection ────────────────────────────────────────────────────────────
    private io: GameServer;
    roomCode: string;
    sockets: Map<string, GameSocket> = new Map();

    // ── Game state ────────────────────────────────────────────────────────────
    currentPhase: GamePhaseType = 'PLAYER_TURN';
    endOfTurnPhase: null | 'discard' | 'mulligan' = null;
    endOfTurnSelectedIds: number[] = [];
    gameOver: null | 'win' | 'lose' = null;
    accelerationTokens: number = 0;
    idIncrementer: number = 0;

    villainCard: VillainIdentityCardInstance | null = null;
    mainScheme: MainSchemeInstance | null = null;
    villainPhaseChain: number[] = [];
    villainDeckIds: number[] = [];
    villainDiscardIds: number[] = [];
    activeSideSchemes: SideScheme[] = [];
    engagedMinions: Minion[] = [];

    encounterPileIds: number[] = [];
    revealedEncounterCard: (Treachery | Obligation | Attachment | Minion | SideScheme) | null = null;

    // Per-player nemesis tracking (single-player for now; expand to per-player map in multiplayer)
    setAsideNemesisIds: number[] = [];
    nemesisMinionStorageId: number | null = null;
    nemesisSideSchemeStorageId: number | null = null;
    nemesisSetAdded: boolean = false;

    playerIdentity: IdentityCardInstance | null = null;
    idCardHasFlippedThisTurn: boolean = false;
    abilityUseCounts: Record<string, number> = {};
    abilityResetOn: Record<string, string> = {};
    hand: (Ally | Event | Upgrade | Support)[] = [];
    deckIds: number[] = [];
    playerDiscardIds: number[] = [];
    tableauCards: (Ally | Upgrade | Support)[] = [];

    activePrompt: ActivePrompt | null = null;
    activeCardId: number | null = null;
    paymentBufferIds: number[] = [];
    generatedResources: Resource[] = [];
    pendingCostReduction: number = 0;
    pendingRemoval: { attachmentInstanceId: number; hostId: number; cost: number; resourceType?: string; removalCost?: Resource[]; name: string } | null = null;
    playSnapshot: { hand: (Ally | Event | Upgrade | Support)[]; playerDiscardIds: number[] } | null = null;
    pendingHandDiscard: { maxCount: number; title: string; hint: string; resourceFilter?: string[] } | null = null;
    boostCard: { storageId: number; boostIcons: number; imgPath: string; name: string } | null = null;
    pendingBoostResponseEffects: any[] = [];
    pendingYesNo: { question: string } | null = null;

    roundNumber: number = 1;
    logIdCounter: number = 0;
    gameLog: LogEntry[] = [];

    // ── Private resolvers (async pause points) ────────────────────────────────
    private _endOfTurnResolve: (() => void) | null = null;
    private _resolveTargetPromise: ((id: number) => void) | null = null;
    private _rejectTargetPromise: ((err: Error) => void) | null = null;
    private _pendingInterruptResolve: ((value: string) => void) | null = null;
    private _pendingChoiceResolve: ((value: any) => void) | null = null;
    private _pendingHandDiscardResolve: ((ids: number[] | null) => void) | null = null;
    private _resolveEncounterCardPromise: (() => void) | null = null;
    private _resolveYesNo: ((accepted: boolean) => void) | null = null;

    // ── Paid interrupt flow state ─────────────────────────────────────────────
    private _pendingInterruptCard: any = null;
    private _pendingInterruptPayload: any = null;
    private _pendingInterruptOptions: any[] = [];

    constructor(io: GameServer, roomCode: string) {
        this.io = io;
        this.roomCode = roomCode;
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    get hero(): IdentityCardInstance {
        if (!this.playerIdentity)
            throw new Error("Attempted to access Player Identity before it was initialized.");
        return this.playerIdentity;
    }

    get currentHandSizeLimit(): number {
        if (!this.playerIdentity) return 6;
        return this.playerIdentity.identityStatus === 'alter-ego'
            ? this.playerIdentity.handsizeAe
            : this.playerIdentity.handSizeHero;
    }

    get effectiveAtk(): number {
        if (!this.playerIdentity) return 0;
        const base = this.playerIdentity.atk ?? 0;
        const mods = this.tableauCards.reduce((sum, c) => sum + ((c as any).atkMod ?? 0), 0);
        const temp = (this.playerIdentity as any).tempAtkMod ?? 0;
        return base + mods + temp;
    }

    get effectiveDef(): number {
        if (!this.playerIdentity) return 0;
        const base = this.playerIdentity.def ?? 0;
        const mods = this.tableauCards.reduce((sum, c) => sum + ((c as any).defMod ?? 0), 0);
        return base + mods;
    }

    get effectiveThw(): number {
        if (!this.playerIdentity) return 0;
        const base = this.playerIdentity.thw ?? 0;
        const mods = this.tableauCards.reduce((sum, c) => sum + ((c as any).thwMod ?? 0), 0);
        const temp = (this.playerIdentity as any).tempThwMod ?? 0;
        return base + mods + temp;
    }

    get endOfTurnDiscardCount(): number {
        if (!this.playerIdentity) return 0;
        const limit = this.playerIdentity.identityStatus === 'alter-ego'
            ? this.playerIdentity.handsizeAe
            : this.playerIdentity.handSizeHero;
        return Math.max(0, this.hand.length - limit);
    }

    get activeCard(): any {
        if (this.activeCardId === -1 && this.pendingRemoval)
            return { cost: this.pendingRemoval.cost, name: this.pendingRemoval.name, instanceId: -1 };
        return this.hand.find(c => c.instanceId === this.activeCardId);
    }

    get committedResources(): Record<string, number> {
        const counts: Record<string, number> = { physical: 0, mental: 0, energy: 0, wild: 0 };
        this.paymentBufferIds.forEach(id => {
            const card = this.hand.find(c => c.instanceId === id);
            card?.resources?.forEach((r: string) => { counts[r]!++; });
        });
        this.generatedResources.forEach((r: string) => { counts[r]!++; });
        return counts;
    }

    get isCostMet(): boolean {
        if (!this.activeCard) return false;
        if (this.pendingRemoval?.removalCost) {
            const paid = Object.entries(this.committedResources)
                .flatMap(([r, n]) => Array(n).fill(r));
            return satisfiesResourceRequirements(this.pendingRemoval.removalCost, paid);
        }
        if (this.pendingRemoval?.resourceType) {
            const typed = this.committedResources[this.pendingRemoval.resourceType] ?? 0;
            const wild = this.committedResources['wild'] ?? 0;
            return (typed + wild) >= this.pendingRemoval.cost;
        }
        const totalSpent = Object.values(this.committedResources).reduce((a, b) => a + b, 0);
        const effectiveCost = Math.max(0, (this.activeCard.cost || 0) - this.pendingCostReduction);
        return totalSpent >= effectiveCost;
    }

    get canAnyoneDefend(): boolean {
        return !this.hero.exhausted || this.tableauCards.some(c => c.type === 'ally' && !(c as any).exhausted);
    }

    get hasGuardMinion(): boolean {
        return this.engagedMinions.some(m => m.guard);
    }

    get hasCrisisScheme(): boolean {
        return this.activeSideSchemes.some(ss => ss.crisis);
    }

    // ── Broadcast helpers ─────────────────────────────────────────────────────

    broadcastStateUpdate(): void {
        for (const [userId, socket] of this.sockets) {
            socket.emit('game:stateUpdate', this.buildPlayerView(userId));
        }
    }

    buildPlayerView(userId: string): PlayerGameView {
        const myState: PlayerGameState = {
            userId,
            seat: 0,
            identity: this.playerIdentity,
            idCardHasFlippedThisTurn: this.idCardHasFlippedThisTurn,
            hand: this.hand,
            deckIds: this.deckIds,
            playerDiscardIds: this.playerDiscardIds,
            tableau: this.tableauCards,
            engagedMinions: this.engagedMinions,
            encounterPileIds: this.encounterPileIds,
            revealedEncounterCard: this.revealedEncounterCard,
            abilityUseCounts: this.abilityUseCounts,
            abilityResetOn: this.abilityResetOn,
        };

        return {
            roomId: this.roomCode,
            myUserId: userId,
            currentPhase: this.currentPhase,
            activePlayerId: userId,
            villainPhaseTargetId: null,
            roundNumber: this.roundNumber,
            gameOver: this.gameOver,
            board: {
                villain: this.villainCard,
                mainScheme: this.mainScheme,
                activeSideSchemes: this.activeSideSchemes,
                villainDeckIds: this.villainDeckIds,
                villainDiscardIds: this.villainDiscardIds,
                accelerationTokens: this.accelerationTokens,
                boostCard: this.boostCard,
            },
            myState,
            otherPlayers: [],
            activePrompt: this.activePrompt,
            activeCardId: this.activeCardId,
            paymentBufferIds: this.paymentBufferIds,
            generatedResources: this.generatedResources,
            pendingCostReduction: this.pendingCostReduction,
            pendingRemoval: this.pendingRemoval,
            endOfTurnPhase: this.endOfTurnPhase,
            pendingHandDiscard: this.pendingHandDiscard,
            villainPhaseChain: this.villainPhaseChain,
            pendingYesNo: this.pendingYesNo,
            gameLog: this.gameLog,
        };
    }

    getActiveUserId(): string {
        return this.sockets.keys().next().value ?? '';
    }

    getValidTargetIds(type: string): number[] {
        if (type === 'enemy') {
            const ids: number[] = [];
            if (this.villainCard && !this.hasGuardMinion) ids.push(this.villainCard.instanceId);
            this.engagedMinions.forEach(m => ids.push(m.instanceId));
            return ids;
        }
        if (type === 'enemy-ignore-guard') {
            const ids: number[] = [];
            if (this.villainCard) ids.push(this.villainCard.instanceId);
            this.engagedMinions.forEach(m => ids.push(m.instanceId));
            return ids;
        }
        if (type === 'minion') {
            return this.engagedMinions.map(m => m.instanceId);
        }
        if (type === 'villain') {
            return this.villainCard ? [this.villainCard.instanceId] : [];
        }
        if (type === 'ally') {
            return (this.tableauCards.filter(c => c.type === 'ally') as Ally[]).map(c => c.instanceId!);
        }
        if (type === 'friendly') {
            const ids: number[] = [this.hero.instanceId];
            (this.tableauCards.filter(c => c.type === 'ally') as Ally[]).forEach(a => ids.push(a.instanceId!));
            return ids;
        }
        if (type === 'scheme') {
            const ids: number[] = [];
            if (this.mainScheme) ids.push(this.mainScheme.instanceId);
            this.activeSideSchemes.forEach(s => ids.push(s.instanceId));
            return ids;
        }
        return [];
    }

    // ── Logging ───────────────────────────────────────────────────────────────

    addLog(message: string, type: LogType = 'system') {
        console.log(`[R${this.roundNumber}][${type}] ${message}`);
        this.gameLog.push({ id: ++this.logIdCounter, round: this.roundNumber, type, message });
    }

    // ── Initialization ────────────────────────────────────────────────────────

    async initializeGame(config: GameConfig) {
        this.currentPhase = 'PLAYER_TURN';
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
        this.setAsideNemesisIds = [];
        this.nemesisMinionStorageId = null;
        this.nemesisSideSchemeStorageId = null;
        this.nemesisSetAdded = false;
        this.playerIdentity = null;
        this.hand = [];
        this.deckIds = [];
        this.playerDiscardIds = [];
        this.tableauCards = [];
        this.activeCardId = null;
        this.paymentBufferIds = [];
        this.generatedResources = [];
        this.boostCard = null;
        this.pendingBoostResponseEffects = [];
        this.roundNumber = 1;
        this.gameLog = [];
        this.logIdCounter = 0;

        const player = config.players[0]!;
        let initIdCounter = 0;
        this.playerIdentity = createIdentityCard(player.heroId, ++initIdCounter);
        this.deckIds = [...player.deckIds];
        this.shufflePile(this.deckIds);

        const heroEntry = heroLibrary.find(h => h.id === player.heroId);
        if (heroEntry?.nemesisSet) {
            const ns = heroEntry.nemesisSet;
            this.nemesisMinionStorageId = ns.minionStorageId;
            this.nemesisSideSchemeStorageId = ns.sideSchemeStorageId;
            this.setAsideNemesisIds = [ns.minionStorageId, ns.sideSchemeStorageId, ...ns.otherStorageIds];
            this.addLog(`Nemesis set (${heroEntry.name}) set aside.`, 'system');
        }
        this.villainCard = createVillainIdentityCard(config.villainId, ++initIdCounter);
        this.mainScheme = createMainSchemeCard(config.mainSchemeId, ++initIdCounter);
        this.villainPhaseChain = [...config.villainPhaseChain];
        this.villainDeckIds = [...config.villainDeckIds];

        // Inject obligation into villain deck before shuffle
        if (heroEntry && (heroEntry as any).obligationId != null) {
            this.villainDeckIds.push((heroEntry as any).obligationId);
            this.addLog(`${heroEntry.name}'s obligation shuffled into the encounter deck.`, 'system');
        }

        this.shufflePile(this.villainDeckIds);

        this.idIncrementer = initIdCounter;
        this.drawToHandSize();

        const startingBlueprint = villainIdCardMap.get(config.villainId);
        if (startingBlueprint?.whenFlipped?.length) {
            this.addLog(`${startingBlueprint.name} — When Revealed:`, 'villain');
            await executeEffects(startingBlueprint.whenFlipped, this, {});
        }

        const mainSchemeBlueprint = villainMainSchemeMap.get(config.mainSchemeId);
        if (mainSchemeBlueprint?.whenRevealedEffects?.length) {
            this.addLog(`${mainSchemeBlueprint.name} — When Revealed:`, 'villain');
            await executeEffects(mainSchemeBlueprint.whenRevealedEffects, this, {});
        }

        this.addLog('--- Round 1 ---', 'phase');
        this.broadcastStateUpdate();
    }

    // ── Main game loop ────────────────────────────────────────────────────────

    async advanceGame() {
        if (this.gameOver) return;

        if (this.currentPhase === GamePhase.PLAYER_TURN) {
            // Discard down to hand size
            if (this.endOfTurnDiscardCount > 0) {
                this.endOfTurnSelectedIds = [];
                this.endOfTurnPhase = 'discard';
                this.broadcastStateUpdate();
                await new Promise<void>(resolve => { this._endOfTurnResolve = resolve; });
                this.endOfTurnPhase = null;
            }

            // Mulligan
            if (this.hand.length > 0) {
                this.endOfTurnSelectedIds = [];
                this.endOfTurnPhase = 'mulligan';
                this.broadcastStateUpdate();
                await new Promise<void>(resolve => { this._endOfTurnResolve = resolve; });
                this.endOfTurnPhase = null;
            }

            this.readyAllCards();
            this.drawToHandSize();
            this.clearTemporaryAllyMods();

            this.currentPhase = GamePhase.VILLAIN_STEP_1_THREAT;
            this.broadcastStateUpdate();
            await this.processMainSchemeStepOne();

            this.currentPhase = GamePhase.VILLAIN_STEP_2_ACTIVATION;
            this.broadcastStateUpdate();
            await this.processVillainActivation();

            this.currentPhase = GamePhase.VILLAIN_STEP_3_MINIONS;
            this.broadcastStateUpdate();
            await this.processMinionActivations();

            this.currentPhase = GamePhase.VILLAIN_STEP_4_DEAL;
            this.broadcastStateUpdate();
            await this.dealEncounterCards();

            // Step 5: reveal encounter cards one at a time
            this.currentPhase = GamePhase.VILLAIN_STEP_5_REVEAL;
            while (this.encounterPileIds.length > 0) {
                this.drawEncounterCardFromPlayerPile();
                this.broadcastStateUpdate();
                await new Promise<void>(resolve => { this._resolveEncounterCardPromise = resolve; });
            }

            await this.checkTriggers('response', 'roundEnd', {});

            this.roundNumber++;
            this.addLog(`--- Round ${this.roundNumber} ---`, 'phase');
            this.currentPhase = GamePhase.PLAYER_TURN;
            this.idCardHasFlippedThisTurn = false;
            this.resetAbilityLimits('round');
            this.resetAbilityLimits('turn');
            this.broadcastStateUpdate();
        }
    }

    // ── Villain phase steps ───────────────────────────────────────────────────

    async processMainSchemeStepOne() {
        const base = this.mainScheme!.threatIncrementIsPerPlayer
            ? this.mainScheme!.threatIncrement * 1
            : this.mainScheme!.threatIncrement;
        const sideSchemeAcceleration = this.activeSideSchemes.filter(ss => ss.acceleration).length;
        const amount = base + this.accelerationTokens + sideSchemeAcceleration;
        await this.applyThreatToMainScheme({ amount, source: 'step_one', isCanceled: false });
    }

    async processVillainActivation() {
        if (this.villainCard?.stunned) {
            this.addLog(`${this.villainCard.name} is stunned — activation skipped, stun removed.`, 'status');
            this.villainCard.stunned = false;
            return;
        }

        if (this.hero.identityStatus === 'alter-ego') {
            if (this.villainCard?.confused) {
                this.addLog(`${this.villainCard.name} is confused — scheme skipped, confused removed.`, 'status');
                this.villainCard.confused = false;
                return;
            }
            const accelerationBonus = this.activeSideSchemes.filter(ss => ss.acceleration).length;
            const payload = {
                attacker: this.villainCard?.name || 'Villain',
                baseThreat: (this.villainCard?.sch || 0) + accelerationBonus,
                boostThreat: 0, isCanceled: false
            };
            await this.villainActivationScheme(payload);
        } else {
            const atkBonus = (this.villainCard?.attachments || [])
                .reduce((sum, att) => sum + ((att as Attachment).atkMod || 0), 0);
            const payload = {
                attacker: this.villainCard?.name || 'Villain',
                baseDamage: (this.villainCard?.atk || 0) + atkBonus,
                boostDamage: 0, isDefended: false,
                targetType: 'identity', targetId: 'hero',
                isCanceled: false,
                overkill: (this.villainCard?.attachments || []).some(att => (att as Attachment).overkill)
            };
            await this.villainActivationAttack(payload);
        }
    }

    async flipBoostCard(): Promise<number> {
        const cardId = this.drawOneVillainCard();
        if (cardId === null) return 0;

        const blueprint = villainCardMap.get(cardId);
        const boostIcons = blueprint?.boostIcons ?? 0;

        this.boostCard = { storageId: cardId, boostIcons, imgPath: blueprint?.imgPath ?? '', name: blueprint?.name ?? 'Unknown' };
        this.io.to(this.roomCode).emit('game:boostCardFlipped', this.boostCard);
        this.broadcastStateUpdate();

        await this.emitEvent('BOOST_CARD_DRAWN', { cardId, boostIcons }, async () => {});
        await this.emitEvent('BOOST_CARD_REVEALED', { cardId, boostIcons }, async () => {});

        // Hold the boost card visible for players to see before continuing
        await new Promise(resolve => setTimeout(resolve, 2500));

        this.villainDiscardIds.push(cardId);
        this.boostCard = null;

        if (blueprint?.boostEffect?.length) {
            await executeEffects(blueprint.boostEffect, this, { boostCardId: cardId });
        }

        if (blueprint?.boostResponseEffect?.length) {
            this.pendingBoostResponseEffects.push(...blueprint.boostResponseEffect);
        }

        return boostIcons;
    }

    async villainActivationScheme(payload: any) {
        await this.emitEvent('VILLAIN_SCHEME', payload, async () => {
            if (payload.isCanceled) return;
            payload.boostThreat = await this.flipBoostCard();
            const total = payload.baseThreat + payload.boostThreat;
            await this.applyThreatToMainScheme({ amount: total, source: 'villain_scheme', isCanceled: false });
            await this.emitEvent('VILLAIN_SCHEME_CONCLUDED', payload, async () => {});
        });
    }

    async applyThreatToMainScheme(threatPayload: any) {
        await this.emitEvent('MAIN_SCHEME_THREAT', threatPayload, async () => {
            if (threatPayload.isCanceled) return;
            this.mainScheme!.threatRemaining += threatPayload.amount;
            await this.emitEvent('THREAT_PLACED', threatPayload, async () => {
                if (this.mainScheme!.threatRemaining >= this.mainScheme!.threatThreshold) {
                    await this.advanceMainScheme();
                }
            });
        });
    }

    async advanceMainScheme() {
        const current = this.mainScheme!;
        if (current.nextMainSchemeId != null) {
            const nextBlueprint = villainMainSchemeMap.get(current.nextMainSchemeId);
            if (!nextBlueprint) {
                this.addLog(`Main scheme ${current.nextMainSchemeId} not found!`, 'system');
                return;
            }
            this.addLog(`${current.name} completed! Advancing to ${nextBlueprint.name}...`, 'villain');
            this.mainScheme = createMainSchemeCard(current.nextMainSchemeId, this.getNextId());
            if (nextBlueprint.whenRevealedEffects?.length) {
                this.addLog(`${nextBlueprint.name} — When Revealed:`, 'villain');
                await executeEffects(nextBlueprint.whenRevealedEffects, this, {});
            }
        } else {
            this.addLog(`${current.name} completed! The players have LOST!`, 'villain');
            this.gameOver = 'lose';
            this.io.to(this.roomCode).emit('game:over', { outcome: 'lose', roundsPlayed: this.roundNumber });
        }
    }

    async villainActivationAttack(attackPayload: any) {
        const playerAttachments = (this.villainCard?.attachments || []).filter((a: any) => a.side === 'player');
        for (const att of playerAttachments) {
            await this.emitEvent('attachedAttacks', { attachment: att, attacker: this.villainCard, sourceCard: att, attackPayload }, async () => {});
        }
        if (attackPayload.isCanceled) return;

        await this.emitEvent('ENEMY_ATTACK', attackPayload, async () => {});
        if (attackPayload.isCanceled) return;

        await this.emitEvent('VILLAIN_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled) return;

            if (this.canAnyoneDefend) await this.handleDefenseStep(attackPayload);

            attackPayload.boostDamage = await this.flipBoostCard();
            const extraBoostCount = attackPayload.extraBoostCards ?? 0;
            for (let i = 0; i < extraBoostCount; i++) {
                attackPayload.boostDamage += await this.flipBoostCard();
            }

            let reduction = 0;
            if (attackPayload.isDefended && attackPayload.targetType === 'identity')
                reduction = this.effectiveDef + (attackPayload.defBonus ?? 0);

            const finalDamage = Math.max(0, attackPayload.baseDamage + (attackPayload.boostDamage ?? 0) - reduction);

            if (attackPayload.targetType === 'identity') {
                if (finalDamage > 0) {
                    const damagePayload = { amount: finalDamage, isCanceled: false, targetId: this.hero.instanceId, isDefended: attackPayload.isDefended ?? false };
                    await this.emitEvent('takeIdentityDamage', damagePayload, async () => {
                        if (damagePayload.isCanceled || damagePayload.amount <= 0) return;
                        await this.applyDamageToEntity(damagePayload);
                        attackPayload.damageWasDealt = true;
                    });
                }
            } else if (attackPayload.targetType === 'ally') {
                const ally = this.tableauCards.find(c => c.instanceId === attackPayload.targetId) as Ally | undefined;
                const allyHpBefore = ally?.hitPointsRemaining ?? 0;
                const damagePayload = { amount: finalDamage, isCanceled: false, targetId: attackPayload.targetId };
                await this.emitEvent('takeAllyDamage', damagePayload, async () => {
                    if (damagePayload.isCanceled || damagePayload.amount <= 0) return;
                    await this.applyDamageToEntity(damagePayload);
                    attackPayload.damageWasDealt = true;
                });
                if (attackPayload.overkill && ally) {
                    const excess = finalDamage - allyHpBefore;
                    if (excess > 0) {
                        this.addLog(`Overkill! ${excess} excess damage dealt to hero.`, 'damage');
                        await this.applyDamageToEntity({ targetId: this.hero.instanceId, amount: excess });
                    }
                }
                if (ally && ally.hitPointsRemaining <= 0) await this.handleAllyDefeat(ally);
            }

            await this.emitEvent('VILLAIN_ATTACK_CONCLUDED', attackPayload, async () => {});

            if (this.pendingBoostResponseEffects.length > 0) {
                const effects = this.pendingBoostResponseEffects.splice(0);
                await executeEffects(effects, this, attackPayload);
            }

            if (attackPayload.defBonus && !attackPayload.damageWasDealt) {
                this.hero.exhausted = false;
                this.addLog(`${this.hero.name} readied — no damage taken (Desperate Defense).`, 'status');
            }
        });
    }

    async processMinionActivations() {
        for (const minion of this.engagedMinions) {
            if (minion.stunned) {
                this.addLog(`${minion.name} is stunned — activation skipped, stun removed.`, 'status');
                minion.stunned = false;
                continue;
            }
            if (this.hero.identityStatus === 'alter-ego') {
                if (minion.confused) {
                    this.addLog(`${minion.name} is confused — scheme skipped, confused removed.`, 'status');
                    minion.confused = false;
                    continue;
                }
                await this.minionActivationScheme(minion);
            } else {
                await this.minionActivationAttack(minion);
            }
        }
    }

    async minionActivationScheme(minion: Minion) {
        const payload = { attacker: minion.name, attackerId: minion.instanceId, baseThreat: minion.sch, isCanceled: false };
        await this.emitEvent('MINION_SCHEME', payload, async () => {
            if (payload.isCanceled) return;
            await this.applyThreatToMainScheme({ amount: payload.baseThreat, source: 'minion_scheme', isCanceled: false });
            await this.emitEvent('MINION_SCHEME_CONCLUDED', payload, async () => {});
        });
    }

    async minionActivationAttack(minion: Minion) {
        const baseDamage = minion.dynamicAtk === 'hitPointsRemaining' ? minion.hitPointsRemaining : minion.atk;
        const attackPayload = {
            attacker: minion.name, attackerId: minion.instanceId, source: minion, baseDamage,
            isDefended: false, targetType: 'identity', targetId: 'hero',
            isCanceled: false, damageWasDealt: false, defBonus: 0,
        };

        const playerAttachments = (minion.attachments || []).filter((a: any) => a.side === 'player');
        for (const att of playerAttachments) {
            await this.emitEvent('attachedAttacks', { attachment: att, attacker: minion, sourceCard: att, attackPayload }, async () => {});
        }
        if (attackPayload.isCanceled) return;

        await this.emitEvent('ENEMY_ATTACK', attackPayload, async () => {});
        if (attackPayload.isCanceled) return;

        await this.emitEvent('MINION_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled) return;
            if (this.canAnyoneDefend) await this.handleDefenseStep(attackPayload);

            let reduction = 0;
            if (attackPayload.isDefended && attackPayload.targetType === 'identity')
                reduction = this.effectiveDef + (attackPayload.defBonus ?? 0);

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
    }

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
    }

    async dealEncounterCards() {
        const payload = { count: 1, isCanceled: false };
        await this.emitEvent('DEAL_ENCOUNTER_CARDS', payload, async () => {
            if (payload.isCanceled) return;
            for (let i = 0; i < payload.count; i++) {
                const cardId = this.drawOneVillainCard();
                if (cardId !== null) {
                    this.encounterPileIds.push(cardId);
                    this.addLog(`Dealt 1 encounter card to the player.`, 'villain');
                }
            }
            for (const scheme of this.activeSideSchemes.filter(ss => ss.hazard)) {
                const cardId = this.drawOneVillainCard();
                if (cardId !== null) {
                    this.encounterPileIds.push(cardId);
                    this.addLog(`${scheme.name} (Hazard) dealt an additional encounter card.`, 'villain');
                }
            }
        });
    }

    readyAllCards() {
        this.hero.exhausted = false;
        this.tableauCards.forEach(card => { (card as any).exhausted = false; });
    }

    clearTemporaryAllyMods() {
        this.tableauCards.forEach(card => {
            if (card.type === 'ally') {
                const ally = card as any;
                if (ally.attachments) ally.attachments = ally.attachments.filter((att: any) => !att.temporary);
            }
        });
        if (this.playerIdentity) {
            (this.playerIdentity as any).tempAtkMod = 0;
            (this.playerIdentity as any).tempThwMod = 0;
        }
    }

    drawToHandSize() {
        const currentHandSize = this.hero.identityStatus === 'alter-ego'
            ? this.hero.handsizeAe : this.hero.handSizeHero;
        while (this.hand.length < currentHandSize) {
            this.drawCardFromDeck();
        }
    }

    // ── ID management ─────────────────────────────────────────────────────────

    getNextId(): number {
        return ++this.idIncrementer;
    }

    // ── Player cards ──────────────────────────────────────────────────────────

    drawCardFromDeck() {
        if (this.deckIds.length === 0) this.shuffleDiscardPileIntoDrawPile();
        const id = this.deckIds.shift()!;
        this.hand.push(createHandCard(id, this.getNextId()));
    }

    makeTableauCardFromHand(cardId: number): Ally | Upgrade | Support {
        const card = createTableauCard(cardId, this.getNextId());
        this.tableauCards.push(card);
        return card;
    }

    discardPlayerCardsFromHand(instanceIds: number[]) {
        instanceIds.forEach(instId => {
            const index = this.hand.findIndex(c => c.instanceId === instId);
            if (index !== -1) {
                const card = this.hand[index]!;
                this.playerDiscardIds.push(card.storageId!);
                this.hand.splice(index, 1);
            }
        });
    }

    destroyHandCard(cardId: number) {
        this.hand = this.hand.filter(c => c.instanceId !== cardId);
    }

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
    }

    // ── Ally actions ──────────────────────────────────────────────────────────

    effectiveAllyStat(ally: Ally, stat: 'atk' | 'thw'): number {
        const base = (ally as any)[stat] ?? 0;
        const modKey = stat === 'atk' ? 'atkMod' : 'thwMod';
        return base + ((ally as any).attachments ?? []).reduce((sum: number, att: any) => sum + (att[modKey] ?? 0), 0);
    }

    async thwartWithAlly(instanceId: number) {
        const ally = this.findTableauCardById(instanceId) as Ally;
        if (!ally || (ally as any).exhausted) return;

        const targetId = await this.requestTarget(null, 'scheme');
        if (!targetId) return;

        const target: MainSchemeInstance | SideScheme = this.findSchemeById(targetId);
        if (!target) return;

        if (target.type === 'main-scheme' && this.hasCrisisScheme) {
            this.addLog("Cannot remove threat from main scheme while a Crisis side scheme is in play!", 'system');
            return;
        }

        const dynamicBonus = (ally as any).dynamicThwBonus === 'sideSchemeCount'
            ? this.activeSideSchemes.length : 0;
        const thwartContext = { source: ally, target, value: this.effectiveAllyStat(ally, 'thw') + dynamicBonus };
        await this.emitEvent('ALLY_THWARTS', thwartContext, async () => {
            const threatEventName = target.type === 'side-scheme' ? 'SIDE_SCHEME_LOSES_THREAT' : 'MAIN_SCHEME_LOSES_THREAT';
            const threatContext = { target, amount: thwartContext.value, source: ally };
            await this.emitEvent(threatEventName, threatContext, async () => {
                target.threatRemaining = Math.max(0, target.threatRemaining - threatContext.amount);
                this.addLog(`${target.name} lost ${threatContext.amount} threat.`, 'threat');
            });
            (ally as any).exhausted = true;
            ally.hitPointsRemaining -= ally.thwPain ?? 0;
            if (target.type === 'side-scheme' && target.threatRemaining === 0)
                this.discardSideScheme(target.instanceId);
            if (ally.hitPointsRemaining <= 0) await this.handleAllyDefeat(ally);
            this.addLog(`${ally.name} successfully thwarted ${target.name}.`, 'play');
        });
        this.broadcastStateUpdate();
    }

    async attackWithAlly(instanceId: number) {
        const ally = this.findTableauCardById(instanceId) as Ally;
        if (!ally || (ally as any).exhausted) return;

        const targetId = await this.requestTarget(null, 'enemy');
        if (!targetId) return;

        const target: VillainIdentityCardInstance | Minion = this.findEnemyById(targetId);
        if (!target) return;

        if (target.type === 'villain' && this.hasGuardMinion) {
            this.addLog("Cannot attack the villain while a Guard minion is engaged!", 'system');
            return;
        }

        const attackContext = { source: ally, target, damage: this.effectiveAllyStat(ally, 'atk'), targetDefeated: false };
        await this.emitEvent('ALLY_ATTACKS', attackContext, async () => {
            await this.applyDamageToEntity({ targetId: target.instanceId, amount: attackContext.damage });
            (ally as any).exhausted = true;
            ally.hitPointsRemaining -= ally.atkPain ?? 0;
            const retaliateAmt = this.getRetaliateAmount(target.instanceId);
            if (retaliateAmt > 0) {
                this.addLog(`Retaliate ${retaliateAmt}! ${ally.name} takes ${retaliateAmt} damage.`, 'damage');
                ally.hitPointsRemaining -= retaliateAmt;
            }
            if (target.type === 'minion' && target.hitPointsRemaining === 0) {
                attackContext.targetDefeated = true;
                await this.discardFromEngagedMinions(target.instanceId);
            }
            if (ally.hitPointsRemaining <= 0) await this.handleAllyDefeat(ally);
        });
        this.broadcastStateUpdate();
    }

    getRetaliateAmount(targetId: number): number {
        const villain = this.villainCard;
        if (villain?.instanceId === targetId) {
            return (villain.attachments ?? []).reduce((sum: number, a: any) => sum + (a.retaliate ?? 0), 0);
        }
        const minion = this.engagedMinions.find(m => m.instanceId === targetId);
        if (minion) {
            const bp = villainCardMap.get(minion.storageId!);
            const base = bp?.retaliate ?? 0;
            const attRetaliate = (minion.attachments ?? []).reduce((sum: number, a: any) => sum + (a.retaliate ?? 0), 0);
            return base + attRetaliate;
        }
        return 0;
    }

    useAllyAbility(data: { allyInstanceId: number; abilityType: 'attack' | 'thwart'; targetId?: number }) {
        if (data.abilityType === 'attack') {
            this.attackWithAlly(data.allyInstanceId).catch(console.error);
        } else if (data.abilityType === 'thwart') {
            this.thwartWithAlly(data.allyInstanceId).catch(console.error);
        }
    }

    findTableauCardById(lookupId: number): PlayerCardInstance | undefined {
        const card = this.tableauCards.find(c => c.instanceId === lookupId);
        if (!card) this.addLog(`No tableau card found with instance ID ${lookupId}`, 'system');
        return card;
    }

    // ── Villain cards ─────────────────────────────────────────────────────────

    drawEncounterCardFromPlayerPile() {
        if (this.encounterPileIds.length === 0) return;
        const id = this.encounterPileIds.shift()!;
        this.revealedEncounterCard = createVillainCard(id, this.getNextId());
    }

    async resolveCurrentEncounterCard() {
        if (!this.revealedEncounterCard) return;
        const card = this.revealedEncounterCard;
        const payload = { card, isCanceled: false };

        await this.emitEvent('REVEAL_ENCOUNTER_CARD', payload, async () => {
            if (payload.isCanceled) return;
            switch (card.type) {
                case 'treachery':   await this.handleTreacheryResolution(card); break;
                case 'obligation':  await this.handleObligationReveal(card);    break;
                case 'minion':      await this.handleMinionEntry(card);         break;
                case 'side-scheme': await this.handleSideSchemeEntry(card);     break;
                case 'attachment':  await this.handleAttachmentEntry(card);     break;
            }
        });

        this.revealedEncounterCard = null;
        const resolve = this._resolveEncounterCardPromise;
        this._resolveEncounterCardPromise = null;
        resolve?.();
        this.broadcastStateUpdate();
    }

    async handleTreacheryResolution(card: any) {
        const treacheryPayload: any = { card, isCanceled: false, surge: 0 };
        await this.emitEvent('treacheryRevealed', treacheryPayload, async () => {
            if (treacheryPayload.isCanceled) {
                this.addLog(`${card.name} was canceled!`, 'system');
                return;
            }
            this.addLog(`Executing Treachery: ${card.name}`, 'villain');
            if (card.logic?.effects) await executeEffects(card.logic.effects, this, treacheryPayload);
        });

        this.villainDiscardIds.push(card.storageId);

        const surgeKeyword = villainCardMap.get(card.storageId)?.surgeKeyword ?? 0;
        for (let i = 0; i < surgeKeyword; i++) {
            this.addLog(`${card.name} — Surge! Drawing additional encounter card.`, 'surge');
            this.drawFromVillainDeckAsEncounterCard();
        }
        for (let i = 0; i < treacheryPayload.surge; i++) {
            this.addLog(`${card.name} surges! Drawing additional encounter card.`, 'surge');
            this.drawFromVillainDeckAsEncounterCard();
        }
    }

    async handleObligationReveal(card: any) {
        // Always offer the option to flip to alter-ego if currently in hero form
        if (this.hero.identityStatus === 'hero' && !this.idCardHasFlippedThisTurn) {
            const wantsFlip = await this.requestYesNo(`Flip ${this.hero.name} to alter-ego form?`);
            if (wantsFlip) {
                await this.flipIdentity();
            }
        }

        // Execute obligation effects (chooseOne with conditional options)
        const obligationPayload: any = { card, isCanceled: false, removedFromGame: false };
        if (card.logic?.effects) {
            await executeEffects(card.logic.effects, this, obligationPayload);
        }

        if (!obligationPayload.removedFromGame) {
            this.villainDiscardIds.push(card.storageId);
            this.addLog(`${card.name} discarded.`, 'discard');
        } else {
            this.addLog(`${card.name} removed from the game permanently.`, 'system');
        }
    }

    async handleMinionEntry(card: any) {
        const minion = createEngagedMinion(card.storageId, this.getNextId());
        this.engagedMinions.push(minion);
        const minionContext: any = { minion, sourceCard: minion, surge: 0 };
        if (minion.logic?.effects)
            await executeEffects(minion.logic.effects, this, minionContext);
        await this.emitEvent('MINION_ENTERED_PLAY', { minion, targetId: minion.instanceId }, async () => {});
        for (let i = 0; i < minionContext.surge; i++) {
            this.addLog(`${minion.name} — Surge! Drawing additional encounter card.`, 'surge');
            this.drawFromVillainDeckAsEncounterCard();
        }
    }

    async handleSideSchemeEntry(card: any) {
        const sideScheme = createSideScheme(card.storageId, this.getNextId());
        const blueprint = villainCardMap.get(card.storageId);
        const payload = { sideScheme, isCanceled: false };

        await this.emitEvent('SIDE_SCHEME_ENTERING', payload, async () => {
            if (payload.isCanceled) return;
            if (blueprint?.whenRevealedThreat) {
                const extra = blueprint.whenRevealedThreatIsPerPlayer
                    ? blueprint.whenRevealedThreat * 1
                    : blueprint.whenRevealedThreat;
                sideScheme.threatRemaining += extra;
            }
            this.activeSideSchemes.push(sideScheme);
            this.addLog(`Side Scheme ${card.name} entered with ${sideScheme.threatRemaining} threat.`, 'villain');
            if (blueprint?.whenRevealedEffects?.length) {
                await executeEffects(blueprint.whenRevealedEffects, this, { sourceCard: sideScheme });
            }
            await this.emitEvent('SIDE_SCHEME_ENTERED', payload, async () => {});
        });
    }

    async handleAttachmentEntry(card: any) {
        const blueprint = villainCardMap.get(card.storageId);

        if (blueprint?.attachmentTarget === 'highestHpMinion') {
            if (this.engagedMinions.length === 0) {
                this.addLog(`${card.name} — no minions in play. Surge!`, 'surge');
                this.drawFromVillainDeckAsEncounterCard();
                if (card.storageId != null) this.villainDiscardIds.push(card.storageId);
                return;
            }
            const target = this.engagedMinions.reduce((best, m) => {
                const bpHp = villainCardMap.get(m.storageId!)?.hitPoints ?? 0;
                const bestHp = villainCardMap.get(best.storageId!)?.hitPoints ?? 0;
                return bpHp > bestHp ? m : best;
            });
            const attachment = createVillainCard(card.storageId, this.getNextId());
            target.attachments.push(attachment as any);
            if (blueprint.hpMod) {
                target.hitPoints += blueprint.hpMod;
                target.hitPointsRemaining += blueprint.hpMod;
            }
            this.addLog(`${card.name} attached to ${target.name} (+${blueprint.hpMod} HP).`, 'villain');
            return;
        }

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
    }

    drawFromVillainDeckAsEncounterCard() {
        const cardId = this.drawOneVillainCard();
        if (cardId !== null) this.encounterPileIds.push(cardId);
    }

    async discardFromEngagedMinions(instanceIdToDc: number) {
        const minion = this.engagedMinions.find(m => m.instanceId === instanceIdToDc);
        if (!minion) { this.addLog(`Could not find minion with id ${instanceIdToDc} to discard.`, 'system'); return; }

        await this.emitEvent('MINION_DEFEATED', { minion }, async () => {
            if (minion.attachments && minion.attachments.length > 0) {
                for (const att of minion.attachments.filter((a: any) => a.side === 'player')) {
                    await this.emitEvent('attachedDefeated', { attachment: att, minion, sourceCard: att, isCanceled: false }, async () => {});
                }
                minion.attachments.forEach((card: any) => {
                    const dest = card.type === 'upgrade' ? this.playerDiscardIds : this.villainDiscardIds;
                    if (card.storageId) dest.push(card.storageId);
                });
            }
            if (minion.storageId) this.villainDiscardIds.push(minion.storageId);
            this.engagedMinions = this.engagedMinions.filter(m => m.instanceId !== instanceIdToDc);
            this.addLog(`${minion.name} has been removed from the board.`, 'discard');
        });
    }

    async discardSideScheme(instanceIdToDc: number) {
        const sideScheme = this.activeSideSchemes.find(s => s.instanceId === instanceIdToDc);
        if (!sideScheme) { this.addLog(`Could not find side scheme with id ${instanceIdToDc} to discard.`, 'system'); return; }

        await this.emitEvent('SIDE_SCHEME_DEFEATED', { scheme: sideScheme }, async () => {
            if (sideScheme.storageId) this.villainDiscardIds.push(sideScheme.storageId);
            this.activeSideSchemes = this.activeSideSchemes.filter(s => s.instanceId !== instanceIdToDc);
            this.addLog(`Side Scheme ${sideScheme.name} has been defeated and discarded.`, 'discard');
            const blueprint = villainCardMap.get(sideScheme.storageId!);
            if (blueprint?.whenDefeatedEffects?.length) {
                await executeEffects(blueprint.whenDefeatedEffects, this, { sourceCard: sideScheme });
            }
        });
    }

    findEnemyById(id: number): VillainIdentityCardInstance | Minion {
        if (this.villainCard && this.villainCard.instanceId === id) return this.villainCard;
        return this.engagedMinions.find(m => m.instanceId === id) as Minion;
    }

    findSchemeById(id: number): MainSchemeInstance | SideScheme {
        if (this.mainScheme && this.mainScheme.instanceId === id) return this.mainScheme;
        return this.activeSideSchemes.find(s => s.instanceId === id) as SideScheme;
    }

    findTargetById(instanceId: number): IdentityCardInstance | VillainIdentityCardInstance | Minion | Ally | undefined {
        if (this.hero?.instanceId === instanceId) return this.hero;
        if (this.villainCard?.instanceId === instanceId) return this.villainCard;
        const minion = this.engagedMinions.find(m => m.instanceId === instanceId);
        if (minion) return minion;
        const ally = this.tableauCards.find(a => a.instanceId === instanceId && a.type === 'ally');
        if (ally) return ally as Ally;
        this.addLog(`Entity with instanceId ${instanceId} not found in active zones.`, 'system');
        return undefined;
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    shufflePile(pile: number[]) {
        for (let i = pile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = pile[i]!;
            pile[i] = pile[j]!;
            pile[j] = temp;
        }
    }

    attachToTarget(attachment: Upgrade, targetId: number) {
        const targetMinion = this.engagedMinions.find(m => m.instanceId === targetId);
        const targetVillain = this.villainCard?.instanceId === targetId ? this.villainCard : null;
        const targetAlly = this.tableauCards.find(c => c.type === 'ally' && c.instanceId === targetId) as Ally | undefined;

        if (targetAlly && (attachment as any).attachmentLocation === 'ally') {
            if (!(targetAlly as any).attachments) (targetAlly as any).attachments = [];
            (targetAlly as any).attachments.push(attachment);
            this.addLog(`${attachment.name} attached to ${targetAlly.name}.`, 'play');
        } else {
            const finalTarget = targetMinion || targetVillain;
            if (finalTarget) {
                if (!(finalTarget as any).attachments) (finalTarget as any).attachments = [];
                (finalTarget as any).attachments.push(attachment);
                this.addLog(`Attached ${attachment.name} to target ${targetId}`, 'play');
            } else {
                this.addLog(`Target with ID ${targetId} not found anywhere on board!`, 'system');
            }
        }
    }

    // ── Identity actions ──────────────────────────────────────────────────────

    async triggerIdentityCardAbility() {
        await this.useResourceAbility('identity');
        this.broadcastStateUpdate();
    }

    resetAbilityLimits(resetOn: string) {
        for (const key in this.abilityResetOn) {
            if (this.abilityResetOn[key] === resetOn) {
                delete this.abilityUseCounts[key];
                delete this.abilityResetOn[key];
            }
        }
    }

    async flipIdentity() {
        if (this.idCardHasFlippedThisTurn) return;
        const wasHero = this.hero.identityStatus === 'hero';
        this.hero.identityStatus = wasHero ? 'alter-ego' : 'hero';
        this.idCardHasFlippedThisTurn = true;
        if (!wasHero) await this.checkTriggers('response', 'FLIP_TO_HERO', {});
        this.broadcastStateUpdate();
    }

    healIdentity() {
        if (!this.hero.hitPointsRemaining) { this.addLog("HP remaining was not set.", 'system'); return; }
        if (this.hero.hitPointsRemaining >= this.hero.hitPoints) return;
        this.hero.hitPointsRemaining += this.hero.healing;
        if (this.hero.hitPointsRemaining > this.hero.hitPoints) this.hero.hitPointsRemaining = this.hero.hitPoints;
        this.hero.exhausted = !this.hero.exhausted;
        this.broadcastStateUpdate();
    }

    thwartWithIdentity(id: number) {
        if (this.hero.exhausted) return;
        if (this.hero.identityStatus === 'alter-ego') { this.addLog("You cannot thwart in Alter-Ego form!", 'system'); return; }
        if (this.hero.confused) {
            this.addLog(`${this.hero.name} is confused — thwart canceled, confused removed.`, 'status');
            this.hero.confused = false;
            this.hero.exhausted = !this.hero.exhausted;
            this.broadcastStateUpdate();
            return;
        }
        if (this.mainScheme!.instanceId === id && this.hasCrisisScheme) {
            this.addLog("Cannot remove threat from main scheme while a Crisis side scheme is in play!", 'system');
            return;
        }
        const thwAmt = this.effectiveThw;
        this.addLog(`Thwarting for ${thwAmt}!`, 'play');
        if (this.mainScheme!.instanceId === id) {
            this.mainScheme!.threatRemaining = Math.max(0, this.mainScheme!.threatRemaining - thwAmt);
        } else {
            const sideScheme = this.activeSideSchemes.find(ss => ss.instanceId === id);
            if (sideScheme) {
                sideScheme.threatRemaining = Math.max(0, sideScheme.threatRemaining - thwAmt);
                if (sideScheme.threatRemaining === 0) this.discardSideScheme(id);
            }
        }
        this.hero.exhausted = !this.hero.exhausted;
        this.broadcastStateUpdate();
    }

    async attackWithIdentity(id: number) {
        if (this.hero.exhausted) return;
        if (this.hero.identityStatus === 'alter-ego') { this.addLog("You cannot attack in Alter-Ego form!", 'system'); return; }
        if (this.hero.stunned) {
            this.addLog(`${this.hero.name} is stunned — attack canceled, stun removed.`, 'status');
            this.hero.stunned = false;
            this.hero.exhausted = !this.hero.exhausted;
            this.broadcastStateUpdate();
            return;
        }
        if (this.villainCard!.instanceId === id && this.hasGuardMinion) {
            this.addLog("Cannot attack the villain while a Guard minion is engaged!", 'system');
            return;
        }
        const atkAmt = this.effectiveAtk;
        this.addLog(`Attacking for ${atkAmt}!`, 'play');
        this.hero.exhausted = !this.hero.exhausted;

        const attackPayload = { targetId: id, isCanceled: false, targetDefeated: false };
        await this.emitEvent('BASIC_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled) return;
            await this.applyDamageToEntity({ targetId: id, amount: atkAmt });
            const retaliateAmt = this.getRetaliateAmount(id);
            if (retaliateAmt > 0) {
                this.addLog(`Retaliate ${retaliateAmt}! ${this.hero.name} takes ${retaliateAmt} damage.`, 'damage');
                await this.applyDamageToEntity({ targetId: this.hero.instanceId, amount: retaliateAmt });
            }
            const target = this.findTargetById(id);
            if (target && 'type' in target && target.type === 'minion') {
                if ((target as Minion).hitPointsRemaining <= 0) {
                    attackPayload.targetDefeated = true;
                    await this.discardFromEngagedMinions((target as Minion).instanceId);
                }
            }
        });
        this.broadcastStateUpdate();
    }

    // ── Payment system ────────────────────────────────────────────────────────

    startAttachmentRemoval(attachment: any, hostId: number) {
        if (attachment.removalCost) {
            this.pendingRemoval = {
                attachmentInstanceId: attachment.instanceId,
                hostId,
                cost: attachment.removalCost.length,
                removalCost: attachment.removalCost,
                name: `Remove: ${attachment.name}`
            };
        } else {
            this.pendingRemoval = {
                attachmentInstanceId: attachment.instanceId,
                hostId,
                cost: attachment.removal.cost,
                resourceType: attachment.removal.resourceType,
                name: `Remove: ${attachment.name}`
            };
        }
        this.activeCardId = -1;
        this.broadcastStateUpdate();
    }

    removeAttachment(attachmentInstanceId: number, hostId: number) {
        if (this.villainCard?.instanceId === hostId) {
            const att = this.villainCard.attachments.find((a: any) => a.instanceId === attachmentInstanceId);
            if (att?.storageId) this.villainDiscardIds.push(att.storageId);
            this.villainCard.attachments = this.villainCard.attachments.filter((a: any) => a.instanceId !== attachmentInstanceId);
            return;
        }
        const minion = this.engagedMinions.find(m => m.instanceId === hostId);
        if (minion) {
            const att = (minion.attachments || []).find((a: any) => a.instanceId === attachmentInstanceId);
            if (att?.storageId) this.villainDiscardIds.push(att.storageId);
            minion.attachments = (minion.attachments || []).filter((a: any) => a.instanceId !== attachmentInstanceId);
        }
    }

    playCard(data: { instanceId: number; targetId?: number }) {
        this.startPayment(data.instanceId);
        // broadcastStateUpdate is called inside startPayment (or by finalizePlay for free cards)
    }

    startPayment(cardId: number) {
        const card = this.hand.find(c => c.instanceId === cardId);
        if (!card) return;
        this.playSnapshot = {
            hand: JSON.parse(JSON.stringify(this.hand)),
            playerDiscardIds: [...this.playerDiscardIds],
        };
        this.activeCardId = cardId;
        if (card.cost === 0) {
            // finalizePlay is async and broadcasts when done; don't broadcast here.
            this.finalizePlay().catch(console.error);
        } else {
            this.broadcastStateUpdate();
        }
    }

    addResourceToPayment(instanceId: number) {
        if (this.activeCardId === instanceId) return;
        if (this.pendingRemoval?.resourceType) {
            const card = this.hand.find(c => c.instanceId === instanceId);
            const isPaymentWindowCard = (card as any)?.type === 'resource' && (card as any)?.logic?.timing === 'paymentWindow';
            if (!isPaymentWindowCard && !card?.resources?.includes(this.pendingRemoval.resourceType as any) && !card?.resources?.includes('wild')) {
                this.addLog(`Removal requires ${this.pendingRemoval.resourceType} resources only.`, 'system');
                return;
            }
        }
        if (!this.paymentBufferIds.includes(instanceId)) {
            this.paymentBufferIds.push(instanceId);
            // Hand resource cards with empty resources[] and paymentWindow logic fire their
            // effects on commit (e.g. Power of Aggression — conditional wild generation).
            const committedCard = this.hand.find(c => c.instanceId === instanceId) as any;
            if (
                committedCard?.type === 'resource' &&
                committedCard?.logic?.timing === 'paymentWindow' &&
                (!committedCard.resources || committedCard.resources.length === 0)
            ) {
                (async () => {
                    await executeEffects(committedCard.logic.effects, this, { sourceCard: committedCard });
                    if (this.activeCardId && this.isCostMet) {
                        await this.finalizePlay();
                    } else {
                        this.broadcastStateUpdate();
                    }
                })().catch(console.error);
                return;
            }
        }
        if (this.isCostMet) {
            // finalizePlay is async and will call broadcastStateUpdate at the end;
            // don't broadcast here or we'll catch an intermediate hand state mid-effect.
            this.finalizePlay().catch(console.error);
        } else {
            this.broadcastStateUpdate();
        }
    }

    async finalizePlay() {
        if (this.pendingRemoval) {
            const { attachmentInstanceId, hostId, name } = this.pendingRemoval;
            this.pendingRemoval = null;
            this.discardPlayerCardsFromHand(this.paymentBufferIds);
            this.resetPayment();
            this.removeAttachment(attachmentInstanceId, hostId);
            this.addLog(`${name} removed.`, 'play');
            this.broadcastStateUpdate();
            return;
        }

        if (this._pendingInterruptCard) {
            const card = this._pendingInterruptCard;
            const context = this._pendingInterruptPayload;
            const resolve = this._pendingInterruptResolve;

            this._pendingInterruptCard = null;
            this._pendingInterruptPayload = null;
            this._pendingInterruptResolve = null;

            this.discardPlayerCardsFromHand(this.paymentBufferIds);
            this.discardPlayerCardsFromHand([card.instanceId]);
            this.resetPayment();

            if (card.logic?.effects) await executeEffects(card.logic.effects, this, context);
            this.pendingCostReduction = 0;
            if (resolve) resolve('played');
            this.broadcastStateUpdate();
            return;
        }

        const card = { ...this.activeCard } as (Upgrade | Event | Ally | Support);
        if (!card) return;
        let afterPlayCard: any = card; // updated to tableau instance for allies/upgrades/supports

        if (card.type === 'event') {
            if ((card as any).tags?.includes('attack') && this.hero.stunned) {
                this.addLog(`${this.hero.name} is stunned — attack blocked, stun removed.`, 'status');
                this.hero.stunned = false;
                this.discardPlayerCardsFromHand([card.instanceId!]);
            } else if ((card as any).tags?.includes('thwart') && this.hero.confused) {
                this.addLog(`${this.hero.name} is confused — thwart blocked, confused removed.`, 'status');
                this.hero.confused = false;
                this.discardPlayerCardsFromHand([card.instanceId!]);
            } else {
                // Capture committed resources before clearing (used by paidWithResource condition)
                const paymentResources: string[] = [];
                this.paymentBufferIds.forEach(id => {
                    const c = this.hand.find(cc => cc.instanceId === id);
                    c?.resources?.forEach((r: string) => paymentResources.push(r));
                });
                this.generatedResources.forEach((r: string) => paymentResources.push(r));

                this.discardPlayerCardsFromHand(this.paymentBufferIds);
                this.discardPlayerCardsFromHand([card.instanceId!]);
                this.resetPayment();
                try {
                    await this.executeCardEffect(card as any, { paymentResources });
                } catch (err: any) {
                    if (err?.message !== 'Play cancelled') throw err;
                    this.abortPlay();
                    return;
                }
                this.playSnapshot = null;
            }
        } else if (card.type === 'upgrade' && (card as any).attachmentLocation !== 'tableau') {
            try {
                const targetId = await this.requestTarget(card, (card as any).attachmentLocation!);
                this.attachToTarget(card as any, targetId);
                this.destroyHandCard(card.instanceId!);
            } catch {
                this.addLog('Play cancelled during targeting.', 'system');
                this.abortPlay();
                this.resetPayment();
                this.broadcastStateUpdate();
                return;
            }
        } else {
            const allyLimit = 3 + this.tableauCards.reduce((sum, c) => sum + ((c as any).allyLimitBonus ?? 0), 0);
            if (card.type === 'ally' && this.tableauCards.filter(c => c.type === 'ally').length >= allyLimit) {
                this.addLog(`You cannot have more than ${allyLimit} allies in play.`, 'system');
                this.abortPlay();
                return;
            }
            const tableauCard = this.makeTableauCardFromHand(card.storageId!);
            this.destroyHandCard(card.instanceId!);
            afterPlayCard = tableauCard; // use tableau instance so afterPlay 'self' targets the placed ally
        }

        // Clear payment state before afterPlay effects (e.g. Nick Fury) so that any
        // intermediate broadcasts (requestChoice, requestTarget) don't show phantom
        // resource cards in the payment bar.
        this.pendingCostReduction = 0;
        this.discardPlayerCardsFromHand(this.paymentBufferIds);
        this.resetPayment();

        if ((afterPlayCard as any).logic?.timing === 'afterPlay') await this.executeCardEffect(afterPlayCard as any);

        this.broadcastStateUpdate();
    }

    abortPlay() {
        // Always cancel any pending engine-initiated targeting
        const rejectTarget = this._rejectTargetPromise;
        this._resolveTargetPromise = null;
        this._rejectTargetPromise = null;
        rejectTarget?.(new Error('Play cancelled'));

        if (!this.playSnapshot) {
            this.broadcastStateUpdate();
            return;
        }
        this.hand = this.playSnapshot.hand;
        this.playerDiscardIds = this.playSnapshot.playerDiscardIds;
        this.playSnapshot = null;
        this.activeCardId = null;
        this.paymentBufferIds = [];
        this.generatedResources = [];
        this.addLog('Play cancelled — cards returned to hand.', 'system');
        this.broadcastStateUpdate();
    }

    resetPayment() {
        this.activeCardId = null;
        this.paymentBufferIds = [];
        this.generatedResources = [];
        this.pendingRemoval = null;
        this.pendingCostReduction = 0;
        this.playSnapshot = null;

        if (this._pendingInterruptResolve) {
            const resolve = this._pendingInterruptResolve;
            this._pendingInterruptCard = null;
            this._pendingInterruptPayload = null;
            this._pendingInterruptResolve = null;
            resolve('passed');
        }
    }

    canAfford(card: any): boolean {
        if (!card.cost) return true;
        return (this.hand.length - 1) >= card.cost;
    }

    canAffordInterruptResourceCost(logic: any): boolean {
        const cost: string[] | undefined = logic?.resourceCost;
        if (!cost || cost.length === 0) return true;
        return cost.every((req: string) =>
            this.hand.some((c: any) => c.resources?.includes(req) || c.resources?.includes('wild'))
        );
    }

    async handleAllyDefeat(ally: any) {
        if (!ally || ally.hitPointsRemaining > 0) return;
        const payload = { instanceId: ally.instanceId, name: ally.name, isCanceled: false, sourceCard: ally };
        await this.emitEvent('allyDefeated', payload, async () => {
            if (!payload.isCanceled) this.discardFromTableau(ally.instanceId!);
        });
    }

    discardFromTableau(instanceId: number) {
        const card = this.tableauCards.find(c => c.instanceId === instanceId);
        if (!card) return;
        if (card.storageId) this.playerDiscardIds.push(card.storageId);
        ((card as any).attachments ?? []).forEach((att: any) => {
            if (att.storageId != null) this.playerDiscardIds.push(att.storageId);
        });
        this.tableauCards = this.tableauCards.filter(c => c.instanceId !== instanceId);
        this.addLog(`${card.name} was discarded from the tableau.`, 'discard');
    }

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
        if (logic.type === 'resource' && !this.activeCardId) return;

        const abilityKey = String(instanceId);
        if (logic.limit && (this.abilityUseCounts[abilityKey] ?? 0) >= logic.limit.uses) return;
        if (card.abilityExhausts && card.exhausted) return;
        if (!logic.effects) return;

        const context: any = { sourceCard: card };
        await executeEffects(logic.effects, this, context);

        if (logic.limit) {
            this.abilityUseCounts[abilityKey] = (this.abilityUseCounts[abilityKey] ?? 0) + 1;
            this.abilityResetOn[abilityKey] = logic.limit.resetOn;
        }

        if (this.activeCardId && this.isCostMet) {
            await this.finalizePlay();
        } else {
            this.broadcastStateUpdate();
        }
    }

    async activateCardAbility(instanceId: number) {
        const card = this.tableauCards.find(c => c.instanceId === instanceId);
        if (!card?.logic) return;
        const logic = (card as any).logic;
        const form = logic.formRequired;
        if (form && form !== 'any' && form !== this.hero.identityStatus) {
            this.addLog(`${card.name} requires ${form} form.`, 'system');
            return;
        }

        // Enforce resource cost if defined (e.g. Superhuman Law Division requires mental)
        if (logic.resourceCost && logic.resourceCost.length > 0) {
            const requiredTypes: Resource[] = logic.resourceCost;
            // Wild resources satisfy any typed requirement
            const satisfies = (r: Resource) => requiredTypes.includes(r) || r === 'wild';
            const hasRequired = this.hand.some((c: any) => c.resources?.some(satisfies));
            if (!hasRequired) {
                this.addLog(`${card.name} requires a ${requiredTypes.join('/')} resource — none available in hand.`, 'system');
                this.broadcastStateUpdate();
                return;
            }
            const selectedIds = await this.requestHandDiscard(
                1,
                'RESOURCE COST',
                `Discard a card with a ${requiredTypes.join('/')} resource to pay for ${card.name}.`,
                requiredTypes
            );
            if (!selectedIds || selectedIds.length === 0) return;
            const paidCard = this.hand.find((c: any) => c.instanceId === selectedIds[0]);
            const hasCorrectResource = paidCard?.resources?.some(satisfies);
            if (!hasCorrectResource) {
                this.addLog(`${paidCard?.name ?? 'That card'} doesn't provide the required ${requiredTypes.join('/')} resource.`, 'system');
                this.broadcastStateUpdate();
                return;
            }
            this.hand = this.hand.filter((c: any) => c.instanceId !== selectedIds[0]);
            if (paidCard?.storageId != null) this.playerDiscardIds.push(paidCard.storageId);
            this.addLog(`${paidCard?.name} discarded as ${requiredTypes.join('/')} resource for ${card.name}.`, 'discard');
        }

        const context: any = { sourceCard: card, actionBlocked: false };
        await executeEffects(logic.effects, this, context);
        if (context.actionBlocked) { this.addLog(`${card.name} — action was blocked.`, 'system'); return; }
        this.broadcastStateUpdate();
    }

    // ── Timing windows ────────────────────────────────────────────────────────

    async emitEvent(eventName: string, payload: Record<string, any>, actionFn: () => Promise<void> | void) {
        await this.checkTriggers('interrupt', eventName, payload);
        await actionFn();
        await this.checkTriggers('response', eventName, payload);
    }

    async checkTriggers(timing: string, eventName: string, payload: any) {
        const boardTriggers: any[] = [];
        if (!payload.usedInstanceIds) payload.usedInstanceIds = [];
        if (!payload.usedStorageIds) payload.usedStorageIds = [];

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
            if (payload.isCanceled || payload.isResolved) { windowActive = false; break; }

            const optionalBoard = boardTriggers.filter(c =>
                !c.logic.forced && !c.exhausted &&
                !payload.usedInstanceIds.includes(c.instanceId || 'identity') &&
                this.canAffordInterruptResourceCost(c.logic)
            );
            const seenStorageIds = new Set<number>();
            const handCards = this.hand.filter(card => {
                if (card.type !== 'event') return false;
                if ((card as any).logic?.actionType === 'defense' && payload.isDefended === false) return false;
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
                if (result === 'passed' || result === 'cancel') windowActive = false;
            } else {
                windowActive = false;
            }
        }
    }

    collectIdentityTriggers(timing: string, event: string, list: any[]) {
        const hero = this.playerIdentity;
        if (!hero) return;
        const activeLogic = this.hero.identityStatus === 'hero' ? hero.heroLogic : hero.aeLogic;
        if (activeLogic) {
            const trigger = { ...hero, logic: activeLogic, type: 'identity', imgPath: this.hero.identityStatus === 'hero' ? hero.heroImgPath : hero.imgPath };
            if (this.isValidTrigger(trigger, timing, event)) {
                if (activeLogic.limit) {
                    const key = `identity_${hero.instanceId}`;
                    if ((this.abilityUseCounts[key] ?? 0) >= activeLogic.limit.uses) return;
                }
                list.push(trigger);
            }
        }
    }

    collectTableauTriggers(timing: string, event: string, list: any[]) {
        this.tableauCards.forEach(card => {
            if (this.isValidTrigger(card, timing, event)) list.push(card);
            (card as any).logics?.forEach((logic: any) => {
                const wrapper = { ...card, logic };
                if (this.isValidTrigger(wrapper, timing, event)) list.push(wrapper);
            });
        });
    }

    collectEnemyTriggers(timing: string, event: string, list: any[]) {
        if (this.isValidTrigger(this.villainCard, timing, event)) list.push(this.villainCard);
        this.villainCard?.attachments?.forEach((att: any) => {
            if (this.isValidTrigger(att, timing, event)) list.push(att);
        });
        this.engagedMinions.forEach(minion => {
            if (this.isValidTrigger(minion, timing, event)) list.push(minion);
            (minion.attachments || []).forEach((att: any) => {
                if (this.isValidTrigger(att, timing, event)) list.push(att);
            });
        });
    }

    collectSchemeTriggers(timing: string, event: string, list: any[]) {
        if (this.isValidTrigger(this.mainScheme, timing, event)) list.push(this.mainScheme);
        this.activeSideSchemes.forEach(ss => {
            if (this.isValidTrigger(ss, timing, event)) list.push(ss);
        });
    }

    isValidTrigger(card: any, timing: string, event: string): boolean {
        const logic = card?.logic;
        if (!logic) return false;
        return (
            logic.timing === event &&
            logic.type === timing &&
            (!logic.formRequired || logic.formRequired === 'any' || logic.formRequired === this.hero.identityStatus)
        );
    }

    async handleDefenseStep(payload: any) {
        const defenders: any[] = [];
        if (!this.hero.exhausted) defenders.push({ id: 'hero', name: `Hero (${this.effectiveDef} DEF)` });
        this.tableauCards.filter(c => c.type === 'ally' && !(c as any).exhausted)
            .forEach(ally => defenders.push({ id: ally.instanceId, name: ally.name }));
        if (defenders.length === 0) return;

        const choice = await this.requestChoice("Who will defend this attack?", [
            ...defenders,
            { id: 'none', name: 'No one (Take it undefended)' }
        ]);

        if (choice.id === 'hero') {
            payload.isDefended = true;
            payload.heroDefended = true;
            this.hero.exhausted = true;
            await this.emitEvent('HERO_DEFENDS', payload, async () => {});
        } else if (choice.id !== 'none') {
            payload.isDefended = true;
            payload.targetType = 'ally';
            payload.targetId = choice.id;
            const ally = this.tableauCards.find(c => c.instanceId === choice.id) as Ally | undefined;
            if (ally) {
                await this.emitEvent('ALLY_DEFENDS', { name: ally.name, instanceId: ally.instanceId }, async () => {
                    (ally as any).exhausted = true;
                });
                if (payload.isCanceled) return;
                await this.applyDamageToEntity({ targetId: ally.instanceId!, amount: payload.baseDamage });
            }
        }
    }

    async executeCardEffect(card: any, extraContext: Record<string, any> = {}) {
        if (!card.logic?.effects) return;
        const form = card.logic.formRequired;
        if (form && form !== 'any' && form !== this.hero.identityStatus) {
            this.addLog(`${card.name} requires ${form} form.`, 'system');
            return;
        }
        await executeEffects(card.logic.effects, this, { sourceCard: card, playerForm: this.hero.identityStatus, ...extraContext });
    }

    async applyDamageToEntity(damageData: { targetId: number, amount: number }) {
        const target = this.findTargetById(damageData.targetId);
        if (!target) return;

        if ('tough' in target && target.tough) {
            target.tough = false;
            this.addLog(`${target.name} lost Tough status — damage prevented.`, 'status');
            return;
        }

        const eventName = target === this.villainCard ? 'VILLAIN_TAKES_DAMAGE' : 'ENTITY_DAMAGED';
        const dmgPayload = { targetId: damageData.targetId, amount: damageData.amount, isCanceled: false };

        await this.emitEvent(eventName, dmgPayload, () => {
            if (dmgPayload.isCanceled || dmgPayload.amount <= 0) return;
            target.hitPointsRemaining = Math.max(0, (target.hitPointsRemaining || 0) - dmgPayload.amount);
        });

        if (target === this.villainCard && (this.villainCard.hitPointsRemaining ?? 0) <= 0) {
            await this.handleVillainDefeated();
        }
    }

    async handleVillainDefeated() {
        const current = this.villainCard!;
        const currentIdx = this.villainPhaseChain.indexOf(current.storageId!);
        const nextPhaseId = currentIdx >= 0 ? this.villainPhaseChain[currentIdx + 1] : undefined;

        if (nextPhaseId != null) {
            const nextBlueprint = villainIdCardMap.get(nextPhaseId);
            if (nextBlueprint) {
                this.addLog(`${current.name} Phase ${current.phase} defeated! Flipping to Phase ${current.phase + 1}!`, 'villain');
                this.villainCard = createVillainIdentityCard(nextPhaseId, current.instanceId);
                if (nextBlueprint.toughOnEntry) {
                    this.villainCard.tough = true;
                    this.addLog(`${nextBlueprint.name} Phase ${nextBlueprint.phase} enters with Tough!`, 'status');
                }
                if (nextBlueprint.whenFlipped?.length) await executeEffects(nextBlueprint.whenFlipped, this, {});
                return;
            }
        }

        this.addLog(`${current.name} has been defeated! PLAYER WINS!`, 'villain');
        this.gameOver = 'win';
        this.io.to(this.roomCode).emit('game:over', { outcome: 'win', roundsPlayed: this.roundNumber });
    }

    // ── Async pause patterns (socket round-trips) ─────────────────────────────

    async requestTarget(sourceCard: any, type: string): Promise<number> {
        const validTargetIds = this.getValidTargetIds(type);
        const activeUserId = this.getActiveUserId();
        const socket = this.sockets.get(activeUserId);
        socket?.emit('game:targetingRequired', {
            requestingPlayerId: activeUserId,
            targetPlayerId: activeUserId,
            targetType: type,
            validTargetIds,
        });
        return new Promise((resolve, reject) => {
            this._resolveTargetPromise = resolve;
            this._rejectTargetPromise = reject;
        });
    }

    async requestPlayerInterrupt(event: string, payload: any, playableCards: any[]): Promise<string> {
        const promptId = crypto.randomUUID();
        this._pendingInterruptOptions = playableCards;
        this.activePrompt = {
            id: promptId,
            type: 'INTERRUPT_WINDOW',
            event,
            payload,
            cards: playableCards.map(c => ({ id: c.instanceId ?? c.id, name: c.name, imgPath: c.imgPath, cost: c.cost })),
            eligiblePlayerIds: [this.getActiveUserId()],
            responses: {},
        };
        this.io.to(this.roomCode).emit('game:promptOpen', this.activePrompt);
        this.broadcastStateUpdate();
        return new Promise(resolve => { this._pendingInterruptResolve = resolve; });
    }

    async requestChoice(title: string, options: any[]): Promise<any> {
        const promptId = crypto.randomUUID();
        this.activePrompt = {
            id: promptId,
            type: 'CHOICE_WINDOW',
            event: title,
            payload: {},
            cards: options.map(o => ({ id: o.id, name: o.name, imgPath: o.imgPath })),
            eligiblePlayerIds: [this.getActiveUserId()],
            responses: {},
        };
        this.broadcastStateUpdate();
        return new Promise(resolve => { this._pendingChoiceResolve = resolve; });
    }

    async requestHandDiscard(maxCount: number, title = 'SELECT CARDS', hint = `Select up to ${maxCount} card${maxCount !== 1 ? 's' : ''}.`, resourceFilter?: string[]): Promise<number[] | null> {
        this.pendingHandDiscard = { maxCount, title, hint, ...(resourceFilter ? { resourceFilter } : {}) };
        this.broadcastStateUpdate();
        return new Promise(resolve => { this._pendingHandDiscardResolve = resolve; });
    }

    async requestYesNo(question: string): Promise<boolean> {
        this.pendingYesNo = { question };
        this.broadcastStateUpdate();
        return new Promise<boolean>(resolve => { this._resolveYesNo = resolve; });
    }

    resolveYesNo(accepted: boolean): void {
        const resolve = this._resolveYesNo;
        this._resolveYesNo = null;
        this.pendingYesNo = null;
        resolve?.(accepted);
    }

    // ── Socket event handlers ─────────────────────────────────────────────────

    handleSelectTarget(instanceId: number): void {
        this._resolveTargetPromise?.(instanceId);
        this._resolveTargetPromise = null;
        this._rejectTargetPromise = null;
    }

    handleRespondToPrompt(userId: string, promptId: string, response: PromptResponse): void {
        if (!this.activePrompt || this.activePrompt.id !== promptId) return;

        if (this.activePrompt.type === 'CHOICE_WINDOW') {
            const optionId = response.type === 'select_option' ? response.optionId : 'none';
            const chosen = this.activePrompt.cards.find(o => String(o.id) === String(optionId)) ?? { id: 'none' };
            const resolve = this._pendingChoiceResolve;
            this._pendingChoiceResolve = null;
            this.activePrompt = null;
            this.io.to(this.roomCode).emit('game:promptClose', { promptId });
            resolve?.(chosen);
            return;
        }

        // INTERRUPT_WINDOW
        if (response.type === 'pass') {
            const resolve = this._pendingInterruptResolve;
            this._pendingInterruptResolve = null;
            this._pendingInterruptOptions = [];
            this.activePrompt = null;
            this.io.to(this.roomCode).emit('game:promptClose', { promptId });
            resolve?.('passed');
            return;
        }

        if (response.type === 'play_card') {
            const cardInstanceId = response.cardInstanceId;
            const card = this.hand.find(c => c.instanceId === cardInstanceId)
                      ?? this._pendingInterruptOptions.find((c: any) => (c.instanceId ?? c.id) === cardInstanceId)
                      ?? this.activePrompt.cards.find((c: any) => c.id === cardInstanceId);
            if (!card) return;

            const context = (this.activePrompt.payload ?? {}) as any;
            if (!context.usedInstanceIds) context.usedInstanceIds = [];
            if (!context.usedStorageIds) context.usedStorageIds = [];

            const isEventFromHand = (card as any).type === 'event' && this.hand.some(c => c.instanceId === cardInstanceId);

            if (isEventFromHand && (card as any).cost > 0) {
                // Paid interrupt — enter payment mode
                context.usedInstanceIds.push(cardInstanceId);
                if ((card as any).storageId != null) context.usedStorageIds.push((card as any).storageId);
                context.sourceCard = card;

                this._pendingInterruptCard = card;
                this._pendingInterruptPayload = context;
                // _pendingInterruptResolve stays alive for finalizePlay to call
                this.activePrompt = null;
                this.io.to(this.roomCode).emit('game:promptClose', { promptId });
                this.startPayment(cardInstanceId);
                this.broadcastStateUpdate();
                return;
            }

            // Free play
            const resolve = this._pendingInterruptResolve;
            this._pendingInterruptResolve = null;
            this._pendingInterruptOptions = [];
            this.activePrompt = null;
            this.io.to(this.roomCode).emit('game:promptClose', { promptId });

            context.usedInstanceIds.push(cardInstanceId || 'identity');
            if ((card as any).storageId != null) context.usedStorageIds.push((card as any).storageId);
            context.sourceCard = card;

            const logic = (card as any).logic;

            // Tableau cards with a resource cost (e.g. Black Widow) must pay before executing
            if (!isEventFromHand && logic?.resourceCost?.length > 0) {
                (async () => {
                    const requiredTypes: string[] = logic.resourceCost;
                    const satisfies = (r: string) => requiredTypes.includes(r) || r === 'wild';
                    const selectedIds = await this.requestHandDiscard(
                        1,
                        'RESOURCE COST',
                        `Discard a ${requiredTypes.join('/')} resource card to use ${(card as any).name}.`,
                        requiredTypes
                    );
                    if (!selectedIds || selectedIds.length === 0) {
                        resolve?.('passed');
                        this.broadcastStateUpdate();
                        return;
                    }
                    const paidCard = this.hand.find((c: any) => c.instanceId === selectedIds[0]);
                    if (!paidCard?.resources?.some(satisfies)) {
                        this.addLog(`That card doesn't provide the required resource.`, 'system');
                        resolve?.('passed');
                        this.broadcastStateUpdate();
                        return;
                    }
                    this.hand = this.hand.filter((c: any) => c.instanceId !== selectedIds[0]);
                    if (paidCard?.storageId != null) this.playerDiscardIds.push(paidCard.storageId);
                    this.addLog(`${paidCard?.name} discarded as payment for ${(card as any).name}.`, 'discard');
                    (card as any).exhausted = true;
                    if (logic?.effects) await executeEffects(logic.effects, this, context);
                    resolve?.('played');
                    this.broadcastStateUpdate();
                })().catch(console.error);
                return;
            }

            if (isEventFromHand) this.discardPlayerCardsFromHand([cardInstanceId]);
            else if ((card as any).type !== 'identity') (card as any).exhausted = true;

            // Track ability use count for identity triggers with limits
            if ((card as any).type === 'identity') {
                if (logic?.limit && card.instanceId != null) {
                    const key = `identity_${card.instanceId}`;
                    this.abilityUseCounts[key] = (this.abilityUseCounts[key] ?? 0) + 1;
                    this.abilityResetOn[key] = logic.limit.resetOn;
                }
            }

            if (logic?.effects) {
                executeEffects(logic.effects, this, context)
                    .then(() => { resolve?.('played'); this.broadcastStateUpdate(); })
                    .catch(console.error);
            } else {
                resolve?.('played');
            }
        }
    }

    handleConfirmDiscardSelection(instanceIds: number[]): void {
        if (this.endOfTurnPhase === 'discard') {
            if (instanceIds.length !== this.endOfTurnDiscardCount) return;
            this.discardPlayerCardsFromHand(instanceIds);
            this.endOfTurnSelectedIds = [];
            const resolve = this._endOfTurnResolve;
            this._endOfTurnResolve = null;
            resolve?.();
            this.broadcastStateUpdate();
        } else if (this.endOfTurnPhase === 'mulligan') {
            if (instanceIds.length > 0) {
                this.discardPlayerCardsFromHand(instanceIds);
                for (let i = 0; i < instanceIds.length; i++) this.drawCardFromDeck();
            }
            this.endOfTurnSelectedIds = [];
            this.endOfTurnPhase = null;
            const resolve = this._endOfTurnResolve;
            this._endOfTurnResolve = null;
            resolve?.();
            this.broadcastStateUpdate();
        } else if (this._pendingHandDiscardResolve) {
            const resolve = this._pendingHandDiscardResolve;
            this._pendingHandDiscardResolve = null;
            this.pendingHandDiscard = null;
            this.playSnapshot = null;
            this.broadcastStateUpdate(); // close the overlay immediately on the client
            resolve(instanceIds);
        }
    }

    handleResolveEncounterCard(): void {
        this.resolveCurrentEncounterCard().catch(console.error);
    }

    handleStartAttachmentRemoval(attachmentInstanceId: number, hostId: number): void {
        // Find the attachment by scanning villain + engaged minions
        let attachment: any = null;
        if (this.villainCard?.instanceId === hostId) {
            attachment = this.villainCard.attachments?.find((a: any) => a.instanceId === attachmentInstanceId);
        } else {
            const minion = this.engagedMinions.find(m => m.instanceId === hostId);
            attachment = (minion as any)?.attachments?.find((a: any) => a.instanceId === attachmentInstanceId);
        }
        if (!attachment) return;
        this.startAttachmentRemoval(attachment, hostId);
    }

    handleTableauCardActivation(instanceId: number): void {
        const card = this.tableauCards.find(c => c.instanceId === instanceId);
        if (!card?.logic) return;
        if ((card as any).logic.type === 'resource') {
            this.useResourceAbility(instanceId).catch(console.error);
        } else {
            this.activateCardAbility(instanceId).catch(console.error);
        }
    }
}
