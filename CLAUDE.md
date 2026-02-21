# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marvel Champions card game engine — a monorepo with a Vue 3 frontend and Express/Socket.IO backend.

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Pinia
- **Backend**: Express 5 + Socket.IO + TypeScript
- **Dev tooling**: ts-node-dev (backend), vue-tsc (frontend type checking)

## Commands

### Frontend (`frontend/`)
- `npm run dev` — Start Vite dev server
- `npm run build` — Type-check with vue-tsc then build with Vite
- `npm run preview` — Preview production build

### Backend (`backend/`)
- `npm run dev` — Start backend with ts-node-dev (auto-reload)

No test framework is configured yet.

## Architecture

### Game State: Pinia Store (`frontend/src/stores/gameStore.ts`)

The central hub — a single massive Pinia store (~1270 lines) that owns all game state and logic: card collections (hand, tableau, deck, discard), board state (villain, minions, schemes), turn phases, event queue, targeting, and payment buffer.

### Event System

The game uses an async event emission pattern with interrupt/response timing windows:

```typescript
await this.emitEvent('eventName', payload, async () => {
    // Core action — can be canceled/modified by interrupt handlers
});
```

Timing windows: **Interrupt** (before, can prevent) → **Action** (core resolution) → **Response** (after). Card logic hooks into these via `checkTriggers()`.

### Card Type Hierarchy (`frontend/src/types/card.ts`)

Strict TypeScript interface hierarchy:
- **Player cards**: `Ally`, `Event`, `Upgrade`, `Support` — each with `CardLogic` defining trigger timing, effect name, target type, and whether forced
- **Villain cards**: `Minion`, `Treachery`, `SideScheme`, `Attachment`
- **Identity cards**: `IdentityCard` (hero/alter-ego dual form), `VillainIdentityCard`, `MainScheme`

Type guards like `tableauCardIsAlly()` discriminate between card variants.

### Card Data Flow

1. **Blueprints** in `cardStore.ts` — static card definitions keyed by store ID (1–11+)
2. **Factories** in `cardFactory.ts` — `createHandCard()`, `createTableauCard()`, `createIdentityCard()` produce typed instances with unique instance IDs
3. **Effects** in `engine/effectLibrary.ts` — pluggable implementations (`dealDamage`, `preventDamage`, `cancelWhenRevealed`, `drawACard`, etc.) referenced by `effectName` in CardLogic

### Payment System

Sequential flow: `startPayment(cardId)` → `addResourceToPayment(instanceId)` (commit cards as resources) → check `isCostMet` getter → `finalizePlay()`.

### Targeting System

Promise-based: `requestTarget(sourceCard, type)` returns a Promise resolved when `selectTarget(instanceId)` is called from the UI.

### Game Phase Flow

Player turn → Villain phase (5 steps: threat placement, villain activation, minion activations, deal encounter cards, reveal encounter cards) → back to player turn. Phases defined in `frontend/src/types/phases.ts`.

### Frontend Components

Vue SFCs organized under `frontend/src/components/`:
- `cards/` — Card display (BaseCard, HandCard, PlayerTableauCard, VillainCard, etc.)
- `piles/` — DeckPile, DiscardPile
- `player-board/` — PlayerHand, PlayerTableau, PlayerEncounterCards, PlayerEngagedMinions
- `villain-board/` — VillainBoard, MainScheme, SideSchemes, VillainAttachments

### Backend

Minimal Express + Socket.IO server in `backend/index.ts`. Game logic currently lives in the frontend.

## TypeScript Conventions

- Strict mode enabled; avoid `any` types
- Use union types for card variants, interface hierarchy for card inheritance
- Path alias `@` maps to `frontend/src/`
