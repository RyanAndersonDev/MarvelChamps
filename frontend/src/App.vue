<script setup lang="ts">
  import { ref } from "vue";
  import PlayerHand from "./components/player-board/PlayerHand.vue";
  import PlayerId from "./components/player-board/PlayerId.vue";
  import PlayerDeck from "./components/piles/PlayerDeck.vue";
  import PlayerDiscard from "./components/piles/PlayerDiscard.vue";
  import PlayerTableau from "./components/player-board/PlayerTableau.vue";

  const idCardId = 1;
  const playerDeckIds = [1, 2, 3, 4, 5, 6, 7, 8];
  const latestCardId = ref<number | null>(null);

  function addCardToHandFromDeck(cardId : number) {
    latestCardId.value = cardId;
  }
</script>

<template>
  <main>
    <PlayerTableau />

    <div class="bottom-bar">
      <div class="left-group">
        <PlayerDeck 
          :deckIds="playerDeckIds" 
          @card-drawn="addCardToHandFromDeck"/>

        <PlayerId 
          :id-card-id="idCardId"/>
      </div>

      <PlayerHand
        :new-card-id="latestCardId"
        class="hand"
        />

      <PlayerDiscard :pile="[]"/>
    </div>
  </main>
</template>

<style scoped>
  main {
    max-width: 100vw;
    padding: 24px;
  }

  .bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;

  display: flex;
  align-items: flex-end;

  padding: 12px;
  gap: 12px;

  background: #5e5c66;
  box-sizing: border-box;
}

.left-group {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.PlayerDiscard {
  flex-shrink: 0;
}

.hand {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}
</style>
