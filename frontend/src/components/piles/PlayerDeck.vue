<script setup lang="ts">
    const props = defineProps<{ deckIds: number[] }>();
    const emit = defineEmits<{
      (e: "card-drawn", cardId: number): void;
    }>();

    function drawCardFromDeck() {
      if (props.deckIds.length <= 0) {
        console.warn("Deck is empty!");
        return;
      }

      const cardId = props.deckIds.shift()!;
      emit("card-drawn", cardId);
    }

    function peekDeck() {
        // TODO: implement peek
    }

    function shuffleDeck() {
        // TODO: implement shuffle
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
        {{ props.deckIds.length }}
      </div>
    </div>

    <div class="button-row">
      <button @click="peekDeck">Peek</button>
      <button @click="drawCardFromDeck()">Draw</button>
    </div>
  </div>
</template>

<style scoped>
    
</style>
