<script setup lang="ts">
  import BaseCard from './BaseCard.vue';
  import type { Ally, Event, Upgrade, Support } from '../../types/card';
  import type { PlayerCardType } from '../../types/card';
    
  const props = defineProps<{ card: Ally | Event | Upgrade | Support }>();

  const emit = defineEmits<{
    (e: 'play', cardId: string): void;
    (e: 'resource', cardId: string): void;
  }>();

  function playCard() : void {
    const cardType : PlayerCardType = props.card.type;

    // TODO: These cards need to be moved into the tableau component
    if (cardType === "ally" || cardType === "upgrade" || cardType === "support") {
      // DO SOMETHING
      console.log(`Playing a${cardType === "support" ? "" : "n"} ${cardType}!`);
    } 
    // TODO: Needs to do something before component is destroyed, id added to discard pile
    else {
      // DO SOMETHING
      console.log(`Playing a${cardType === "event" ? "n" : ""} ${cardType}!`);
    }
  }

  function useAsResource() : void {
    
  }
</script>

<template>
  <div class="hand-card-wrapper">
    <BaseCard :img-path="card.imgPath" />

    <div class="button-row">
      <button @click="playCard">Play</button>
      <!-- <button @click="useAsResource">Resource</button> -->
    </div>
  </div>
  <!-- <p>{{ card.name }}</p>
  <p v-if="'health' in card">Health: {{ card.health }}</p>
  <p v-if="'counters' in card">Counters: {{ card.counters }}</p> -->
</template>

<style scoped>
  .hand-card-wrapper {
    display: flex;            /* make this a flex container */
    flex-direction: column;   /* stack children vertically: card first, buttons below */
    align-items: center;      /* horizontally center all children */
    gap: 8px;                 /* space between card and buttons */
  }
</style>
