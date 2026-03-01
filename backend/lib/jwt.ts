import jwt from 'jsonwebtoken';
import type { AuthPayload } from '../types/user';

const SECRET: string = (() => {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET environment variable is not set');
    return s;
})();

/** Sign a new 7-day token for the given user. */
export function signToken(payload: Omit<AuthPayload, 'exp'>): string {
    return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

/** Verify and decode a token. Throws if invalid or expired. */
export function verifyToken(token: string): AuthPayload {
    return jwt.verify(token, SECRET) as AuthPayload;
}
