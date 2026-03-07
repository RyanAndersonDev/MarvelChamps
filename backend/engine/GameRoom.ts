import fs from 'fs';
import path from 'path';
import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import type { AuthPayload } from '../types/user';
import type {
    Ally, Event, Upgrade, Support, IdentityCardInstance, VillainIdentityCardInstance,
    MainSchemeInstance, Treachery, Obligation, Attachment, Minion, SideScheme, PlayerCardInstance, Resource
} from '../../shared/types/card';
import type { LogEntry, LogType } from '../../frontend/src/types/log';
import type { GamePhaseType } from '../../shared/types/phases';
import type { ActivePrompt, PlayerGameView, PlayerGameState, PublicPlayerState, GameConfig, PromptResponse } from '../types/game';
import { GamePhase } from '../../shared/types/phases';
import { villainCardMap, villainIdCardMap, villainMainSchemeMap, heroLibrary, standardIIEnvironmentId, standardIIObligationId, cardMap } from '../cards/cardStore';
import {
    createHandCard, createMainSchemeCard, createTableauCard, createVillainCard,
    createVillainIdentityCard, createEngagedMinion, createSideScheme, createIdentityCard
} from '../cards/cardFactory';
import { executeEffects, satisfiesResourceRequirements } from './effectLibrary';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;

interface PlayerSlot {
    userId: string;
    seat: number;
    username: string;
    heroId: number;
    playerIdentity: IdentityCardInstance | null;
    idCardHasFlippedThisTurn: boolean;
    abilityUseCounts: Record<string, number>;
    abilityResetOn: Record<string, string>;
    hand: (Ally | Event | Upgrade | Support)[];
    deckIds: number[];
    playerDiscardIds: number[];
    tableauCards: (Ally | Upgrade | Support)[];
    engagedMinions: Minion[];
    encounterPileIds: number[];
    revealedEncounterCard: (Treachery | Obligation | Attachment | Minion | SideScheme) | null;
    setAsideNemesisIds: number[];
    nemesisMinionStorageId: number | null;
    nemesisSideSchemeStorageId: number | null;
    nemesisSetAdded: boolean;
    obligationCards: Obligation[];   // Drawing Nearer and future obligations live here
}

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

    // ── Per-player slots ──────────────────────────────────────────────────────
    players: Map<string, PlayerSlot> = new Map();
    playerOrder: string[] = [];           // userIds in seat order
    activePlayerIndex: number = 0;        // index into playerOrder for current hero turn
    villainPhaseTargetIndex: number | null = null;  // null during hero turns
    firstPlayerIndex: number = 0;         // index of first-player-token holder
    heroTurnsCompletedThisRound: number = 0;
    pendingPiercingBoost: boolean = false;  // set by makeAttackPiercing boostEffect, consumed in villainActivationAttack
    pendingOverkillBoost: boolean = false;  // set by makeCurrentAttackOverkill boostEffect, consumed in villainActivationAttack

    // ── Proxy getters/setters — delegate to contextual player slot ────────────

    get p(): PlayerSlot {
        const idx = this.villainPhaseTargetIndex ?? this.activePlayerIndex;
        const userId = this.playerOrder[idx];
        if (!userId || !this.players.has(userId))
            throw new Error('No current player slot');
        return this.players.get(userId)!;
    }

    get playerIdentity(): IdentityCardInstance | null { return this.p.playerIdentity; }
    set playerIdentity(v: IdentityCardInstance | null) { this.p.playerIdentity = v; }
    get idCardHasFlippedThisTurn(): boolean { return this.p.idCardHasFlippedThisTurn; }
    set idCardHasFlippedThisTurn(v: boolean) { this.p.idCardHasFlippedThisTurn = v; }
    get abilityUseCounts(): Record<string, number> { return this.p.abilityUseCounts; }
    set abilityUseCounts(v: Record<string, number>) { this.p.abilityUseCounts = v; }
    get abilityResetOn(): Record<string, string> { return this.p.abilityResetOn; }
    set abilityResetOn(v: Record<string, string>) { this.p.abilityResetOn = v; }
    get hand(): (Ally | Event | Upgrade | Support)[] { return this.p.hand; }
    set hand(v: (Ally | Event | Upgrade | Support)[]) { this.p.hand = v; }
    get deckIds(): number[] { return this.p.deckIds; }
    set deckIds(v: number[]) { this.p.deckIds = v; }
    get playerDiscardIds(): number[] { return this.p.playerDiscardIds; }
    set playerDiscardIds(v: number[]) { this.p.playerDiscardIds = v; }
    get tableauCards(): (Ally | Upgrade | Support)[] { return this.p.tableauCards; }
    set tableauCards(v: (Ally | Upgrade | Support)[]) { this.p.tableauCards = v; }
    get engagedMinions(): Minion[] { return this.p.engagedMinions; }
    set engagedMinions(v: Minion[]) { this.p.engagedMinions = v; }
    get encounterPileIds(): number[] { return this.p.encounterPileIds; }
    set encounterPileIds(v: number[]) { this.p.encounterPileIds = v; }
    get revealedEncounterCard(): (Treachery | Obligation | Attachment | Minion | SideScheme) | null { return this.p.revealedEncounterCard; }
    set revealedEncounterCard(v: (Treachery | Obligation | Attachment | Minion | SideScheme) | null) { this.p.revealedEncounterCard = v; }
    get setAsideNemesisIds(): number[] { return this.p.setAsideNemesisIds; }
    set setAsideNemesisIds(v: number[]) { this.p.setAsideNemesisIds = v; }
    get nemesisMinionStorageId(): number | null { return this.p.nemesisMinionStorageId; }
    set nemesisMinionStorageId(v: number | null) { this.p.nemesisMinionStorageId = v; }
    get nemesisSideSchemeStorageId(): number | null { return this.p.nemesisSideSchemeStorageId; }
    set nemesisSideSchemeStorageId(v: number | null) { this.p.nemesisSideSchemeStorageId = v; }
    get nemesisSetAdded(): boolean { return this.p.nemesisSetAdded; }
    set nemesisSetAdded(v: boolean) { this.p.nemesisSetAdded = v; }

    activePrompt: ActivePrompt | null = null;
    activeCardId: number | null = null;
    paymentBufferIds: number[] = [];
    generatedResources: Resource[] = [];
    pendingCostReduction: number = 0;
    pendingRemoval: { attachmentInstanceId: number; hostId: number; cost: number; resourceType?: string; removalCost?: Resource[]; name: string } | null = null;
    playSnapshot: { hand: (Ally | Event | Upgrade | Support)[]; playerDiscardIds: number[]; tableauExhausted: Record<number, boolean>; identityExhausted: boolean } | null = null;
    pendingHandDiscard: { maxCount: number; title: string; hint: string; resourceFilter?: string[] } | null = null;
    boostCard: { storageId: number; boostIcons: number; imgPath: string; name: string } | null = null;
    pendingBoostResponseEffects: any[] = [];
    pendingYesNo: { question: string } | null = null;

    roundNumber: number = 1;
    logIdCounter: number = 0;
    gameLog: LogEntry[] = [];

    // ── Standard II environment card ──────────────────────────────────────────
    activeEnvironmentCard: { storageId: number; name: string; imgPath: string; counters: number; flipped: boolean } | null = null;

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
        return this.getAllEngagedMinions().some(m => m.guard);
    }

    get hasCrisisScheme(): boolean {
        return this.activeSideSchemes.some(ss => ss.crisis);
    }

    // ── Timing helpers ────────────────────────────────────────────────────────

    private delay(ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    }

    // ── Highlight helpers (villain phase animations) ───────────────────────────

    /** Emit a highlight event and hold it for holdMs before returning. */
    private async highlight(entityId: string, type: 'activating' | 'targeted', holdMs: number = 600): Promise<void> {
        this.io.to(this.roomCode).emit('game:highlight', { entityId, type });
        await this.delay(holdMs);
    }

    /** Clear all active highlights. */
    private clearAllHighlights(): void {
        this.io.to(this.roomCode).emit('game:highlight', { entityId: '*', type: 'clear' });
    }

    // ── Broadcast helpers ─────────────────────────────────────────────────────

    broadcastStateUpdate(): void {
        for (const [userId, socket] of this.sockets) {
            socket.emit('game:stateUpdate', this.buildPlayerView(userId));
        }
        if (this.currentPhase === 'PLAYER_TURN') this.saveSnapshot();
    }

    buildPlayerView(userId: string): PlayerGameView {
        const slot = this.players.get(userId);
        if (!slot) throw new Error(`No player slot for ${userId}`);

        const myState: PlayerGameState = {
            userId,
            seat: slot.seat,
            identity: slot.playerIdentity,
            idCardHasFlippedThisTurn: slot.idCardHasFlippedThisTurn,
            hand: slot.hand,
            deckIds: slot.deckIds,
            playerDiscardIds: slot.playerDiscardIds,
            tableau: slot.tableauCards,
            engagedMinions: slot.engagedMinions,
            encounterPileIds: slot.encounterPileIds,
            revealedEncounterCard: slot.revealedEncounterCard,
            abilityUseCounts: slot.abilityUseCounts,
            abilityResetOn: slot.abilityResetOn,
            obligations: slot.obligationCards,
        };

        const otherPlayers: PublicPlayerState[] = [];
        for (const [otherId, otherSlot] of this.players) {
            if (otherId === userId) continue;
            otherPlayers.push({
                userId: otherId,
                username: otherSlot.username,
                seat: otherSlot.seat,
                identity: otherSlot.playerIdentity,
                hand: otherSlot.hand,
                handCount: otherSlot.hand.length,
                deckCount: otherSlot.deckIds.length,
                playerDiscardIds: otherSlot.playerDiscardIds,
                tableau: otherSlot.tableauCards,
                engagedMinions: otherSlot.engagedMinions,
                encounterPileCount: otherSlot.encounterPileIds.length,
                revealedEncounterCard: otherSlot.revealedEncounterCard,
                obligations: otherSlot.obligationCards,
            });
        }
        otherPlayers.sort((a, b) => a.seat - b.seat);

        const activeUserId = this.playerOrder[this.activePlayerIndex] ?? userId;
        const villainTargetId = this.villainPhaseTargetIndex !== null
            ? (this.playerOrder[this.villainPhaseTargetIndex] ?? null) : null;
        const isActivePlayer = userId === activeUserId;
        const isVillainTarget = userId === villainTargetId;

        return {
            roomId: this.roomCode,
            myUserId: userId,
            currentPhase: this.currentPhase,
            activePlayerId: activeUserId,
            villainPhaseTargetId: villainTargetId,
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
                environmentCard: this.activeEnvironmentCard,
            },
            myState,
            otherPlayers,
            activePrompt: (isVillainTarget || (isActivePlayer && villainTargetId === null)) ? this.activePrompt : null,
            activeCardId: isActivePlayer ? this.activeCardId : null,
            paymentBufferIds: isActivePlayer ? this.paymentBufferIds : [],
            generatedResources: isActivePlayer ? this.generatedResources : [],
            pendingCostReduction: isActivePlayer ? this.pendingCostReduction : 0,
            pendingRemoval: isActivePlayer ? this.pendingRemoval : null,
            endOfTurnPhase: isActivePlayer ? this.endOfTurnPhase : null,
            pendingHandDiscard: isActivePlayer ? this.pendingHandDiscard : null,
            villainPhaseChain: this.villainPhaseChain,
            pendingYesNo: (isVillainTarget || (isActivePlayer && villainTargetId === null))
                ? this.pendingYesNo : null,
            gameLog: this.gameLog,
        };
    }

    getActiveUserId(): string {
        return this.playerOrder[this.villainPhaseTargetIndex ?? this.activePlayerIndex]
            ?? this.sockets.keys().next().value
            ?? '';
    }

    getAllEngagedMinions(): Minion[] {
        const all: Minion[] = [];
        for (const slot of this.players.values()) all.push(...slot.engagedMinions);
        return all;
    }

    getValidTargetIds(type: string): number[] {
        if (type === 'enemy') {
            const ids: number[] = [];
            if (this.villainCard && !this.hasGuardMinion) ids.push(this.villainCard.instanceId);
            this.getAllEngagedMinions().forEach(m => ids.push(m.instanceId));
            return ids;
        }
        if (type === 'enemy-ignore-guard') {
            const ids: number[] = [];
            if (this.villainCard) ids.push(this.villainCard.instanceId);
            this.getAllEngagedMinions().forEach(m => ids.push(m.instanceId));
            return ids;
        }
        if (type === 'minion') {
            return this.getAllEngagedMinions().map(m => m.instanceId);
        }
        if (type === 'villain') {
            return this.villainCard ? [this.villainCard.instanceId] : [];
        }
        if (type === 'ally') {
            const ids: number[] = [];
            for (const slot of this.players.values())
                (slot.tableauCards.filter(c => c.type === 'ally') as Ally[]).forEach(c => ids.push(c.instanceId!));
            return ids;
        }
        if (type === 'friendly') {
            const ids: number[] = [];
            for (const slot of this.players.values()) {
                if (slot.playerIdentity) ids.push(slot.playerIdentity.instanceId);
                (slot.tableauCards.filter(c => c.type === 'ally') as Ally[]).forEach(a => ids.push(a.instanceId!));
            }
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
        // Reset shared state
        this.currentPhase = 'PLAYER_TURN';
        this.gameOver = null;
        this.accelerationTokens = 0;
        this.villainCard = null;
        this.mainScheme = null;
        this.villainDeckIds = [];
        this.villainDiscardIds = [];
        this.activeSideSchemes = [];
        this.activeCardId = null;
        this.paymentBufferIds = [];
        this.generatedResources = [];
        this.boostCard = null;
        this.pendingBoostResponseEffects = [];
        this.activeEnvironmentCard = null;
        this.roundNumber = 1;
        this.gameLog = [];
        this.logIdCounter = 0;
        this.activePlayerIndex = 0;
        this.villainPhaseTargetIndex = null;
        this.firstPlayerIndex = 0;
        this.heroTurnsCompletedThisRound = 0;

        // Build player slots in seat order
        const sorted = [...config.players].sort((a, b) => a.seat - b.seat);
        this.playerOrder = sorted.map(p => p.userId);
        this.players = new Map();

        let initIdCounter = 0;
        const extraObligationIds: number[] = [];

        for (const player of sorted) {
            const heroEntry = heroLibrary.find(h => h.id === player.heroId);
            const ns = heroEntry?.nemesisSet;
            const slot: PlayerSlot = {
                userId: player.userId,
                seat: player.seat,
                username: player.username,
                heroId: player.heroId,
                playerIdentity: createIdentityCard(player.heroId, ++initIdCounter),
                idCardHasFlippedThisTurn: false,
                abilityUseCounts: {},
                abilityResetOn: {},
                hand: [],
                deckIds: [...player.deckIds],
                playerDiscardIds: [],
                tableauCards: [],
                engagedMinions: [],
                encounterPileIds: [],
                revealedEncounterCard: null,
                setAsideNemesisIds: ns
                    ? [ns.minionStorageId, ns.sideSchemeStorageId, ...ns.otherStorageIds]
                    : [],
                nemesisMinionStorageId: ns?.minionStorageId ?? null,
                nemesisSideSchemeStorageId: ns?.sideSchemeStorageId ?? null,
                nemesisSetAdded: false,
                obligationCards: [],
            };
            this.shufflePile(slot.deckIds);
            if (ns) this.addLog(`${heroEntry!.name} nemesis set aside.`, 'system');
            const obligationId = (heroEntry as any)?.obligationId;
            if (obligationId != null) {
                extraObligationIds.push(obligationId);
                this.addLog(`${heroEntry!.name}'s obligation shuffled into the encounter deck.`, 'system');
            }
            this.players.set(player.userId, slot);
        }

        // Villain setup
        this.villainCard = createVillainIdentityCard(config.villainId, ++initIdCounter);
        this.mainScheme = createMainSchemeCard(config.mainSchemeId, ++initIdCounter);
        this.villainPhaseChain = [...config.villainPhaseChain];
        this.villainDeckIds = [...config.villainDeckIds, ...extraObligationIds];
        this.shufflePile(this.villainDeckIds);

        // Standard II: place environment in play; give each player a Drawing Nearer obligation
        if (config.standardSet === 'II') {
            const envBp = villainCardMap.get(standardIIEnvironmentId);
            this.activeEnvironmentCard = {
                storageId: standardIIEnvironmentId,
                name: envBp?.name ?? 'Pursued by the Past',
                imgPath: envBp?.imgPath ?? '',
                counters: 0,
                flipped: false,
            };
            this.addLog('Pursued by the Past enters play (Side A).', 'villain');

            // One Drawing Nearer per player shuffled into the encounter deck
            for (const slot of this.players.values()) {
                this.villainDeckIds.push(standardIIObligationId);
                this.addLog(`${slot.username} — Drawing Nearer shuffled into encounter deck.`, 'system');
            }
            this.shufflePile(this.villainDeckIds);
        } else {
            this.activeEnvironmentCard = null;
        }

        this.idIncrementer = initIdCounter;

        // Draw initial hands — use activePlayerIndex to context-switch per player
        for (let i = 0; i < this.playerOrder.length; i++) {
            this.activePlayerIndex = i;
            this.drawToHandSize();
        }
        this.activePlayerIndex = 0;

        // Setup effects per player (e.g. Colossus searches for Organic Steel)
        for (let i = 0; i < this.playerOrder.length; i++) {
            this.activePlayerIndex = i;
            const setupFx = this.hero.setupEffects;
            if (setupFx?.length) {
                this.addLog(`${this.hero.name} — Setup:`, 'system');
                await executeEffects(setupFx, this, {});
            }
        }
        this.activePlayerIndex = 0;

        // When-revealed effects
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
            // ── End-of-turn cleanup for current active player ─────────────────────
            if (this.endOfTurnDiscardCount > 0) {
                this.endOfTurnSelectedIds = [];
                this.endOfTurnPhase = 'discard';
                this.broadcastStateUpdate();
                await new Promise<void>(resolve => { this._endOfTurnResolve = resolve; });
                this.endOfTurnPhase = null;
            }

            if (this.hand.length > 0) {
                this.endOfTurnSelectedIds = [];
                this.endOfTurnPhase = 'mulligan';
                this.broadcastStateUpdate();
                await new Promise<void>(resolve => { this._endOfTurnResolve = resolve; });
                this.endOfTurnPhase = null;
            }

            this.clearTemporaryAllyMods();
            this.resetAbilityLimits('turn');
            this.heroTurnsCompletedThisRound++;

            // ── If more heroes still need to go, pass to next player ──────────────
            if (this.heroTurnsCompletedThisRound < this.playerOrder.length) {
                this.activePlayerIndex = (this.firstPlayerIndex + this.heroTurnsCompletedThisRound) % this.playerOrder.length;
                this.readyActivePlayerCards();
                this.p.idCardHasFlippedThisTurn = false;
                this.currentPhase = GamePhase.PLAYER_TURN;
                this.broadcastStateUpdate();
                await this.processObligationTurnStart();
                return;
            }

            // ── All heroes done — villain phase ───────────────────────────────────
            const n = this.playerOrder.length;

            // Draw new hands for all players now (deferred so teammates can't see
            // next-turn hands during other players' hero turns)
            for (let i = 0; i < n; i++) {
                this.activePlayerIndex = (this.firstPlayerIndex + i) % n;
                this.drawToHandSize();
            }
            this.activePlayerIndex = this.firstPlayerIndex;

            // Ready all cards before villain phase — heroes must be fresh so they
            // can choose to defend. (Marvel Champions: ready step opens the villain phase.)
            this.readyAllCards();

            // Step 1: Main scheme threat — once
            this.currentPhase = GamePhase.VILLAIN_STEP_1_THREAT;
            this.broadcastStateUpdate();
            await this.delay(400);
            await this.processMainSchemeStepOne();

            // Step 2: Villain activates against each player (first-player order)
            this.currentPhase = GamePhase.VILLAIN_STEP_2_ACTIVATION;
            for (let i = 0; i < n; i++) {
                this.villainPhaseTargetIndex = (this.firstPlayerIndex + i) % n;
                this.broadcastStateUpdate();
                await this.delay(400);
                await this.processVillainActivation();
            }

            // Step 3: Minion activations against each player
            this.currentPhase = GamePhase.VILLAIN_STEP_3_MINIONS;
            for (let i = 0; i < n; i++) {
                this.villainPhaseTargetIndex = (this.firstPlayerIndex + i) % n;
                this.broadcastStateUpdate();
                await this.delay(400);
                await this.processMinionActivations();
            }

            // Step 4: Deal encounter cards
            // Base 1 card to each player, then hazard extras starting from first player
            this.currentPhase = GamePhase.VILLAIN_STEP_4_DEAL;
            const hazardCount = this.activeSideSchemes.filter(ss => ss.hazard).length;
            for (let i = 0; i < n; i++) {
                this.villainPhaseTargetIndex = (this.firstPlayerIndex + i) % n;
                this.broadcastStateUpdate();
                await this.delay(400);
                await this.dealEncounterCards();
            }
            for (let i = 0; i < hazardCount; i++) {
                this.villainPhaseTargetIndex = (this.firstPlayerIndex + i) % n;
                this.broadcastStateUpdate();
                await this.delay(400);
                await this.dealExtraEncounterCard();
            }

            // Step 5: Reveal encounter cards for each player in order
            for (let i = 0; i < n; i++) {
                this.villainPhaseTargetIndex = (this.firstPlayerIndex + i) % n;
                this.currentPhase = GamePhase.VILLAIN_STEP_5_REVEAL;
                while (this.p.encounterPileIds.length > 0) {
                    this.drawEncounterCardFromPlayerPile();
                    await this.highlight('encounter-zone', 'targeted', 400);
                    this.broadcastStateUpdate();
                    await new Promise<void>(r => { this._resolveEncounterCardPromise = r; });
                    this.clearAllHighlights();
                }
            }
            this.villainPhaseTargetIndex = null;

            await this.checkTriggers('response', 'roundEnd', {});

            // ── Advance first player token and start new round ────────────────────
            this.firstPlayerIndex = (this.firstPlayerIndex + 1) % this.playerOrder.length;
            this.heroTurnsCompletedThisRound = 0;
            this.activePlayerIndex = this.firstPlayerIndex;
            this.roundNumber++;
            this.addLog(`--- Round ${this.roundNumber} ---`, 'phase');

            this.currentPhase = GamePhase.PLAYER_TURN;
            this.resetAbilityLimits('round');
            this.p.idCardHasFlippedThisTurn = false;
            this.broadcastStateUpdate();
            await this.processObligationTurnStart();
        }
    }

    // ── Villain phase steps ───────────────────────────────────────────────────

    async processMainSchemeStepOne() {
        await this.highlight('villain', 'activating', 700);
        await this.highlight('main-scheme', 'targeted', 500);
        const base = this.mainScheme!.threatIncrementIsPerPlayer
            ? this.mainScheme!.threatIncrement * this.playerOrder.length
            : this.mainScheme!.threatIncrement;
        const sideSchemeAcceleration = this.activeSideSchemes.filter(ss => ss.acceleration).length;
        const amount = base + this.accelerationTokens + sideSchemeAcceleration;
        await this.applyThreatToMainScheme({ amount, source: 'step_one', isCanceled: false });
        this.clearAllHighlights();
    }

    async processVillainActivation() {
        if (this.hero.identityStatus === 'alter-ego') {
            // Confused blocks scheming (alter-ego activations)
            if (this.villainCard?.confused) {
                this.addLog(`${this.villainCard.name} is confused — scheme skipped, confused removed.`, 'status');
                this.villainCard.confused = false;
                return;
            }
            await this.highlight('villain', 'activating', 700);
            await this.highlight('main-scheme', 'targeted', 500);
            const accelerationBonus = this.activeSideSchemes.filter(ss => ss.acceleration).length;
            const payload = {
                attacker: this.villainCard?.name || 'Villain',
                baseThreat: (this.villainCard?.sch || 0) + accelerationBonus,
                boostThreat: 0, isCanceled: false
            };
            await this.villainActivationScheme(payload);
            this.clearAllHighlights();
        } else {
            // Stunned blocks attacking (hero activations)
            if (this.villainCard?.stunned) {
                this.addLog(`${this.villainCard.name} is stunned — attack skipped, stun removed.`, 'status');
                this.villainCard.stunned = false;
                return;
            }
            await this.highlight('villain', 'activating', 700);
            await this.highlight('hero', 'targeted', 500);
            const atkBonus = (this.villainCard?.attachments || [])
                .reduce((sum, att) => sum + ((att as Attachment).atkMod || 0), 0);
            const payload = {
                attacker: this.villainCard?.name || 'Villain',
                source: this.villainCard,
                baseDamage: (this.villainCard?.atk || 0) + atkBonus,
                boostDamage: 0, isDefended: false,
                targetType: 'identity', targetId: 'hero',
                isCanceled: false,
                overkill: (this.villainCard?.attachments || []).some(att => (att as Attachment).overkill)
            };
            await this.villainActivationAttack(payload);
            this.clearAllHighlights();
        }
    }

    async flipBoostCard(): Promise<number> {
        const cardId = this.drawOneVillainCard();
        if (cardId === null) return 0;

        const blueprint = villainCardMap.get(cardId);
        const amplifyBonus = this.activeSideSchemes.filter(ss => (ss as any).amplify).length;
        const boostIcons = (blueprint?.boostIcons ?? 0) + amplifyBonus;

        this.boostCard = { storageId: cardId, boostIcons, imgPath: blueprint?.imgPath ?? '', name: blueprint?.name ?? 'Unknown' };
        this.io.to(this.roomCode).emit('game:boostCardFlipped', this.boostCard);

        this.broadcastStateUpdate();

        await this.emitEvent('BOOST_CARD_DRAWN', { cardId, boostIcons }, async () => {});
        await this.emitEvent('BOOST_CARD_REVEALED', { cardId, boostIcons }, async () => {});

        // Hold the boost card visible for players to see before continuing
        await new Promise(resolve => setTimeout(resolve, 2500));

        this.villainDiscardIds.push(cardId);
        this.boostCard = null;

        const boostContext: any = { boostCardId: cardId };
        if (blueprint?.boostEffect?.length) {
            await executeEffects(blueprint.boostEffect, this, boostContext);
        }

        if (boostContext.revealBoostCardAsEncounterCard) {
            const idx = this.villainDiscardIds.indexOf(cardId);
            if (idx !== -1) this.villainDiscardIds.splice(idx, 1);
            this.encounterPileIds.push(cardId);
            this.addLog(`${blueprint?.name ?? 'Card'} — revealed as an encounter card!`, 'villain');
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
        // Boost response effects only fire after attacks; discard them after a scheme activation.
        this.pendingBoostResponseEffects = [];
    }

    async applyThreatToMainScheme(threatPayload: any) {
        await this.emitEvent('MAIN_SCHEME_THREAT', threatPayload, async () => {
            if (threatPayload.isCanceled) return;
            this.mainScheme!.threatRemaining += threatPayload.amount;
            await this.emitEvent('THREAT_PLACED', threatPayload, async () => {
                if (this.mainScheme!.threatRemaining >= this.mainScheme!.threatThreshold * this.playerOrder.length) {
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
            this.deleteSnapshot();
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

            attackPayload.boostDamage = attackPayload.skipBoost ? 0 : await this.flipBoostCard();
            const extraBoostCount = attackPayload.skipBoost ? 0 : (attackPayload.extraBoostCards ?? 0);
            for (let i = 0; i < extraBoostCount; i++) {
                attackPayload.boostDamage += await this.flipBoostCard();
            }
            attackPayload.isPiercing = this.pendingPiercingBoost;
            this.pendingPiercingBoost = false;
            if (this.pendingOverkillBoost) {
                attackPayload.overkill = true;
                this.pendingOverkillBoost = false;
            }

            let reduction = 0;
            if (attackPayload.isDefended && attackPayload.targetType === 'identity')
                reduction = this.effectiveDef + (attackPayload.defBonus ?? 0);

            const finalDamage = Math.max(0, attackPayload.baseDamage + (attackPayload.boostDamage ?? 0) - reduction);

            if (attackPayload.targetType === 'identity') {
                if (finalDamage > 0) {
                    const damagePayload = { amount: finalDamage, isCanceled: false, targetId: this.hero.instanceId, isDefended: attackPayload.isDefended ?? false, isPiercing: attackPayload.isPiercing };
                    await this.emitEvent('takeIdentityDamage', damagePayload, async () => {
                        if (damagePayload.isCanceled || damagePayload.amount <= 0) return;
                        await this.applyDamageToEntity(damagePayload);
                        attackPayload.damageWasDealt = true;
                    });
                }
            } else if (attackPayload.targetType === 'ally') {
                const ally = this.tableauCards.find(c => c.instanceId === attackPayload.targetId) as Ally | undefined;
                const allyHpBefore = ally?.hitPointsRemaining ?? 0;
                const damagePayload = { amount: finalDamage, isCanceled: false, targetId: attackPayload.targetId, isPiercing: attackPayload.isPiercing };
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

    // ── Standard II: Pursued by the Past ─────────────────────────────────────

    /** Add N pursuit counters and trigger the threshold check. */
    async addPursuitCounters(count: number) {
        const env = this.activeEnvironmentCard;
        if (!env || env.flipped) return;
        env.counters += count;
        this.addLog(`Pursued by the Past — +${count} pursuit counter${count !== 1 ? 's' : ''} (${env.counters} total).`, 'villain');
        this.broadcastStateUpdate();
        await this.checkPursuitThreshold();
    }

    /** Check if the counter threshold (numPlayers+3) has been reached and process. */
    async checkPursuitThreshold() {
        const env = this.activeEnvironmentCard;
        if (!env || env.flipped) return;
        const threshold = this.playerOrder.length + 3;
        if (env.counters < threshold) return;

        const removed = env.counters;
        env.counters = 0;
        this.addLog(`Pursued by the Past — threshold reached (${removed} counters ≥ ${threshold})! Counters removed.`, 'villain');

        // Is the current player's nemesis minion already in play?
        const slot = this.p;
        const nemId = slot.nemesisMinionStorageId;
        const nemesisInPlay = nemId !== null &&
            slot.engagedMinions.some(m => m.storageId === nemId);

        if (nemesisInPlay) {
            const minion = slot.engagedMinions.find(m => m.storageId === nemId)!;
            this.addLog(`${minion.name} is in play — it activates against ${slot.username}!`, 'villain');
            if (this.hero.identityStatus === 'alter-ego') {
                await this.minionActivationScheme(minion);
            } else {
                await this.minionActivationAttack(minion);
            }
        } else {
            await this.flipEnvironmentToSideB();
        }
    }

    /** Flip Pursued by the Past to Side B, resolve its effect, then flip back to Side A. */
    async flipEnvironmentToSideB() {
        const env = this.activeEnvironmentCard;
        if (!env) return;

        // Flip to Side B
        const sideBBp = villainCardMap.get(standardIIEnvironmentId + 1);
        env.storageId = standardIIEnvironmentId + 1;
        env.name = sideBBp?.name ?? 'Pursued by the Past';
        env.imgPath = sideBBp?.imgPath ?? '';
        env.flipped = true;
        this.addLog('Pursued by the Past — flipped to Side B!', 'villain');
        this.broadcastStateUpdate();

        // Side B effect: reveal nemesis minion, reveal nemesis side scheme, shuffle remainder
        const slot = this.p;
        if (!slot.nemesisSetAdded) {
            slot.nemesisSetAdded = true;
            const nemMinionId = slot.nemesisMinionStorageId;
            if (nemMinionId !== null) {
                const minionIdx = slot.setAsideNemesisIds.indexOf(nemMinionId);
                if (minionIdx !== -1) {
                    slot.setAsideNemesisIds.splice(minionIdx, 1);
                    const minionCard = createVillainCard(nemMinionId, this.getNextId());
                    const minionBp = villainCardMap.get(nemMinionId);
                    this.addLog(`${minionBp?.name ?? 'Nemesis minion'} revealed — enters play!`, 'villain');
                    await this.handleMinionEntry(minionCard);
                }
            }
            const nemSSId = slot.nemesisSideSchemeStorageId;
            if (nemSSId !== null) {
                const ssIdx = slot.setAsideNemesisIds.indexOf(nemSSId);
                if (ssIdx !== -1) {
                    slot.setAsideNemesisIds.splice(ssIdx, 1);
                    const ssCard = createVillainCard(nemSSId, this.getNextId());
                    const ssBp = villainCardMap.get(nemSSId);
                    this.addLog(`${ssBp?.name ?? 'Nemesis side scheme'} revealed!`, 'villain');
                    await this.handleSideSchemeEntry(ssCard);
                }
            }
            if (slot.setAsideNemesisIds.length > 0) {
                this.villainDeckIds.push(...slot.setAsideNemesisIds);
                this.shufflePile(this.villainDeckIds);
                this.addLog(`${slot.setAsideNemesisIds.length} nemesis card(s) shuffled into the encounter deck.`, 'villain');
                slot.setAsideNemesisIds = [];
            }
        }

        // Flip back to Side A immediately
        const sideABp = villainCardMap.get(standardIIEnvironmentId);
        env.storageId = standardIIEnvironmentId;
        env.name = sideABp?.name ?? 'Pursued by the Past';
        env.imgPath = sideABp?.imgPath ?? '';
        env.flipped = false;
        this.addLog('Pursued by the Past — flipped back to Side A.', 'villain');
        this.broadcastStateUpdate();
    }

    /** Drawing Nearer: fire at the start of the active player's hero turn. */
    async processObligationTurnStart() {
        for (const obligation of this.p.obligationCards) {
            if (obligation.storageId !== standardIIObligationId) continue;
            if (this.deckIds.length === 0) {
                this.addLog('Drawing Nearer — no cards in deck.', 'villain');
                continue;
            }
            const topCardId = this.deckIds.shift()!;
            this.playerDiscardIds.unshift(topCardId);
            const bp = cardMap.get(topCardId);
            const resourceCount = bp?.resources?.length ?? 0;
            this.addLog(
                `Drawing Nearer — discarded ${bp?.name ?? 'card'} (${resourceCount} resource icon${resourceCount !== 1 ? 's' : ''}). +${resourceCount} pursuit counter${resourceCount !== 1 ? 's' : ''}.`,
                'villain',
            );
            if (resourceCount > 0) {
                await this.addPursuitCounters(resourceCount);
            }
        }
        this.broadcastStateUpdate();
    }

    async processMinionActivations() {
        for (const minion of this.engagedMinions) {
            if (this.hero.identityStatus === 'alter-ego') {
                if (minion.confused) {
                    this.addLog(`${minion.name} is confused — scheme skipped, confused removed.`, 'status');
                    minion.confused = false;
                    continue;
                }
                await this.minionActivationScheme(minion);
            } else {
                if (minion.stunned) {
                    this.addLog(`${minion.name} is stunned — attack skipped, stun removed.`, 'status');
                    minion.stunned = false;
                    continue;
                }
                await this.minionActivationAttack(minion);
            }
        }
    }

    async minionActivationScheme(minion: Minion) {
        await this.highlight(String(minion.instanceId), 'activating', 700);
        await this.highlight('main-scheme', 'targeted', 500);
        const payload = { attacker: minion.name, attackerId: minion.instanceId, baseThreat: minion.sch, isCanceled: false };
        await this.emitEvent('MINION_SCHEME', payload, async () => {
            if (payload.isCanceled) return;
            await this.applyThreatToMainScheme({ amount: payload.baseThreat, source: 'minion_scheme', isCanceled: false });
            await this.emitEvent('MINION_SCHEME_CONCLUDED', payload, async () => {});
        });
        this.clearAllHighlights();
    }

    async minionActivationAttack(minion: Minion) {
        await this.highlight(String(minion.instanceId), 'activating', 700);
        await this.highlight('hero', 'targeted', 500);
        const baseDamage = minion.dynamicAtk === 'hitPointsRemaining' ? minion.hitPointsRemaining : minion.atk;
        const minionBp = villainCardMap.get(minion.storageId!);
        const isPiercing = minionBp?.piercing === true;
        const attackPayload = {
            attacker: minion.name, attackerId: minion.instanceId, source: minion, baseDamage,
            isDefended: false, targetType: 'identity', targetId: 'hero',
            isCanceled: false, damageWasDealt: false, defBonus: 0, isPiercing,
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
            if (attackPayload.targetType === 'identity') {
                if (finalDamage > 0) {
                    const damagePayload = { amount: finalDamage, isCanceled: false, targetId: this.hero.instanceId, isDefended: attackPayload.isDefended ?? false, isPiercing: attackPayload.isPiercing };
                    await this.emitEvent('takeIdentityDamage', damagePayload, async () => {
                        if (damagePayload.isCanceled || damagePayload.amount <= 0) return;
                        await this.applyDamageToEntity(damagePayload);
                        attackPayload.damageWasDealt = true;
                    });
                }
            } else if (attackPayload.targetType === 'ally') {
                const ap = attackPayload as any;
                const ally = this.tableauCards.find(c => c.instanceId === ap.targetId) as Ally | undefined;
                const allyHpBefore = ally?.hitPointsRemaining ?? 0;
                const damagePayload = { amount: finalDamage, isCanceled: false, targetId: ap.targetId as number, isPiercing: ap.isPiercing };
                await this.emitEvent('takeAllyDamage', damagePayload, async () => {
                    if (damagePayload.isCanceled || damagePayload.amount <= 0) return;
                    await this.applyDamageToEntity(damagePayload);
                    attackPayload.damageWasDealt = true;
                });
                if (ap.overkill && ally) {
                    const excess = finalDamage - allyHpBefore;
                    if (excess > 0) {
                        this.addLog(`Overkill! ${excess} excess damage dealt to hero.`, 'damage');
                        await this.applyDamageToEntity({ targetId: this.hero.instanceId, amount: excess });
                    }
                }
                if (ally && ally.hitPointsRemaining <= 0) await this.handleAllyDefeat(ally);
            }

            await this.emitEvent('MINION_ATTACK_CONCLUDED', attackPayload, async () => {});
        });

        if (attackPayload.defBonus && !attackPayload.damageWasDealt) {
            this.hero.exhausted = false;
            this.addLog(`${this.hero.name} readied — no damage taken (Desperate Defense).`, 'status');
        }
        this.clearAllHighlights();
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
        await this.highlight('encounter-zone', 'activating', 600);
        const payload = { count: 1, isCanceled: false };
        await this.emitEvent('DEAL_ENCOUNTER_CARDS', payload, async () => {
            if (payload.isCanceled) return;
            for (let i = 0; i < payload.count; i++) {
                const cardId = this.drawOneVillainCard();
                if (cardId !== null) {
                    this.encounterPileIds.push(cardId);
                    this.addLog(`Dealt 1 encounter card to ${this.p.username}.`, 'villain');
                }
            }
        });
        this.clearAllHighlights();
    }

    async dealExtraEncounterCard() {
        const cardId = this.drawOneVillainCard();
        if (cardId !== null) {
            this.encounterPileIds.push(cardId);
            const hazardNames = this.activeSideSchemes.filter(ss => ss.hazard).map(ss => ss.name);
            this.addLog(`${hazardNames[0] ?? 'Hazard'} dealt an extra encounter card to ${this.p.username}.`, 'villain');
        }
    }

    readyAllCards() {
        for (const slot of this.players.values()) {
            if (slot.playerIdentity) slot.playerIdentity.exhausted = false;
            for (const card of slot.tableauCards) (card as any).exhausted = false;
        }
    }

    readyActivePlayerCards() {
        const slot = this.players.get(this.playerOrder[this.activePlayerIndex]);
        if (!slot) return;
        if (slot.playerIdentity) slot.playerIdentity.exhausted = false;
        for (const card of slot.tableauCards) (card as any).exhausted = false;
    }

    clearTemporaryAllyMods() {
        // Only clears the contextual player's mods — called at end of their turn
        const slot = this.p;
        slot.tableauCards.forEach(card => {
            if (card.type === 'ally') {
                const ally = card as any;
                if (ally.attachments) ally.attachments = ally.attachments.filter((att: any) => !att.temporary);
            }
        });
        if (slot.playerIdentity) {
            (slot.playerIdentity as any).tempAtkMod = 0;
            (slot.playerIdentity as any).tempThwMod = 0;
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

        if (target.type === 'main-scheme' && this.hasCrisisScheme && !(ally as any).ignoresCrisis) {
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

        if (target.type === 'villain' && this.hasGuardMinion && !(ally as any).ignoresGuard) {
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
        const minion = this.getAllEngagedMinions().find(m => m.instanceId === targetId);
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
        // Drawing Nearer — place it in the current player's tableau (not resolved like a normal obligation)
        if (card.storageId === standardIIObligationId) {
            const bp = villainCardMap.get(standardIIObligationId);
            const obligInstance: Obligation = {
                instanceId: this.getNextId(),
                storageId: standardIIObligationId,
                name: bp?.name ?? 'Drawing Nearer',
                imgPath: bp?.imgPath ?? '',
                type: 'obligation' as const,
                side: 'villain' as const,
                boostIcons: bp?.boostIcons ?? 2,
                tags: [],
                flavorText: '',
            };
            this.p.obligationCards.push(obligInstance);
            this.addLog(`${this.p.username} — Drawing Nearer placed in tableau.`, 'villain');
            return;
        }

        // Find which player OWNS this obligation (by heroLibrary.obligationId match)
        const ownerHeroEntry = heroLibrary.find(h => (h as any).obligationId === card.storageId);
        const ownerSlot = ownerHeroEntry
            ? [...this.players.values()].find(s => s.heroId === ownerHeroEntry.id)
            : null;
        const ownerIndex = ownerSlot
            ? this.playerOrder.indexOf(ownerSlot.userId)
            : (this.villainPhaseTargetIndex ?? this.activePlayerIndex);

        // Temporarily redirect all prompts and effects to the obligation owner
        const savedTargetIndex = this.villainPhaseTargetIndex;
        this.villainPhaseTargetIndex = ownerIndex;

        if (ownerSlot) {
            this.addLog(`${card.name} — obligation for ${ownerSlot.username}.`, 'villain');
        }

        // Offer the owner a chance to flip to alter-ego first
        if (this.hero.identityStatus === 'hero' && !this.idCardHasFlippedThisTurn) {
            const wantsFlip = await this.requestYesNo(`Flip ${this.hero.name} to alter-ego form?`);
            if (wantsFlip) {
                await this.flipIdentity();
            }
        }

        // Execute obligation effects (chooseOne: exhaust to remove OR suffer consequence)
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

        // Restore original villain-phase target
        this.villainPhaseTargetIndex = savedTargetIndex;
    }

    async handleMinionEntry(card: any, opts?: { fromBoost?: boolean }) {
        const minion = createEngagedMinion(card.storageId, this.getNextId());
        this.engagedMinions.push(minion);
        const minionContext: any = { minion, sourceCard: minion, surge: 0 };
        if (!opts?.fromBoost && minion.logic?.effects)
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

        // Scale starting threat by player count (factory used * 1 as placeholder)
        if (blueprint?.startingThreatIsPerPlayer) {
            sideScheme.threatRemaining *= this.playerOrder.length;
        }

        const payload = { sideScheme, isCanceled: false };

        await this.emitEvent('SIDE_SCHEME_ENTERING', payload, async () => {
            if (payload.isCanceled) return;
            if (blueprint?.whenRevealedThreat) {
                const extra = blueprint.whenRevealedThreatIsPerPlayer
                    ? blueprint.whenRevealedThreat * this.playerOrder.length
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

        if (blueprint?.attachmentTag) {
            const allMinions = this.getAllEngagedMinions();
            const tagged = allMinions.find(m => {
                const mbp = villainCardMap.get(m.storageId!);
                return mbp?.tags?.includes(blueprint.attachmentTag!);
            });
            const attachTarget = tagged ?? null;
            if (attachTarget) {
                const attachment = createVillainCard(card.storageId, this.getNextId());
                attachTarget.attachments.push(attachment as any);
                this.addLog(`${card.name} attached to ${attachTarget.name}.`, 'villain');
                return;
            }
            // Fall through to villain if no tagged minion found
        }

        if (blueprint?.attachmentTarget === 'highestAtkEnemy') {
            // Gather all enemies (villain + all engaged minions) that don't already have an Unstoppable
            const candidates: { entity: any; atk: number }[] = [];
            if (this.villainCard) {
                const hasOne = (this.villainCard.attachments ?? []).some((a: any) => a.storageId === card.storageId);
                if (!hasOne) {
                    const bp = villainIdCardMap.get(this.villainCard.storageId!);
                    candidates.push({ entity: this.villainCard, atk: bp?.atk ?? this.villainCard.atk ?? 0 });
                }
            }
            for (const minion of this.getAllEngagedMinions()) {
                const hasOne = (minion.attachments ?? []).some((a: any) => a.storageId === card.storageId);
                if (!hasOne) {
                    const bp = villainCardMap.get(minion.storageId!);
                    candidates.push({ entity: minion, atk: bp?.atk ?? minion.atk ?? 0 });
                }
            }
            if (candidates.length === 0) {
                this.addLog(`${card.name} — no valid target found. Surge!`, 'surge');
                this.drawFromVillainDeckAsEncounterCard();
                if (card.storageId != null) this.villainDiscardIds.push(card.storageId);
                return;
            }
            const best = candidates.reduce((a, b) => b.atk > a.atk ? b : a);
            const attachment = createVillainCard(card.storageId, this.getNextId());
            best.entity.attachments = best.entity.attachments ?? [];
            best.entity.attachments.push(attachment);
            this.addLog(`${card.name} attached to ${best.entity.name}.`, 'villain');
            return;
        }

        if (blueprint?.attachmentTarget === 'highestHpMinion') {
            const allMinions = this.getAllEngagedMinions();
            if (allMinions.length === 0) {
                this.addLog(`${card.name} — no minions in play. Surge!`, 'surge');
                this.drawFromVillainDeckAsEncounterCard();
                if (card.storageId != null) this.villainDiscardIds.push(card.storageId);
                return;
            }
            const target = allMinions.reduce((best, m) => {
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
        // Search across all player slots for the minion
        let minion: Minion | undefined;
        let ownerSlot: PlayerSlot | undefined;
        for (const slot of this.players.values()) {
            minion = slot.engagedMinions.find(m => m.instanceId === instanceIdToDc);
            if (minion) { ownerSlot = slot; break; }
        }
        if (!minion || !ownerSlot) { this.addLog(`Could not find minion with id ${instanceIdToDc} to discard.`, 'system'); return; }

        await this.emitEvent('MINION_DEFEATED', { minion }, async () => {
            if (minion!.attachments && minion!.attachments.length > 0) {
                for (const att of minion!.attachments.filter((a: any) => a.side === 'player')) {
                    await this.emitEvent('attachedDefeated', { attachment: att, minion, sourceCard: att, isCanceled: false }, async () => {});
                }
                minion!.attachments.forEach((card: any) => {
                    // Attachment discards go to the owner's discard
                    const dest = card.type === 'upgrade' ? ownerSlot!.playerDiscardIds : this.villainDiscardIds;
                    if (card.storageId) dest.push(card.storageId);
                });
            }
            if (minion!.storageId) this.villainDiscardIds.push(minion!.storageId);
            ownerSlot!.engagedMinions = ownerSlot!.engagedMinions.filter(m => m.instanceId !== instanceIdToDc);
            this.addLog(`${minion!.name} has been removed from the board.`, 'discard');
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
        return this.getAllEngagedMinions().find(m => m.instanceId === id) as Minion;
    }

    findSchemeById(id: number): MainSchemeInstance | SideScheme {
        if (this.mainScheme && this.mainScheme.instanceId === id) return this.mainScheme;
        return this.activeSideSchemes.find(s => s.instanceId === id) as SideScheme;
    }

    findTargetById(instanceId: number): IdentityCardInstance | VillainIdentityCardInstance | Minion | Ally | undefined {
        if (this.villainCard?.instanceId === instanceId) return this.villainCard;
        // Search all player slots
        for (const slot of this.players.values()) {
            if (slot.playerIdentity?.instanceId === instanceId) return slot.playerIdentity;
            const minion = slot.engagedMinions.find(m => m.instanceId === instanceId);
            if (minion) return minion;
            const ally = slot.tableauCards.find(a => a.instanceId === instanceId && a.type === 'ally');
            if (ally) return ally as Ally;
        }
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
        const targetMinion = this.getAllEngagedMinions().find(m => m.instanceId === targetId);
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
        const logic = this.hero.identityStatus === 'hero' ? (this.hero as any).heroLogic : (this.hero as any).aeLogic;
        if (logic?.type === 'action') {
            await this.activateIdentityAction(logic);
        } else {
            await this.useResourceAbility('identity');
        }
        this.broadcastStateUpdate();
    }

    async activateIdentityAction(logic: any) {
        const card = this.playerIdentity!;
        const abilityKey = 'identity';
        if (logic.limit && (this.abilityUseCounts[abilityKey] ?? 0) >= logic.limit.uses) {
            this.addLog(`${card.name} — ability limit reached.`, 'system');
            return;
        }
        const exhausts = this.hero.identityStatus === 'hero'
            ? (card as any).heroAbilityExhausts !== false
            : (card as any).aeAbilityExhausts !== false;
        if (exhausts && card.exhausted) {
            this.addLog(`${card.name} is exhausted.`, 'system');
            return;
        }
        if (logic.resourceCost?.length > 0) {
            const requiredTypes: string[] = logic.resourceCost;
            const anyType = requiredTypes.includes('any');
            const satisfies = anyType
                ? (r: string) => !!r
                : (r: string) => requiredTypes.includes(r) || r === 'wild';
            const hasRequired = this.hand.some((c: any) => c.resources?.length > 0);
            if (!hasRequired) {
                this.addLog(`${card.name} requires a resource — no cards with resources in hand.`, 'system');
                return;
            }
            const selectedIds = await this.requestHandDiscard(
                1, 'RESOURCE COST',
                `Discard any card as a resource to pay for ${card.name}.`,
                anyType ? undefined : requiredTypes
            );
            if (!selectedIds || selectedIds.length === 0) return;
            const paidCard = this.hand.find((c: any) => c.instanceId === selectedIds[0]);
            if (!paidCard) return;
            if (!anyType && !paidCard?.resources?.some(satisfies)) {
                this.addLog(`That card doesn't provide the required resource.`, 'system');
                return;
            }
            this.hand = this.hand.filter((c: any) => c.instanceId !== selectedIds[0]);
            if (paidCard.storageId != null) this.playerDiscardIds.push(paidCard.storageId);
            this.addLog(`${paidCard.name} discarded as resource for ${card.name}.`, 'discard');
        }
        const ctx: any = { sourceCard: card };
        await executeEffects(logic.effects, this, ctx);
        if (exhausts && !ctx.actionBlocked) card.exhausted = true;
        if (logic.limit) {
            this.abilityUseCounts[abilityKey] = (this.abilityUseCounts[abilityKey] ?? 0) + 1;
            this.abilityResetOn[abilityKey] = logic.limit.resetOn;
        }
    }

    resetAbilityLimits(resetOn: string) {
        // 'turn' resets only apply to the current active player's slot.
        // 'round' resets apply to all players.
        const slots = resetOn === 'turn'
            ? [this.p]
            : [...this.players.values()];
        for (const slot of slots) {
            for (const key in slot.abilityResetOn) {
                if (slot.abilityResetOn[key] === resetOn) {
                    delete slot.abilityUseCounts[key];
                    delete slot.abilityResetOn[key];
                }
            }
        }
    }

    async flipIdentity() {
        if (this.idCardHasFlippedThisTurn) return;
        const wasHero = this.hero.identityStatus === 'hero';
        this.hero.identityStatus = wasHero ? 'alter-ego' : 'hero';
        this.idCardHasFlippedThisTurn = true;
        if (!wasHero) await this.checkTriggers('response', 'FLIP_TO_HERO', {});
        if (wasHero)  await this.checkTriggers('response', 'FLIP_TO_AE',   {});
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

        const attackPayload: any = { targetId: id, isCanceled: false, targetDefeated: false, bonusDamage: 0, overkill: false };
        await this.emitEvent('BASIC_ATTACK', attackPayload, async () => {
            if (attackPayload.isCanceled) return;
            const totalDmg = atkAmt + (attackPayload.bonusDamage ?? 0);
            if (attackPayload.bonusDamage > 0) this.addLog(`+${attackPayload.bonusDamage} bonus → ${totalDmg} total!`, 'play');
            await this.applyDamageToEntity({ targetId: id, amount: totalDmg });
            const retaliateAmt = this.getRetaliateAmount(id);
            if (retaliateAmt > 0) {
                this.addLog(`Retaliate ${retaliateAmt}! ${this.hero.name} takes ${retaliateAmt} damage.`, 'damage');
                await this.applyDamageToEntity({ targetId: this.hero.instanceId, amount: retaliateAmt });
            }
            const target = this.findTargetById(id);
            if (target && 'type' in target && target.type === 'minion') {
                if ((target as Minion).hitPointsRemaining <= 0) {
                    attackPayload.targetDefeated = true;
                    const overflow = Math.abs((target as Minion).hitPointsRemaining);
                    await this.discardFromEngagedMinions((target as Minion).instanceId);
                    if (attackPayload.overkill && overflow > 0 && this.villainCard) {
                        this.addLog(`Overkill! ${overflow} excess damage to ${this.villainCard.name}.`, 'play');
                        await this.applyDamageToEntity({ targetId: this.villainCard.instanceId, amount: overflow });
                    }
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
        const minion = this.getAllEngagedMinions().find(m => m.instanceId === hostId);
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
        const tableauExhausted: Record<number, boolean> = {};
        for (const c of this.tableauCards) {
            if (c.instanceId != null) tableauExhausted[c.instanceId] = !!(c as any).exhausted;
        }
        this.playSnapshot = {
            hand: JSON.parse(JSON.stringify(this.hand)),
            playerDiscardIds: [...this.playerDiscardIds],
            tableauExhausted,
            identityExhausted: !!(this.playerIdentity as any)?.exhausted,
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

                // Save snapshot before resetPayment clears it (needed for cancel/block restore)
                const savedSnapshot = this.playSnapshot;
                const returnsPayment = !!(card as any).returnPaymentOnSuccess;
                if (!returnsPayment) this.discardPlayerCardsFromHand(this.paymentBufferIds);
                this.discardPlayerCardsFromHand([card.instanceId!]);
                this.resetPayment();
                let ctx: Record<string, any>;
                try {
                    ctx = await this.executeCardEffect(card as any, { paymentResources });
                } catch (err: any) {
                    if (err?.message !== 'Play cancelled') throw err;
                    this.playSnapshot = savedSnapshot;
                    this.abortPlay();
                    return;
                }
                if (ctx.actionBlocked) {
                    this.playSnapshot = savedSnapshot;
                    this.abortPlay();
                    return;
                }
                this.playSnapshot = null;
                // Fire response window for attack-tagged events so cards like Chase Them Down trigger
                if ((card as any).tags?.includes('attack')) {
                    await this.checkTriggers('response', 'HERO_ATTACK_EVENT_RESOLVED', ctx);
                }
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
        for (const c of this.tableauCards) {
            if (c.instanceId != null && c.instanceId in this.playSnapshot.tableauExhausted)
                (c as any).exhausted = this.playSnapshot.tableauExhausted[c.instanceId];
        }
        if (this.playerIdentity) (this.playerIdentity as any).exhausted = this.playSnapshot.identityExhausted;
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
        if (card.abilityExhausts) card.exhausted = true;

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
        if ((card as any).abilityExhausts && (card as any).exhausted) {
            this.addLog(`${card.name} is exhausted.`, 'system');
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
                `Discard a card with a ${requiredTypes.join('/')} or wild resource to pay for ${card.name}.`,
                [...requiredTypes, 'wild' as Resource]
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
        if ((card as any).abilityExhausts) (card as any).exhausted = true;
        this.broadcastStateUpdate();
    }

    playFromQuiver(cardInstanceId: number) {
        if (this.currentPhase !== 'PLAYER_TURN') return;
        const quiver = this.tableauCards.find((c: any) => c.storageId === 67) as any;
        if (!quiver?.attachedCards?.length) return;
        const idx = quiver.attachedCards.findIndex((c: any) => c.instanceId === cardInstanceId);
        if (idx === -1) return;

        // Validate the Bow before starting payment — arrow stays in Quiver if Bow can't be exhausted
        const bow = this.tableauCards.find((c: any) => c.storageId === 66) as any;
        if (!bow) {
            this.addLog("Hawkeye's Bow is not in play — cannot play arrow events.", 'system');
            this.broadcastStateUpdate();
            return;
        }
        if (bow.exhausted) {
            this.addLog("Hawkeye's Bow is already exhausted — ready it first.", 'system');
            this.broadcastStateUpdate();
            return;
        }

        const [card] = quiver.attachedCards.splice(idx, 1);
        this.hand.push(card);
        this.addLog(`${card.name} pulled from Hawkeye's Quiver.`, 'play');
        this.startPayment(card.instanceId);
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
                !c.logic.forced &&
                (!c.abilityExhausts || !c.exhausted) &&
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
        const isHeroForm = this.hero.identityStatus === 'hero';
        const activeLogic = isHeroForm ? hero.heroLogic : hero.aeLogic;
        if (activeLogic) {
            // Only treat the identity as "exhausted" for trigger eligibility if the
            // ability itself exhausts the card. Attacking/thwarting exhausts the hero
            // but should NOT block triggered responses (e.g. Spider-Man drawing a card
            // when attacked). heroAbilityExhausts: false means always available.
            const abilityExhausts = isHeroForm
                ? (hero as any).heroAbilityExhausts !== false
                : (hero as any).aeAbilityExhausts !== false;
            const trigger = {
                ...hero,
                logic: activeLogic,
                type: 'identity',
                imgPath: isHeroForm ? hero.heroImgPath : hero.imgPath,
                exhausted: abilityExhausts && hero.exhausted,
            };
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
            att.logics?.forEach((logic: any) => {
                const wrapper = { ...att, logic };
                if (this.isValidTrigger(wrapper, timing, event)) list.push(wrapper);
            });
        });
        this.getAllEngagedMinions().forEach(minion => {
            if (this.isValidTrigger(minion, timing, event)) list.push(minion);
            (minion.attachments || []).forEach((att: any) => {
                if (this.isValidTrigger(att, timing, event)) list.push(att);
                att.logics?.forEach((logic: any) => {
                    const wrapper = { ...att, logic };
                    if (this.isValidTrigger(wrapper, timing, event)) list.push(wrapper);
                });
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
        const timingMatches = Array.isArray(logic.timing)
            ? logic.timing.includes(event)
            : logic.timing === event;
        return (
            timingMatches &&
            logic.type === timing &&
            (!logic.formRequired || logic.formRequired === 'any' || logic.formRequired === this.hero.identityStatus)
        );
    }

    async handleDefenseStep(payload: any) {
        const defenders: any[] = [];
        if (!this.hero.exhausted) defenders.push({ id: 'hero', name: `Hero (${this.effectiveDef} DEF)`, imgPath: this.hero.heroImgPath ?? this.hero.imgPath });
        this.tableauCards.filter(c => c.type === 'ally' && !(c as any).exhausted)
            .forEach(ally => defenders.push({ id: ally.instanceId, name: ally.name, imgPath: (ally as any).imgPath }));
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

    async executeCardEffect(card: any, extraContext: Record<string, any> = {}): Promise<Record<string, any>> {
        const ctx = { sourceCard: card, playerForm: this.hero.identityStatus, actionBlocked: false, ...extraContext };
        if (!card.logic?.effects) return ctx;
        const form = card.logic.formRequired;
        if (form && form !== 'any' && form !== this.hero.identityStatus) {
            this.addLog(`${card.name} requires ${form} form.`, 'system');
            return ctx;
        }
        await executeEffects(card.logic.effects, this, ctx);
        return ctx;
    }

    async applyDamageToEntity(damageData: { targetId: number, amount: number, isPiercing?: boolean }) {
        const target = this.findTargetById(damageData.targetId);
        if (!target) return;

        if ('tough' in target && target.tough) {
            target.tough = false;
            if (damageData.isPiercing) {
                this.addLog(`${target.name} lost Tough status — Piercing damage still applies!`, 'status');
            } else {
                this.addLog(`${target.name} lost Tough status — damage prevented.`, 'status');
                return;
            }
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
        this.deleteSnapshot();
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
            const minion = this.getAllEngagedMinions().find(m => m.instanceId === hostId);
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

    // ── Persistence ───────────────────────────────────────────────────────────

    serialize(): object {
        return {
            roomCode:                   this.roomCode,
            currentPhase:               this.currentPhase,
            endOfTurnPhase:             this.endOfTurnPhase,
            endOfTurnSelectedIds:       this.endOfTurnSelectedIds,
            gameOver:                   this.gameOver,
            accelerationTokens:         this.accelerationTokens,
            idIncrementer:              this.idIncrementer,
            villainCard:                this.villainCard,
            mainScheme:                 this.mainScheme,
            villainPhaseChain:          this.villainPhaseChain,
            villainDeckIds:             this.villainDeckIds,
            villainDiscardIds:          this.villainDiscardIds,
            activeSideSchemes:          this.activeSideSchemes,
            players:                    Array.from(this.players.values()),
            playerOrder:                this.playerOrder,
            activePlayerIndex:          this.activePlayerIndex,
            firstPlayerIndex:           this.firstPlayerIndex,
            heroTurnsCompletedThisRound: this.heroTurnsCompletedThisRound,
            villainPhaseTargetIndex:    this.villainPhaseTargetIndex,
            activePrompt:               this.activePrompt,
            activeCardId:               this.activeCardId,
            paymentBufferIds:           this.paymentBufferIds,
            generatedResources:         this.generatedResources,
            pendingCostReduction:       this.pendingCostReduction,
            pendingRemoval:             this.pendingRemoval,
            boostCard:                  this.boostCard,
            pendingBoostResponseEffects: this.pendingBoostResponseEffects,
            pendingYesNo:               this.pendingYesNo,
            roundNumber:                this.roundNumber,
            logIdCounter:               this.logIdCounter,
            gameLog:                    this.gameLog,
            activeEnvironmentCard:      this.activeEnvironmentCard,
        };
    }

    saveSnapshot(): void {
        const dir = path.resolve(__dirname, '../../snapshots');
        try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(
                path.join(dir, `${this.roomCode}.json`),
                JSON.stringify(this.serialize()),
            );
        } catch (err) {
            console.error(`[snapshot] Failed to save ${this.roomCode}:`, err);
        }
    }

    deleteSnapshot(): void {
        const file = path.resolve(__dirname, `../../snapshots/${this.roomCode}.json`);
        try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* ignore */ }
    }

    static restoreFromSnapshot(snapshot: any, io: GameServer): GameRoom {
        const room = new GameRoom(io, snapshot.roomCode);
        room.currentPhase               = snapshot.currentPhase               ?? 'PLAYER_TURN';
        room.endOfTurnPhase             = snapshot.endOfTurnPhase              ?? null;
        room.endOfTurnSelectedIds       = snapshot.endOfTurnSelectedIds        ?? [];
        room.gameOver                   = snapshot.gameOver                    ?? null;
        room.accelerationTokens         = snapshot.accelerationTokens          ?? 0;
        room.idIncrementer              = snapshot.idIncrementer               ?? 0;
        room.villainCard                = snapshot.villainCard                 ?? null;
        room.mainScheme                 = snapshot.mainScheme                  ?? null;
        room.villainPhaseChain          = snapshot.villainPhaseChain           ?? [];
        room.villainDeckIds             = snapshot.villainDeckIds              ?? [];
        room.villainDiscardIds          = snapshot.villainDiscardIds           ?? [];
        room.activeSideSchemes          = snapshot.activeSideSchemes           ?? [];
        room.playerOrder                = snapshot.playerOrder                 ?? [];
        room.activePlayerIndex          = snapshot.activePlayerIndex           ?? 0;
        room.firstPlayerIndex           = snapshot.firstPlayerIndex            ?? 0;
        room.heroTurnsCompletedThisRound = snapshot.heroTurnsCompletedThisRound ?? 0;
        room.villainPhaseTargetIndex    = snapshot.villainPhaseTargetIndex     ?? null;
        room.activePrompt               = snapshot.activePrompt                ?? null;
        room.activeCardId               = snapshot.activeCardId                ?? null;
        room.paymentBufferIds           = snapshot.paymentBufferIds            ?? [];
        room.generatedResources         = snapshot.generatedResources          ?? [];
        room.pendingCostReduction       = snapshot.pendingCostReduction        ?? 0;
        room.pendingRemoval             = snapshot.pendingRemoval              ?? null;
        room.boostCard                  = snapshot.boostCard                   ?? null;
        room.pendingBoostResponseEffects = snapshot.pendingBoostResponseEffects ?? [];
        room.pendingYesNo               = snapshot.pendingYesNo                ?? null;
        room.roundNumber                = snapshot.roundNumber                 ?? 1;
        room.logIdCounter               = snapshot.logIdCounter                ?? 0;
        room.gameLog                    = snapshot.gameLog                     ?? [];
        room.activeEnvironmentCard      = snapshot.activeEnvironmentCard       ?? null;

        room.players = new Map();
        for (const slot of (snapshot.players ?? [])) {
            if (slot.obligationCards === undefined) slot.obligationCards = [];
            room.players.set(slot.userId, slot as PlayerSlot);
        }

        return room;
    }
}
