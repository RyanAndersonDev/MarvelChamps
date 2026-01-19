<script setup lang="ts">
import PlayerHand from "./components/PlayerHand.vue";
import PlayerId from "./components/PlayerId.vue";
import PlayerDeck from "./components/PlayerDeck.vue";
</script>

<template>
  <main>
    <h1>Marvel Champions</h1>
    <div class="player-comp-container">
      <PlayerDeck class="player-deck"/>
      <PlayerId class="player-id"/>
      <PlayerHand class="player-hand"/>
    </div>
  </main>
</template>

<style scoped>
  main {
    padding: 24px;
  }

  .player-comp-container {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 1000;

    display: flex;
    align-items: flex-end;
    gap: 16px;
  }


  .player-deck {

  }

  .player-id {

  }

  .player-hand {

  }
</style>
