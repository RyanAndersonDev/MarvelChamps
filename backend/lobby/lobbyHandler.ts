import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import type { AuthPayload } from '../types/user';
import type { LobbyRoom, GameConfig } from '../types/game';
import { lobbyManager } from './LobbyManager';
import { GameRoom } from '../engine/GameRoom';
import { heroLibrary, villainLibrary, encounterLibrary, standardICardIds, expertICardIds } from '../cards/cardStore';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthPayload }>;

function buildGameConfigFromLobby(room: LobbyRoom): GameConfig {
    const villain = villainLibrary.find(v => v.id === room.selectedVillainId);
    if (!villain) throw new Error('VILLAIN_NOT_FOUND');

    const phaseChain = room.expertMode ? villain.expertPhaseChain : villain.standardPhaseChain;
    const villainId = phaseChain[0]!;

    const encounter = encounterLibrary.find(e => e.id === room.selectedEncounterSetId);
    const modularIds = encounter?.cardIds ?? [];
    const expertIds = room.expertMode ? expertICardIds : [];
    const villainDeckIds = [...villain.villainDeckIds, ...standardICardIds, ...modularIds, ...expertIds];

    const players: GameConfig['players'] = room.players.map(p => {
        const hero = heroLibrary.find(h => h.id === p.heroId);
        if (!hero) throw new Error(`HERO_NOT_FOUND: ${p.heroId}`);
        const deckIds = p.deckIds.length > 0 ? p.deckIds : [...hero.heroDeckIds];
        return { userId: p.user.id, seat: p.seat, heroId: p.heroId!, aspect: p.aspect ?? 'hero', deckIds };
    });

    return {
        roomId: room.code,
        players,
        villainId,
        mainSchemeId: villain.mainSchemeId,
        villainDeckIds,
        villainPhaseChain: phaseChain,
        expertMode: room.expertMode,
    };
}

/**
 * Register all lobby:* event handlers for a connected socket.
 * Called once per connection inside io.on('connection').
 */
export function registerLobbyHandlers(io: GameServer, socket: GameSocket, rooms: Map<string, GameRoom>): void {
    const { userId, username } = socket.data.user;
    const user = { id: userId, username };

    // ── lobby:create ─────────────────────────────────────────────────────────

    socket.on('lobby:create', (ack) => {
        try {
            const room = lobbyManager.createRoom(user);
            socket.join(room.code);
            ack({ ok: true, room });
        } catch (err: unknown) {
            ack({ ok: false, error: (err as Error).message });
        }
    });

    // ── lobby:join ───────────────────────────────────────────────────────────

    socket.on('lobby:join', (data, ack) => {
        try {
            const room = lobbyManager.joinRoom(data.code, user);
            socket.join(room.code);
            // Broadcast updated state to everyone already in the room
            io.to(room.code).emit('lobby:update', room);
            ack({ ok: true });
        } catch (err: unknown) {
            ack({ ok: false, error: (err as Error).message });
        }
    });

    // ── lobby:leave ──────────────────────────────────────────────────────────

    socket.on('lobby:leave', () => {
        const existing = lobbyManager.getRoomByUserId(userId);
        if (!existing) return;
        const code = existing.code;

        const { room, dissolved } = lobbyManager.leaveRoom(userId);
        socket.leave(code);

        if (!dissolved && room) {
            io.to(room.code).emit('lobby:update', room);
        }
    });

    // ── lobby:selectHero ─────────────────────────────────────────────────────

    socket.on('lobby:selectHero', (data) => {
        try {
            const room = lobbyManager.selectHero(userId, data.heroId, data.aspect, data.deckIds);
            io.to(room.code).emit('lobby:update', room);
        } catch (err: unknown) {
            socket.emit('error', { code: 'LOBBY_ERROR', message: (err as Error).message });
        }
    });

    // ── lobby:setReady ───────────────────────────────────────────────────────

    socket.on('lobby:setReady', (data) => {
        try {
            const room = lobbyManager.setReady(userId, data.ready);
            io.to(room.code).emit('lobby:update', room);
        } catch (err: unknown) {
            socket.emit('error', { code: 'LOBBY_ERROR', message: (err as Error).message });
        }
    });

    // ── lobby:configure (host only) ──────────────────────────────────────────

    socket.on('lobby:configure', (data) => {
        try {
            const room = lobbyManager.configure(userId, data.villainId, data.encounterSetId, data.expertMode);
            io.to(room.code).emit('lobby:update', room);
        } catch (err: unknown) {
            socket.emit('error', { code: 'LOBBY_ERROR', message: (err as Error).message });
        }
    });

    // ── lobby:start (host only) ──────────────────────────────────────────────

    socket.on('lobby:start', (ack) => {
        try {
            const lobbyRoom = lobbyManager.startGame(userId);
            io.to(lobbyRoom.code).emit('lobby:update', lobbyRoom);

            // Remove any stale game rooms this user is still registered in
            // (e.g. from a previous session where they pressed Back mid-game)
            for (const [code, room] of rooms) {
                if (room.sockets.has(userId)) {
                    room.sockets.delete(userId);
                    if (room.sockets.size === 0) rooms.delete(code);
                }
            }

            const config = buildGameConfigFromLobby(lobbyRoom);
            const gameRoom = new GameRoom(io, lobbyRoom.code);
            rooms.set(lobbyRoom.code, gameRoom);

            // Register all sockets already in this Socket.IO room
            gameRoom.sockets.set(userId, socket);

            gameRoom.initializeGame(config).catch(console.error);

            ack({ ok: true });
        } catch (err: unknown) {
            ack({ ok: false, error: (err as Error).message });
        }
    });

    // ── disconnect cleanup ───────────────────────────────────────────────────

    socket.on('disconnect', () => {
        // socket.leave() is automatic on disconnect; we just clean up lobby state
        const existing = lobbyManager.getRoomByUserId(userId);
        if (!existing) return;

        const { room, dissolved } = lobbyManager.leaveRoom(userId);
        if (!dissolved && room) {
            io.to(room.code).emit('lobby:update', room);
        }
    });
}
