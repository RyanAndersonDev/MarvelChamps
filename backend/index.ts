import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from './types/socket';
import type { AuthPayload } from './types/user';
import { devAuthMiddleware } from './middleware/devAuth';
// import authRouter from './routes/auth';          // ← enable when DB is ready
// import { socketAuthMiddleware } from './middleware/socketAuth';  // ← swap in for devAuthMiddleware

import { registerLobbyHandlers } from './lobby/lobbyHandler';
import { registerGameHandlers } from './engine/gameHandler';
import { GameRoom } from './engine/GameRoom';
import { cardMap, villainCardMap, idCardMap, heroLibrary, villainLibrary, encounterLibrary } from './cards/cardStore';

// ── HTTP + Socket.IO setup ────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    { user: AuthPayload }
>(httpServer, {
    cors: { origin: '*' },
});

// ── REST ──────────────────────────────────────────────────────────────────────

app.use(express.json());
app.use((_req, res, next) => { res.header('Access-Control-Allow-Origin', '*'); next(); });
// app.use('/auth', authRouter);   // ← enable when DB is ready

app.get('/api/cards', (_req, res) => {
    const cards = Array.from(cardMap.entries()).map(([id, card]) => ({ ...card, storageId: id }));
    res.json(cards);
});

app.get('/api/villain-cards', (_req, res) => {
    const cards = Array.from(villainCardMap.entries()).map(([id, card]) => ({
        storageId: id, name: card.name, imgPath: card.imgPath,
    }));
    res.json(cards);
});

app.get('/api/cards/catalog', (_req, res) => {
    const heroes = heroLibrary.map(h => {
        const identity = idCardMap.get(h.id);
        return { ...h, imgPath: identity?.imgPath ?? '', heroImgPath: identity?.heroImgPath ?? '' };
    });
    const encounters = encounterLibrary.map(e => {
        const uniqueIds = [...new Set(e.cardIds)];
        const cardNames: Record<number, string> = {};
        for (const id of uniqueIds) {
            const name = villainCardMap.get(id)?.name;
            if (name) cardNames[id] = name;
        }
        return { ...e, cardNames };
    });
    res.json({ heroes, villains: villainLibrary, encounters });
});

// ── Socket.IO auth ────────────────────────────────────────────────────────────

// DEV: accepts ?devUser=Name in query string, no JWT/DB needed.
// PROD: swap to socketAuthMiddleware (validates JWT, requires DB).
io.use(devAuthMiddleware);

// ── Active game rooms ─────────────────────────────────────────────────────────

const rooms = new Map<string, GameRoom>();

// ── Pending resume offers (userId → raw snapshot) ─────────────────────────────
// DB migration note: replace this Map with a GameRecord query in the accept handler.

const pendingSnapshots = new Map<string, any>();

// ── Snapshot helpers ──────────────────────────────────────────────────────────

/** Find a snapshot file for the given user without restoring it. */
function findSnapshotForUser(userId: string): any | null {
    const dir = path.resolve(__dirname, '../snapshots');
    if (!fs.existsSync(dir)) return null;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
        try {
            const snap = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
            if (Array.isArray(snap.playerOrder) && snap.playerOrder.includes(userId)) {
                return snap;
            }
        } catch { /* skip corrupt files */ }
    }
    return null;
}

/** Delete a snapshot file by room code. */
function deleteSnapshot(roomCode: string): void {
    const file = path.resolve(__dirname, `../snapshots/${roomCode}.json`);
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* ignore */ }
}

// ── Socket.IO connection ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
    const { userId, username } = socket.data.user;
    console.log(`[socket] connected:    ${username} (${userId}) — ${socket.id}`);

    // Re-attach socket to any active in-memory game room this user belongs to.
    // This handles mid-session reconnects (tab refresh, brief disconnect).
    let attachedRoom: GameRoom | null = null;
    for (const room of rooms.values()) {
        if (room.playerOrder.includes(userId)) {
            room.sockets.set(userId, socket);
            attachedRoom = room;
        }
    }

    if (attachedRoom) {
        socket.join(attachedRoom.roomCode);
        attachedRoom.broadcastStateUpdate();
    } else {
        // No live room — check for a saved snapshot and offer to resume.
        // DB migration: replace findSnapshotForUser with a GameRecord query.
        const snap = findSnapshotForUser(userId);
        if (snap) {
            pendingSnapshots.set(userId, snap);
            const playerSlot = (snap.players as any[]).find((p: any) => p.userId === userId);
            socket.emit('game:resumeAvailable', {
                roomCode:    snap.roomCode,
                roundNumber: snap.roundNumber ?? 1,
                villainName: snap.villainCard?.name ?? 'Unknown',
                heroName:    playerSlot?.playerIdentity?.name ?? 'Unknown',
                playerNames: (snap.players as any[]).map((p: any) => p.username as string),
            });
            console.log(`[snapshot] Resume offered to ${username} for room ${snap.roomCode}`);
        }
    }

    // ── Resume handlers ──────────────────────────────────────────────────────

    socket.on('game:resumeAccept', () => {
        const snap = pendingSnapshots.get(userId);
        if (!snap) return;
        pendingSnapshots.delete(userId);

        // Another player may have already restored the same room
        if (rooms.has(snap.roomCode)) {
            const room = rooms.get(snap.roomCode)!;
            room.sockets.set(userId, socket);
            socket.join(snap.roomCode);
            room.broadcastStateUpdate();
            return;
        }

        const room = GameRoom.restoreFromSnapshot(snap, io);
        rooms.set(room.roomCode, room);
        room.sockets.set(userId, socket);
        socket.join(room.roomCode);
        console.log(`[snapshot] Restored room ${room.roomCode} for ${username}`);
        room.broadcastStateUpdate();
    });

    socket.on('game:resumeDecline', () => {
        const snap = pendingSnapshots.get(userId);
        if (!snap) return;
        pendingSnapshots.delete(userId);
        deleteSnapshot(snap.roomCode);
        console.log(`[snapshot] Discarded snapshot for room ${snap.roomCode} by ${username}`);
    });

    // ────────────────────────────────────────────────────────────────────────

    registerLobbyHandlers(io, socket, rooms);
    registerGameHandlers(io, socket, rooms);

    socket.on('disconnect', () => {
        console.log(`[socket] disconnected: ${username} (${userId}) — ${socket.id}`);
        pendingSnapshots.delete(userId);
        for (const room of rooms.values()) {
            if (room.sockets.get(userId)?.id === socket.id) {
                room.sockets.delete(userId);
            }
        }
    });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => console.log(`Backend running on :${PORT}`));
