/**
 * user.ts — User, auth, and database record types.
 *
 * These types are server-only: they contain sensitive fields (passwordHash,
 * emails) that are never sent to clients. Use UserPublic when sending user
 * identity over the wire.
 */

// ─── User Account ────────────────────────────────────────────────────────────

export interface User {
    id: string;           // UUID primary key
    username: string;     // unique, displayed in-game
    email: string;        // unique, used for login
    passwordHash: string; // bcrypt hash — never sent to client
    createdAt: Date;
}

/** Safe subset sent to other clients or embedded in game state. */
export interface UserPublic {
    id: string;
    username: string;
}

/** JWT payload — what is signed into the auth token. */
export interface AuthPayload {
    userId: string;
    username: string;
    /** Expiry is handled by the JWT library; include here for convenience. */
    exp?: number;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Aggregate lifetime stats per user.
 * Stored as a single row per user, updated at game completion.
 */
export interface UserStats {
    userId: string;
    totalGames: number;
    wins: number;
    losses: number;
    /** heroId → number of games played as that hero */
    heroUsageCounts: Record<number, number>;
    /** villainId (storageId of villain phase 1) → games played against */
    villainUsageCounts: Record<number, number>;
    updatedAt: Date;
}

// ─── Database Records ─────────────────────────────────────────────────────────

/**
 * One completed game session.
 * Written when the game ends (win or loss).
 */
export interface GameRecord {
    id: string;                    // UUID
    hostUserId: string;            // FK → User
    playerCount: number;           // 1–4
    villainId: number;             // storageId of villain phase-1 card
    expertMode: boolean;
    outcome: 'win' | 'lose';
    roundsPlayed: number;
    createdAt: Date;
    completedAt: Date;
}

/**
 * One player's participation in a specific game.
 * Multiple rows per GameRecord (one per player seat).
 */
export interface GameParticipant {
    id: string;           // UUID
    gameRecordId: string; // FK → GameRecord
    userId: string;       // FK → User
    heroId: number;
    aspect: string;
    seat: number;         // 0–3, determines turn order
}
