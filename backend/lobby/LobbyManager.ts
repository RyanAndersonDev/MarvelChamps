import type { LobbyRoom, LobbyPlayer } from '../types/game';
import type { UserPublic } from '../types/user';

const ROOM_ADJECTIVES = ['IRON', 'HERO', 'STAR', 'THOR', 'HULK', 'NOVA', 'FURY', 'CAGE', 'HAWK', 'WASP'];
const MAX_PLAYERS = 4;

function generateCode(existing: Map<string, LobbyRoom>): string {
    let code: string;
    do {
        const adj = ROOM_ADJECTIVES[Math.floor(Math.random() * ROOM_ADJECTIVES.length)]!;
        const num = Math.floor(1000 + Math.random() * 9000);
        code = `${adj}-${num}`;
    } while (existing.has(code));
    return code;
}

function recomputeCanStart(room: LobbyRoom): void {
    room.canStart =
        room.players.length >= 1 &&
        room.players.every(p => p.isReady && p.heroId !== null) &&
        room.selectedVillainId !== null &&
        room.selectedEncounterSetId !== null;
}

export class LobbyManager {
    /** Keyed by room code (e.g. "HERO-4821"). */
    private rooms = new Map<string, LobbyRoom>();
    /** Quick reverse-lookup: userId → room code. */
    private playerRoom = new Map<string, string>();

    // ── Room lifecycle ────────────────────────────────────────────────────────

    createRoom(host: UserPublic): LobbyRoom {
        // Auto-leave any existing room first
        this.leaveRoom(host.id);

        const code = generateCode(this.rooms);
        const hostPlayer: LobbyPlayer = {
            user: host,
            seat: 0,
            heroId: null,
            aspect: null,
            deckIds: [],
            isReady: false,
        };
        const room: LobbyRoom = {
            id: crypto.randomUUID(),
            code,
            hostUserId: host.id,
            status: 'lobby',
            players: [hostPlayer],
            selectedVillainId: null,
            selectedEncounterSetId: null,
            expertMode: false,
            canStart: false,
        };
        this.rooms.set(code, room);
        this.playerRoom.set(host.id, code);
        return room;
    }

    joinRoom(code: string, user: UserPublic): LobbyRoom {
        const room = this.rooms.get(code);
        if (!room)                              throw new Error('ROOM_NOT_FOUND');
        if (room.status !== 'lobby')            throw new Error('GAME_ALREADY_STARTED');
        if (room.players.length >= MAX_PLAYERS) throw new Error('ROOM_FULL');
        if (room.players.some(p => p.user.id === user.id)) {
            // Already in room — just return current state
            return room;
        }

        // Auto-leave any previous room
        this.leaveRoom(user.id);

        room.players.push({
            user,
            seat: room.players.length,
            heroId: null,
            aspect: null,
            deckIds: [],
            isReady: false,
        });
        this.playerRoom.set(user.id, code);
        recomputeCanStart(room);
        return room;
    }

    /**
     * Remove a player from whatever room they're in.
     * Returns the updated room (or null if it was dissolved), and a dissolved flag.
     */
    leaveRoom(userId: string): { room: LobbyRoom | null; dissolved: boolean } {
        const code = this.playerRoom.get(userId);
        if (!code) return { room: null, dissolved: false };

        const room = this.rooms.get(code);
        if (!room) {
            this.playerRoom.delete(userId);
            return { room: null, dissolved: false };
        }

        this.playerRoom.delete(userId);
        room.players = room.players.filter(p => p.user.id !== userId);

        // Dissolve room when last player leaves
        if (room.players.length === 0) {
            this.rooms.delete(code);
            return { room: null, dissolved: true };
        }

        // Reassign contiguous seat numbers after removal
        room.players.forEach((p, i) => { p.seat = i; });

        // Promote next player to host if the host left
        if (room.hostUserId === userId) {
            room.hostUserId = room.players[0]!.user.id;
        }

        recomputeCanStart(room);
        return { room, dissolved: false };
    }

    // ── Player actions ────────────────────────────────────────────────────────

    selectHero(userId: string, heroId: number, aspect: string, deckIds: number[]): LobbyRoom {
        const room = this.getPlayerRoom(userId);
        const player = room.players.find(p => p.user.id === userId)!;
        player.heroId = heroId;
        player.aspect = aspect;
        player.deckIds = deckIds;
        player.isReady = false; // reset ready state when hero changes
        recomputeCanStart(room);
        return room;
    }

    setReady(userId: string, ready: boolean): LobbyRoom {
        const room = this.getPlayerRoom(userId);
        const player = room.players.find(p => p.user.id === userId)!;
        if (ready && player.heroId === null) throw new Error('HERO_NOT_SELECTED');
        player.isReady = ready;
        recomputeCanStart(room);
        return room;
    }

    // ── Host-only actions ─────────────────────────────────────────────────────

    configure(
        userId: string,
        villainId: number,
        encounterSetId: number,
        expertMode: boolean,
    ): LobbyRoom {
        const room = this.getPlayerRoom(userId);
        if (room.hostUserId !== userId) throw new Error('NOT_HOST');
        room.selectedVillainId = villainId;
        room.selectedEncounterSetId = encounterSetId;
        room.expertMode = expertMode;
        // Reset all ready states when config changes (villain/mode affects deck building)
        room.players.forEach(p => { p.isReady = false; });
        recomputeCanStart(room);
        return room;
    }

    startGame(userId: string): LobbyRoom {
        const room = this.getPlayerRoom(userId);
        if (room.hostUserId !== userId) throw new Error('NOT_HOST');
        if (!room.canStart)            throw new Error('NOT_READY');
        room.status = 'in_progress';
        return room;
        // TODO Step 4: build GameConfig here and initialize GameRoomState
    }

    // ── Lookup helpers ────────────────────────────────────────────────────────

    getRoomByCode(code: string): LobbyRoom | undefined {
        return this.rooms.get(code);
    }

    getRoomByUserId(userId: string): LobbyRoom | undefined {
        const code = this.playerRoom.get(userId);
        return code ? this.rooms.get(code) : undefined;
    }

    private getPlayerRoom(userId: string): LobbyRoom {
        const code = this.playerRoom.get(userId);
        if (!code) throw new Error('NOT_IN_ROOM');
        const room = this.rooms.get(code);
        if (!room) throw new Error('NOT_IN_ROOM');
        return room;
    }
}

/** Singleton — one shared instance for the whole server process. */
export const lobbyManager = new LobbyManager();
