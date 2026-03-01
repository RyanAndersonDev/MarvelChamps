import type { Socket } from 'socket.io';
import { verifyToken } from '../lib/jwt';
import type { AuthPayload } from '../types/user';

/**
 * Socket.IO middleware that reads the JWT from the handshake auth object
 * and attaches the decoded payload to socket.data.user.
 *
 * Client connects with:
 *   const socket = io(serverUrl, { auth: { token: '<jwt>' } });
 */
export function socketAuthMiddleware(
    socket: Socket,
    next: (err?: Error) => void,
): void {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
        next(new Error('UNAUTHORIZED'));
        return;
    }

    try {
        (socket.data as { user: AuthPayload }).user = verifyToken(token);
        next();
    } catch {
        next(new Error('INVALID_TOKEN'));
    }
}
