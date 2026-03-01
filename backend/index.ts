import 'dotenv/config';
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

// ── Socket.IO connection ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
    const { userId, username } = socket.data.user;
    console.log(`[socket] connected:    ${username} (${userId}) — ${socket.id}`);

    // Re-attach socket to any active game room this user already belongs to
    for (const room of rooms.values()) {
        if (room.sockets.has(userId)) {
            room.sockets.set(userId, socket);
            room.broadcastStateUpdate();
        }
    }

    registerLobbyHandlers(io, socket, rooms);
    registerGameHandlers(io, socket, rooms);

    socket.on('disconnect', () => {
        console.log(`[socket] disconnected: ${username} (${userId}) — ${socket.id}`);
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
