# Bug Fix Session — Feb 25 2026

1. **Indomitable action button** — `PlayerTableauCard.vue`: Response-type card logics no longer show a manual Action button (Indomitable is response-only).

2. **Wild resources pay for Superhuman Law Division** — `GameBoard.vue`: Wild resource cards now appear as valid payment options for typed ability costs.

3. **Helicarrier denominator** — `PlayerHand.vue`: Payment bar denominator now shows effective cost (raw cost minus Helicarrier reduction).

4. **Setup screen selected highlights** — `StepHero.vue`, `StepVillain.vue`, `StepEncounter.vue`: Selected cards now have a thicker border, stronger background, glow ring, and persistent lift.

5. **Deck setup 33/66 split** — `StepAspect.vue`: Left (deck) panel is 1/3 width, right (binder) panel is 2/3. Binder card thumbnails enlarged (minmax 190px).

6. **Image edge rounding** — Already present via `global.css` (`border-radius: 15px` on `.base-card img`). No change needed.

7. **Peek button ordering** — `DeckPile.vue`: Deck peek shows cards alphabetically (hides deck order). Discard peek already showed most-recently-discarded-first.

8. **Enhanced Ivory Horn removal form gating** — `cardStore.ts`: Added `formRequired: 'hero'` to removal definition. `VillainAttachments.vue`: REMOVE button only shows in hero form.

9. **Side scheme image rotation in discard pile** — `DiscardPile.vue`, `PeekModal.vue`: Landscape side scheme images are rotated -90° inside a portrait frame using absolute positioning math (150% wide, 66.67% tall, centered then rotated).

10. **Acceleration icon on side schemes** — `gameStore.ts`: `processMainSchemeStepOne` now counts active side schemes with `acceleration: true` and adds them to per-round threat.

11. **Setup screen state persistence** — `StepAspect.vue`: `onMounted` reconstructs extra card counts and re-opens the previously selected aspect tab when returning to the deck builder step.

12. **Play transaction / cancel rollback** — `gameStore.ts`, `effectLibrary.ts`, `GameBoard.vue`: Added snapshot/restore system. `startPayment` saves `{ hand, playerDiscardIds }`. Canceling Legal Practice's discard-for-threat prompt calls `cancelHandDiscard()` → `abortPlay()`, restoring all cards to hand. Also wired into upgrade targeting cancel.

13. **Wild resource pip color** — `GameBoard.vue`: `.resource-wild` changed from purple to green (`#27ae60`).

14. **Side scheme discard pile size** — `DiscardPile.vue`: `.side-scheme-frame` changed from `width: 100%` (collapsed in flex) to `width: 200px` to match normal pile-card dimensions.
