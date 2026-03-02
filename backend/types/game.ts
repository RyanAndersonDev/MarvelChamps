/**
 * game.ts — Server-side authoritative game state model.
 *
 * KEY DESIGN PRINCIPLES
 * ─────────────────────
 * 1. Server owns all mutable game state. Clients receive read-only snapshots.
 * 2. Instance IDs are assigned by the server's global idIncrementer so they are
 *    unique across all players in a room.
 * 3. A player's hand is private. The server sends each client their own full
 *    hand but sends only a count to other players (PublicPlayerState).
 * 4. The villain phase loops over each player in playerOrder sequentially.
 *    villainPhaseTargetIndex tracks who is currently being targeted.
 * 5. Interrupt windows are multiplayer-aware: any eligible player may respond.
 *    The server collects all responses before resolving.
 */

import type {
    IdentityCardInstance,
    VillainIdentityCardInstance,
    MainSchemeInstance,
    SideScheme,
    Minion,
    Treachery,
    Obligation,
    Attachment,
    Ally,
    Event,
    Upgrade,
    Support,
    Resource,
} from '../../shared/types/card';
import type { GamePhaseType } from '../../shared/types/phases';
import type { LogEntry } from '../../frontend/src/types/log';
import type { UserPublic } from './user';

// ─── Setup / Config ───────────────────────────────────────────────────────────

/**
 * Everything needed to initialise a GameRoomState.
 * Produced by the lobby when all players are ready and the host starts the game.
 */
export interface GameConfig {
    roomId: string;
    players: PlayerConfig[];
    /** storageId of the first villain phase card */
    villainId: number;
    mainSchemeId: number;
    /** Full, pre-shuffled villain + encounter + standard + expert card IDs */
    villainDeckIds: number[];
    /** [phase1VillainId, phase2VillainId, ...] */
    villainPhaseChain: number[];
    expertMode: boolean;
}

export interface PlayerConfig {
    userId: string;
    /** 0-indexed. Determines the hero-turn order (seat 0 goes first). */
    seat: number;
    heroId: number;
    aspect: string;
    /** Ordered list of storageIds for this player's deck. */
    deckIds: number[];
}

// ─── Shared Board State (visible to all players) ──────────────────────────────

/**
 * The parts of the game board that every player can see at all times.
 */
export interface SharedBoardState {
    villain: VillainIdentityCardInstance | null;
    mainScheme: MainSchemeInstance | null;
    activeSideSchemes: SideScheme[];
    /** Cards remaining in the villain/encounter deck (IDs sent for peek; length = count). */
    villainDeckIds: number[];
    /** Villain discard pile — visible to all. */
    villainDiscardIds: number[];
    /** +1 permanent threat per round when villain deck is exhausted. */
    accelerationTokens: number;
    /** The currently-animating boost card, null otherwise. */
    boostCard: BoostCardDisplay | null;
}

export interface BoostCardDisplay {
    storageId: number;
    boostIcons: number;
    imgPath: string;
    name: string;
}

// ─── Per-Player State ─────────────────────────────────────────────────────────

/**
 * Complete state for one player. Stored on the server; the hand is never sent
 * to other players' clients — use PublicPlayerState for that.
 */
export interface PlayerGameState {
    userId: string;
    seat: number;

    // Identity
    identity: IdentityCardInstance | null;
    /** Prevents flipping more than once per turn. */
    idCardHasFlippedThisTurn: boolean;

    // Private zones (sent only to this player's client)
    hand: (Ally | Event | Upgrade | Support)[];
    /** Ordered storageIds — full card data reconstructed from blueprints on read. */
    deckIds: number[];

    // Public zones (visible to all players)
    playerDiscardIds: number[];
    tableau: (Ally | Upgrade | Support)[];
    /**
     * Minions currently engaged to THIS player specifically.
     * In multiplayer, each minion is engaged to exactly one player.
     */
    engagedMinions: Minion[];

    // Per-player encounter zone (dealt to this player during villain step 4)
    /** storageIds of encounter cards queued for this player to reveal. */
    encounterPileIds: number[];
    /** The card this player is currently in the process of resolving. */
    revealedEncounterCard: (Treachery | Obligation | Attachment | Minion | SideScheme) | null;

    // Ability tracking
    abilityUseCounts: Record<string, number>;
    abilityResetOn: Record<string, string>;
}

// ─── Interrupt / Prompt System ────────────────────────────────────────────────

/**
 * An open interrupt or decision window that one or more players can respond to.
 *
 * MULTIPLAYER BEHAVIOUR:
 * When an interrupt window opens, the server emits this prompt to all
 * eligiblePlayerIds. Each must either play a card or pass. The engine resumes
 * once all eligible players have responded (or a timeout fires).
 *
 * For DEFENSE_CHOICE and CHOICE_WINDOW only the targeted player responds.
 */
export interface ActivePrompt {
    id: string;
    type: 'INTERRUPT_WINDOW' | 'DEFENSE_CHOICE' | 'CHOICE_WINDOW';
    event: string;
    payload: Record<string, unknown>;
    /** Cards / options the player(s) can select. Mirrors the current activePrompt shape. */
    cards: PromptOption[];
    /** Which players may respond. Empty = no one (auto-resolve). */
    eligiblePlayerIds: string[];
    /** Responses collected so far: userId → their choice */
    responses: Record<string, PromptResponse>;
}

export interface PromptOption {
    id: number | string;
    name: string;
    imgPath?: string;
    cost?: number;
    instanceId?: number;
}

export type PromptResponse =
    | { type: 'pass' }
    | { type: 'play_card'; cardInstanceId: number }
    | { type: 'select_option'; optionId: string };

// ─── Turn / Phase State ───────────────────────────────────────────────────────

/**
 * End-of-turn hand management state for the active player.
 * Only relevant during that player's hero turn.
 */
export interface EndOfTurnState {
    phase: 'discard' | 'mulligan' | null;
    selectedIds: number[];
}

// ─── Complete Server-Side Room State ─────────────────────────────────────────

/**
 * The authoritative game state owned entirely by the server.
 * Never sent to clients wholesale — use buildPlayerView() to produce a
 * personalised snapshot for each client.
 */
export interface GameRoomState {
    roomId: string;
    status: 'in_progress' | 'completed';

    // ── Turn order ──
    /** userId array in seat order. Index 0 goes first. */
    playerOrder: string[];
    /** Index into playerOrder for the current hero turn. */
    activePlayerIndex: number;

    // ── Phase ──
    currentPhase: GamePhaseType;
    /**
     * During the villain phase, tracks which player is currently being
     * targeted (step 2 villain activation, step 3 minion activations,
     * step 4/5 encounter cards). null during player turns.
     */
    villainPhaseTargetIndex: number | null;

    // ── Shared board ──
    board: SharedBoardState;

    // ── Players ──
    /** Indexed by userId for O(1) lookup. */
    playerStates: Record<string, PlayerGameState>;

    // ── Active prompt (interrupt / defense / choice window) ──
    activePrompt: ActivePrompt | null;

    // ── Per-active-player transient payment state ──
    /**
     * The instanceId of the card currently being paid for.
     * null when no payment is in progress.
     */
    activeCardId: number | null;
    /** instanceIds of hand cards committed as resources for the current payment. */
    paymentBufferIds: number[];
    /** Resources generated by card abilities (not from committing cards). */
    generatedResources: Resource[];
    /** Cost reduction applied to the next card play (e.g. Nick Fury). */
    pendingCostReduction: number;
    /**
     * Snapshot of hand + discard taken at startPayment; restored on abortPlay.
     * Stored server-side so it cannot be tampered with.
     */
    playSnapshot: { hand: (Ally | Event | Upgrade | Support)[]; playerDiscardIds: number[] } | null;

    // ── Attachment removal ──
    pendingRemoval: {
        attachmentInstanceId: number;
        hostId: number;
        cost: number;
        resourceType?: string;
        name: string;
    } | null;

    // ── Villain deck ──
    /** All storageIds still in the villain/encounter draw pile. */
    villainDeckIds: number[];
    /** Phase chain: [phase1VillainStorageId, phase2Id, ...] */
    villainPhaseChain: number[];

    // ── Round tracking ──
    roundNumber: number;
    /** Global incrementing ID. All card instances in the room share this counter. */
    idIncrementer: number;

    // ── Outcome ──
    gameOver: null | 'win' | 'lose';

    // ── Log ──
    gameLog: LogEntry[];
    logIdCounter: number;
}

// ─── Client-Facing Snapshots ──────────────────────────────────────────────────

/**
 * A redacted view of one player sent to their *teammates*.
 * The hand is replaced with a count; the deck is replaced with a count.
 */
export interface PublicPlayerState {
    userId: string;
    username: string;
    seat: number;
    identity: IdentityCardInstance | null;
    /** How many cards are in this player's hand (not the cards themselves). */
    handCount: number;
    deckCount: number;
    playerDiscardIds: number[];
    tableau: (Ally | Upgrade | Support)[];
    engagedMinions: Minion[];
    encounterPileCount: number;
    revealedEncounterCard: (Treachery | Attachment | Minion | SideScheme) | null;
}

/**
 * The personalised game snapshot sent to one specific client after every state
 * change. Contains their full private state + redacted views of all others.
 *
 * The frontend Pinia store will be updated wholesale from this object whenever
 * the server emits game:stateUpdate.
 */
export interface PlayerGameView {
    roomId: string;
    myUserId: string;
    currentPhase: GamePhaseType;
    /** userId of the player whose hero turn it currently is. */
    activePlayerId: string;
    /**
     * During the villain phase, the userId of the player currently being
     * targeted by villains/minions/encounter cards. null during hero turns.
     */
    villainPhaseTargetId: string | null;
    roundNumber: number;
    gameOver: null | 'win' | 'lose';

    // Shared board (complete)
    board: SharedBoardState;

    // This player's full private state
    myState: PlayerGameState;

    // All other players' public (redacted) state, ordered by seat
    otherPlayers: PublicPlayerState[];

    // Active prompt for this player (null if no prompt, or if another player
    // has the prompt but this one does not)
    activePrompt: ActivePrompt | null;

    // Payment state (only meaningful for the active player)
    activeCardId: number | null;
    paymentBufferIds: number[];
    generatedResources: Resource[];
    pendingCostReduction: number;
    pendingRemoval: GameRoomState['pendingRemoval'];

    // End-of-turn hand management (non-null only during the active player's EOT flow)
    endOfTurnPhase: null | 'discard' | 'mulligan';
    pendingHandDiscard: { maxCount: number; title: string; hint: string; resourceFilter?: string[] } | null;

    /** Phase chain for the current villain — used by the client to look up villain color/theme. */
    villainPhaseChain: number[];

    /** Non-null when the player must answer a yes/no question before the engine continues. */
    pendingYesNo: { question: string } | null;

    gameLog: LogEntry[];
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

/**
 * Pre-game lobby state. Broadcast to all players in the room while waiting
 * for everyone to select their hero and be ready.
 */
export interface LobbyRoom {
    id: string;
    /** Short human-readable join code, e.g. "HERO-42". */
    code: string;
    hostUserId: string;
    status: 'lobby' | 'in_progress' | 'completed';
    players: LobbyPlayer[];
    /** Set by the host */
    selectedVillainId: number | null;
    selectedEncounterSetId: number | null;
    expertMode: boolean;
    /** True once all seats are filled and all players are ready. */
    canStart: boolean;
}

export interface LobbyPlayer {
    user: UserPublic;
    seat: number;
    heroId: number | null;
    aspect: string | null;
    deckIds: number[];
    isReady: boolean;
}

// ─── Minion Engagement ────────────────────────────────────────────────────────

/**
 * When a minion enters play in a multiplayer game it must be assigned to one
 * player. The engine uses this to resolve the engagement target.
 *
 * Default rule: engage the player whose turn it currently is (or the villain
 * phase target player). Some cards specify different targeting rules.
 */
export type MinionEngagementTarget =
    | { type: 'activePlayer' }
    | { type: 'villainPhaseTarget' }
    | { type: 'playerChoice' }          // prompt the active player to choose
    | { type: 'specific'; userId: string };
