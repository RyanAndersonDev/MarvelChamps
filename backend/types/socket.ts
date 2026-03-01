/**
 * socket.ts — Typed Socket.IO event contract between client and server.
 *
 * Usage with Socket.IO v4 generics:
 *
 *   // Server
 *   const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
 *
 *   // Client (frontend)
 *   const socket = io<ServerToClientEvents, ClientToServerEvents>(serverUrl);
 *
 * Every game action the client can take is a ClientToServerEvent.
 * The server never trusts these — it validates everything against GameRoomState.
 * The server responds by emitting game:stateUpdate with a fresh PlayerGameView.
 */

import type { PlayerGameView, ActivePrompt, LobbyRoom, PromptResponse } from './game';
import type { UserPublic, UserStats } from './user';

// ─── Client → Server ──────────────────────────────────────────────────────────

export interface ClientToServerEvents {

    // ── Auth ──
    /** Exchange a JWT for a socket identity. Must be called before any game events. */
    'auth:identify': (data: { token: string }, ack: AckCallback) => void;

    // ── Lobby ──
    'lobby:create': (ack: AckCallback<{ room: LobbyRoom }>) => void;
    'lobby:join': (data: { code: string }, ack: AckCallback) => void;
    'lobby:leave': () => void;
    'lobby:selectHero': (data: { heroId: number; aspect: string; deckIds: number[] }) => void;
    'lobby:setReady': (data: { ready: boolean }) => void;
    /** Host only: set villain/encounter/difficulty. */
    'lobby:configure': (data: {
        villainId: number;
        encounterSetId: number;
        expertMode: boolean;
    }) => void;
    /** Host only: start the game once all players are ready. */
    'lobby:start': (ack: AckCallback) => void;

    // ── Hero Turn Actions ──
    /**
     * Play a card from hand. The server validates cost, form, uniqueness, etc.
     * targetId is required for events/cards that need a target (minion instanceId,
     * side-scheme instanceId, etc.).
     */
    'action:playCard': (data: {
        instanceId: number;
        targetId?: number;
        targetType?: 'villain' | 'minion' | 'ally' | 'scheme';
    }) => void;

    /** Hero performs a basic thwart action. */
    'action:thwartWithIdentity': (data: { targetId: number }) => void;

    /** Hero performs a basic attack action. */
    'action:attackWithIdentity': (data: {
        targetId: number;
        targetType: 'villain' | 'minion';
    }) => void;

    /** Hero uses their identity ability (exhausts if abilityExhausts). */
    'action:useIdentityAbility': () => void;

    /** Flip between hero and alter-ego forms. */
    'action:flipIdentity': () => void;

    /** Alter-ego heal action. */
    'action:healIdentity': () => void;

    /** Use an ally's attack or thwart action. */
    'action:useAllyAbility': (data: {
        allyInstanceId: number;
        abilityType: 'attack' | 'thwart';
        targetId?: number;
        targetType?: 'villain' | 'minion' | 'scheme';
    }) => void;

    /** Pay to remove an attachment from the villain or a minion. */
    'action:removeAttachment': (data: {
        attachmentInstanceId: number;
        hostId: number;
    }) => void;

    /** Draw one card from the player's deck. */
    'action:drawCard': () => void;

    /** End the active player's hero turn. Triggers the end-of-turn hand management flow. */
    'action:endTurn': () => void;

    // ── Payment Flow ──
    /** Mark a hand card as a resource payment for the card currently being played. */
    'action:addResourceToPayment': (data: { instanceId: number }) => void;
    /** Remove a previously added payment card (deselect). */
    'action:removeResourceFromPayment': (data: { instanceId: number }) => void;
    /** Confirm the payment and complete the card play. */
    'action:finalizePlay': () => void;
    /** Cancel the in-progress card play and restore the hand snapshot. */
    'action:abortPlay': () => void;

    // ── End-of-Turn Hand Management ──
    /** Submit the final discard selection (end-of-turn or mulligan). */
    'action:confirmDiscardSelection': (data: { instanceIds: number[] }) => void;

    // ── Targeting ──
    /**
     * Respond to an open targeting request. Sent when the engine is awaiting
     * a player target selection (requestTarget flow).
     */
    'action:selectTarget': (data: { instanceId: number }) => void;

    // ── Prompt / Interrupt Windows ──
    /**
     * Respond to an open prompt (interrupt, defense choice, or choice window).
     * Each eligible player must send this once before the window closes.
     */
    'action:respondToPrompt': (data: {
        promptId: string;
        response: PromptResponse;
    }) => void;

    /** Use a tableau card's action or resource ability. Server routes by card logic type. */
    'action:activateTableauCard': (data: { instanceId: number }) => void;

    // ── Encounter Resolution (during villain phase) ──
    /**
     * The targeted player advances encounter card resolution.
     * Called after the player has seen the revealed card and is ready to move on.
     */
    'action:resolveEncounterCard': () => void;

    // ── Profile ──
    'profile:getStats': (ack: AckCallback<{ stats: UserStats }>) => void;
}

// ─── Server → Client ──────────────────────────────────────────────────────────

export interface ServerToClientEvents {

    // ── Lobby ──
    /** Broadcast to all players in a lobby whenever its state changes. */
    'lobby:update': (room: LobbyRoom) => void;

    // ── Game State ──
    /**
     * Sent to one specific client after any state change.
     * The client replaces its local Pinia store state with this snapshot.
     * Personalised: each player receives their own view (their hand is full;
     * other players' hands are redacted to a count).
     */
    'game:stateUpdate': (view: PlayerGameView) => void;

    /**
     * An interrupt/defense/choice window has opened.
     * Sent only to eligible players (those who have cards they can play).
     * Non-eligible players receive a game:stateUpdate with the prompt stripped.
     */
    'game:promptOpen': (prompt: ActivePrompt) => void;

    /** The prompt has been resolved. All clients should close the prompt UI. */
    'game:promptClose': (data: { promptId: string }) => void;

    /**
     * A targeting request is active. The specified player must call
     * action:selectTarget to continue the game loop.
     */
    'game:targetingRequired': (data: {
        requestingPlayerId: string;
        targetPlayerId: string;
        targetType: string;
        validTargetIds: number[];
    }) => void;

    // ── Villain Phase Callouts ──
    /** The villain phase has started. Clients can animate the transition. */
    'game:villainPhaseStart': (data: { roundNumber: number }) => void;

    /**
     * The villain phase is now targeting a specific player.
     * Allows non-targeted players to watch the action against their teammate.
     */
    'game:villainPhaseTargetChange': (data: { targetUserId: string }) => void;

    /** A boost card was drawn. Clients animate the flip. */
    'game:boostCardFlipped': (data: {
        storageId: number;
        boostIcons: number;
        imgPath: string;
        name: string;
    }) => void;

    // ── Notifications ──
    /** A player connected/disconnected mid-game. */
    'game:playerConnectionChange': (data: {
        userId: string;
        username: string;
        connected: boolean;
    }) => void;

    /** Game has ended. Includes the final outcome. */
    'game:over': (data: {
        outcome: 'win' | 'lose';
        roundsPlayed: number;
    }) => void;

    // ── Errors ──
    /** Sent to one client when their action was rejected. */
    'error': (data: { code: string; message: string }) => void;
}

// ─── Acknowledgement helper ───────────────────────────────────────────────────

/**
 * Standard callback shape for Socket.IO acknowledgements.
 * On success: { ok: true, ...data }
 * On failure: { ok: false, error: string }
 */
export type AckCallback<T extends object = Record<never, never>> =
    (result: ({ ok: true } & T) | { ok: false; error: string }) => void;
