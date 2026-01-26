<script setup lang="ts">
  import { computed } from "vue";
  
  const props = defineProps<{ 
    deckIds: number[],
    cardBackImgPath: string
  }>();

  const emit = defineEmits<{
    (e: "draw"): void;
  }>();

  const deckCount = computed(() => 
    props.deckIds.length
  );

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
        :src="props.cardBackImgPath"
        alt="Deck"
        class="pile-card"
      />

      <div class="pile-counter">
        {{ deckCount }}
      </div>
    </div>

    <div class="button-row">
      <button @click="peekDeck">Peek</button>
      <button @click="emit('draw')">Draw</button>
    </div>
  </div>
</template>

<style scoped>
    
</style>
