<script setup lang="ts">
    import { ref } from "vue";

    const deck = ref<number[]>([]);

    function peekDeck() {
        // TODO: implement peek
    }

    function shuffleDeck() {
        deck.value = [...deck.value].sort(() => Math.random() - 0.5);
    }
</script>

<template>
  <div class="pile-container">
    <div class="pile-card-container">
      <img
        src="/cards/misc/player-card-back.png"
        alt="Deck"
        class="pile-card"
      />

      <div class="pile-counter">
        {{ deck.length }}
      </div>
    </div>

    <div class="button-row">
      <button @click="peekDeck">Peek</button>
      <button @click="shuffleDeck">Shuffle</button>
    </div>
  </div>
</template>

<style scoped>
    
</style>
