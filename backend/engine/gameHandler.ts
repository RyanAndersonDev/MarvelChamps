import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import type { AuthPayload } from '../types/user';
import type { GameRoom } from './GameRoom';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;

export function registerGameHandlers(
    io: GameServer,
    socket: GameSocket,
    rooms: Map<string, GameRoom>
): void {
    const { userId } = socket.data.user;

    function getRoom(): GameRoom | undefined {
        for (const room of rooms.values()) {
            if (room.sockets.has(userId)) return room;
        }
    }

    // True when it is this player's hero turn
    function isActivePlayer(room: GameRoom): boolean {
        return room.playerOrder[room.activePlayerIndex] === userId;
    }

    // True when the villain phase is currently targeting this player
    function isVillainTarget(room: GameRoom): boolean {
        return room.villainPhaseTargetIndex !== null
            && room.playerOrder[room.villainPhaseTargetIndex] === userId;
    }

    // Hero-turn-only actions — only the active player may send these
    socket.on('action:playCard', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.playCard(data);
    });
    socket.on('action:attackWithIdentity', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.attackWithIdentity(data.targetId).catch(console.error);
    });
    socket.on('action:thwartWithIdentity', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.thwartWithIdentity(data.targetId);
    });
    socket.on('action:useIdentityAbility', () => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.triggerIdentityCardAbility().catch(console.error);
    });
    socket.on('action:flipIdentity', () => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.flipIdentity().catch(console.error);
    });
    socket.on('action:healIdentity', () => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.healIdentity();
    });
    socket.on('action:useAllyAbility', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.useAllyAbility(data);
    });
    socket.on('action:drawCard', () => {
        const r = getRoom();
        if (r && isActivePlayer(r) && r.currentPhase === 'PLAYER_TURN') { r.drawCardFromDeck(); r.broadcastStateUpdate(); }
    });
    socket.on('action:endTurn', () => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.advanceGame().catch(console.error);
    });
    socket.on('action:addResourceToPayment', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.addResourceToPayment(data.instanceId);
    });
    socket.on('action:finalizePlay', () => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.finalizePlay().catch(console.error);
    });
    socket.on('action:abortPlay', () => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.abortPlay();
    });
    socket.on('action:activateTableauCard', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.handleTableauCardActivation(data.instanceId);
    });
    socket.on('action:removeAttachment', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.handleStartAttachmentRemoval(data.attachmentInstanceId, data.hostId);
    });
    socket.on('action:playFromQuiver', (data) => {
        const r = getRoom(); if (r && isActivePlayer(r)) r.playFromQuiver(data.cardInstanceId);
    });

    // Actions that apply to either the active player (during hero turn) or villain phase target
    socket.on('action:respondToPrompt', (data) => {
        const r = getRoom();
        if (r && (isActivePlayer(r) || isVillainTarget(r))) r.handleRespondToPrompt(userId, data.promptId, data.response);
    });
    socket.on('action:selectTarget', (data) => {
        const r = getRoom();
        if (r && (isActivePlayer(r) || isVillainTarget(r))) r.handleSelectTarget(data.instanceId);
    });
    socket.on('action:resolveEncounterCard', () => {
        const r = getRoom();
        if (r && (isActivePlayer(r) || isVillainTarget(r))) r.handleResolveEncounterCard();
    });
    socket.on('action:confirmDiscardSelection', (data) => {
        const r = getRoom();
        if (r && (isActivePlayer(r) || isVillainTarget(r))) r.handleConfirmDiscardSelection(data.instanceIds);
    });
    socket.on('action:yesNoResponse', (data) => {
        const r = getRoom();
        if (r && (isActivePlayer(r) || isVillainTarget(r))) r.resolveYesNo(data.accepted);
    });
}
