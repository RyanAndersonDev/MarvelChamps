<script setup lang="ts">
  import { ref, computed } from "vue";
  
  const props = defineProps<{ deckIds: number[] }>();
  const emit = defineEmits<{
    (e: "card-drawn", cardId: number): void;
  }>();

  const deckList = ref<number[]>([...props.deckIds]);

  const deckCount = computed(() => 
    deckList.value.length
  );

  function drawCardFromDeck() {
    if (props.deckIds.length <= 0) {
      console.warn("Deck is empty!");
      return;
    }

    const cardId = deckList.value.shift()!;
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
        {{ deckCount }}
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
