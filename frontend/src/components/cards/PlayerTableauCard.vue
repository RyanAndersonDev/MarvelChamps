<script setup lang="ts">
  import BaseCard from './BaseCard.vue';
  import type { Ally, Upgrade, Support } from '../../types/card';
  import type { PlayerCardType } from '../../types/card';
    
  const props = defineProps<{ card: Ally | Upgrade | Support }>();

  function doAction() : void {
    const cardType : PlayerCardType = props.card.type;
    console.log("test");
  }
</script>

<template>
  <div class="tableau-card-wrapper">
    <BaseCard :img-path="card.imgPath" />

    <div class="button-row">
      <button @click="doAction">Action</button>
      <button v-if="props.card.type === 'ally'" @click="doAction">Attack</button>
    </div>
  </div>
</template>

<style scoped>
  .tableau-card-wrapper {
    display: flex;            /* make this a flex container */
    flex-direction: column;   /* stack children vertically: card first, buttons below */
    align-items: center;      /* horizontally center all children */
    gap: 8px;                 /* space between card and buttons */
  }
</style>
