import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../backend/types/socket';

const devUser = localStorage.getItem('devUser') ?? 'Player1';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:3000', {
    query: { devUser },
    autoConnect: true,
});
