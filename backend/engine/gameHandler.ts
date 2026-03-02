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

    socket.on('action:playCard',             (data) => getRoom()?.playCard(data));
    socket.on('action:attackWithIdentity',   (data) => getRoom()?.attackWithIdentity(data.targetId).catch(console.error));
    socket.on('action:thwartWithIdentity',   (data) => getRoom()?.thwartWithIdentity(data.targetId));
    socket.on('action:useIdentityAbility',   ()     => getRoom()?.triggerIdentityCardAbility().catch(console.error));
    socket.on('action:flipIdentity',         ()     => getRoom()?.flipIdentity().catch(console.error));
    socket.on('action:healIdentity',         ()     => getRoom()?.healIdentity());
    socket.on('action:useAllyAbility',       (data) => getRoom()?.useAllyAbility(data));
    socket.on('action:drawCard',             ()     => { const r = getRoom(); if (r && r.currentPhase === 'PLAYER_TURN') { r.drawCardFromDeck(); r.broadcastStateUpdate(); } });
    socket.on('action:endTurn',              ()     => getRoom()?.advanceGame().catch(console.error));
    socket.on('action:addResourceToPayment', (data) => getRoom()?.addResourceToPayment(data.instanceId));
    socket.on('action:finalizePlay',         ()     => getRoom()?.finalizePlay().catch(console.error));
    socket.on('action:abortPlay',            ()     => getRoom()?.abortPlay());
    socket.on('action:selectTarget',         (data) => getRoom()?.handleSelectTarget(data.instanceId));
    socket.on('action:respondToPrompt',      (data) => getRoom()?.handleRespondToPrompt(userId, data.promptId, data.response));
    socket.on('action:confirmDiscardSelection', (data) => getRoom()?.handleConfirmDiscardSelection(data.instanceIds));
    socket.on('action:resolveEncounterCard',     ()     => getRoom()?.handleResolveEncounterCard());
    socket.on('action:activateTableauCard',      (data) => getRoom()?.handleTableauCardActivation(data.instanceId));
    socket.on('action:removeAttachment',         (data) => getRoom()?.handleStartAttachmentRemoval(data.attachmentInstanceId, data.hostId));
    socket.on('action:yesNoResponse',            (data) => getRoom()?.resolveYesNo(data.accepted));
}
