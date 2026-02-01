<script setup lang="ts">
  import { useGameStore } from "./stores/gameStore";
  import PlayerHand from "./components/player-board/PlayerHand.vue";
  import PlayerDeck from "./components/piles/DeckPile.vue";
  import PlayerTableau from "./components/player-board/PlayerTableau.vue";
  import VillainBoard from "./components/villain-board/VillainBoard.vue";
  import DiscardPile from "./components/piles/DiscardPile.vue";
  import PlayerEncounterCards from "./components/player-board/PlayerEncounterCards.vue";
  import PlayerEngagedMinions from "./components/player-board/PlayerEngagedMinions.vue";
  import SideSchemes from "./components/villain-board/SideSchemes.vue";
  import PlayerIdentityCard from "./components/cards/PlayerIdentityCard.vue";

  const store = useGameStore();
</script>

<template>
  <main class="game-container">
    <section class="villain-section">
      <div class="villain-wrapper">
        <PlayerEncounterCards class="encounter-component"
          :class="{ 'hidden-deck': store.encounterPileIds.length === 0 
            && (store.revealedEncounterCard === null || store.revealedEncounterCard === undefined) 
          }"
          :card-back-img-path="store.villainCardBackImg"
          :encounter-card-id-pile="store.encounterPileIds"
          :revealed-card="store.revealedEncounterCard!"
          @draw="store.drawEncounterCardFromPlayerPile"
          @resolve="store.resolveCurrentEncounterCard"
        />

        <VillainBoard
          :card-instance="store.villainCard"
          :main-scheme-instance="store.mainScheme"
          :deckIds="store.villainDeckIds"
          :discard-ids="store.villainDiscardIds"
          :card-back-img-path="store.villainCardBackImg"
          :empty-pile-img-path="store.villainCardBackImg"
          @draw-as-encounter="store.drawFromVillainDeckAsEncounterCard"
        />

        <SideSchemes class="side-scheme-component"
          :side-schemes="store.activeSideSchemes"
        />
      </div>
    </section>

    <section class="middle-section">
      <PlayerEngagedMinions
        :minions="store.engagedMinions"
      />

      <PlayerTableau class="tableau-component"
        :tableau-cards="store.tableauCards"
      />
    </section>

    <footer class="bottom-bar">
      <div class="left-group">
        <div class="deck-wrapper">
          <Transition name="fade">
            <button 
              v-if="store.currentPhase === 'PLAYER_TURN'" 
              class="btn-end-turn"
              @click="store.advanceGame"
            >
              END TURN
            </button>
          </Transition>

          <PlayerDeck 
            :deckIds="store.deckIds"
            :card-back-img-path="store.playerCardBackImg"
            @draw="store.drawCardFromDeck"
          />
        </div>

        <PlayerIdentityCard/>
      </div>

      <PlayerHand 
        class="hand"
        :hand="store.hand"
        @discard="store.discardPlayerCardsFromHand"
        @send-to-tableau="store.makeTableauCardFromHand"
        @destroy-hand-card="store.destroyHandCard"
      />

      <DiscardPile 
        class="PlayerDiscard"
        :pileIds="store.playerDiscardIds"
        :empty-image-path="store.playerCardBackImg"
        :image-type="'player'"
      />
    </footer>
  </main>
</template>

<style scoped>
  .game-container {
    display: grid;
    grid-template-rows: auto 1fr auto; 
    height: 100vh;
    width: 100vw;
    box-sizing: border-box;
    overflow: hidden;
    background-color: #cbcbcb;
  }

  .villain-section {
    width: 100%;
    padding: 10px 20px;
    box-sizing: border-box;
  }

  .middle-section {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 20px;
    overflow-y: auto;
    padding: 20px;
  }

  .encounter-component {
    grid-column: 1;
    justify-self: start;
  }

  .tableau-component {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .bottom-bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 12px;
    gap: 12px;
    background: #140c36;
  }

  .left-group {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
    align-items: flex-end; /* Keep deck and ID cards aligned at bottom */
  }

  /* Container to stack the Button over the Deck */
  .deck-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 100px; /* Adjust to match your PlayerDeck width */
  }

  .btn-end-turn {
    background: #e67e22;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 800;
    cursor: pointer;
    width: 100%;
    box-shadow: 0 3px 0 #a04000;
    transition: all 0.1s ease;
    white-space: nowrap;
    z-index: 10;
  }

  .btn-end-turn:hover {
    background: #f39c12;
    transform: translateY(-1px);
  }

  .btn-end-turn:active {
    transform: translateY(2px);
    box-shadow: none;
  }

  .hand {
    flex: 1;
    display: flex;
    justify-content: center;
    min-width: 0;
  }

  .PlayerDiscard {
    flex-shrink: 0;
  }

  .villain-wrapper {
    display: grid;
    grid-template-columns: 1fr auto 1fr; 
    align-items: center;
    gap: 20px;
    width: 100%;
  }

  .side-scheme-component {
    grid-column: 3;
    justify-self: end;
  }

  .hidden-deck {
    visibility: hidden;
    pointer-events: none;
  }

  /* Transition for Button Appearance */
  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s, transform 0.2s;
  }
  .fade-enter-from, .fade-leave-to {
    opacity: 0;
    transform: translateY(10px);
  }
</style>
