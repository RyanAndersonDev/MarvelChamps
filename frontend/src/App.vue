<script setup lang="ts">
  import { onMounted } from "vue";
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

  onMounted(() => {
    store.initializeGame();
  })
</script>

<template>
  <main class="game-container">
    <Transition name="fade">
      <div v-if="store.activePrompt" class="prompt-overlay">
        <div class="prompt-modal">
          <header class="prompt-header">
            <h2>{{ store.activePrompt.type === 'INTERRUPT_WINDOW' ? 'Interrupt Window' : 'Declare Defense' }}</h2>
            <p>Current Event: <strong>{{ store.activePrompt.event }}</strong></p>
          </header>

          <div class="options-list">
            <div 
              v-for="option in store.activePrompt.cards" 
              :key="option.instanceId || option.id" 
              class="option-wrapper"
            >
              <div 
                v-if="option.imgPath" 
                class="option-card-wrapper" 
                @click="store.selectInterruptCard(option)"
              >
                <img :src="option.imgPath" :alt="option.name" class="mini-card-art" />
                <div class="card-label">
                  <span class="card-name">{{ option.name }}</span>
                  <span v-if="option.cost !== undefined" class="card-cost">Cost: {{ option.cost }}</span>
                </div>
              </div>

              <button 
                v-else 
                class="btn-defense-choice" 
                @click="store.activePrompt.resolve(option.id)"
              >
                {{ option.name }}
              </button>
            </div>
          </div>

          <footer class="prompt-footer">
            <button class="btn-pass" @click="store.passInterrupt">
              PASS / NO ACTION
            </button>
          </footer>
        </div>
      </div>
    </Transition>

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
          v-if="store.villainCard"
          :card-instance="store.villainCard!"
          :main-scheme-instance="store.mainScheme!"
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

        <PlayerIdentityCard
          v-if="store.playerIdentity"
        />
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
    align-items: flex-end;
  }

  .deck-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 100px;
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

  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s, transform 0.2s;
  }
  .fade-enter-from, .fade-leave-to {
    opacity: 0;
    transform: translateY(10px);
  }

  .prompt-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.85); /* Heavy dimming for focus */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999; /* Top of the world */
    backdrop-filter: blur(4px);
  }

  .prompt-modal {
    background: #1a1a1a;
    border: 3px solid #e74c3c;
    border-radius: 12px;
    padding: 2rem;
    max-width: 90%;
    width: 600px;
    box-shadow: 0 0 30px rgba(0,0,0,0.5);
  }

  .options-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
    padding: 20px;
  }

  .btn-defense-choice {
    background: #2c3e50;
    color: white;
    border: 2px solid #41b883;
    padding: 1.5rem 2rem;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.1s, background 0.2s;
    min-width: 200px;
  }

  .btn-defense-choice:hover {
    background: #3e5871;
    transform: scale(1.05);
  }

  .btn-defense-choice:active {
    transform: scale(0.95);
  }

  .option-card-wrapper {
    width: 120px;
    cursor: pointer;
    transition: transform 0.2s;
    text-align: center;
  }

  .option-card-wrapper:hover {
    transform: translateY(-10px) scale(1.1);
  }

  .mini-card-art {
    width: 100%;
    border-radius: 8px;
    border: 2px solid #555;
  }

  .btn-pass {
    background: #444;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }

  .btn-pass:hover {
    background: #666;
  }

  .fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
  .fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
