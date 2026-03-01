import type { Socket } from 'socket.io';
import type { AuthPayload } from '../types/user';

/**
 * Development-only auth middleware — no database or JWT required.
 *
 * Clients can pass a display name via the query string:
 *   io(serverUrl, { query: { devUser: 'Ryan' } })
 *
 * Defaults to 'DevPlayer' if not provided.
 * Each unique devUser name gets a stable, deterministic userId.
 */
export function devAuthMiddleware(
    socket: Socket,
    next: (err?: Error) => void,
): void {
    const raw = socket.handshake.query.devUser;
    const username = (Array.isArray(raw) ? raw[0] : raw) ?? 'DevPlayer';
    const userId = `dev-${username.toLowerCase().replace(/\s+/g, '-')}`;

    (socket.data as { user: AuthPayload }).user = { userId, username };
    next();
}
