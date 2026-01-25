<script setup lang="ts">
  import BaseCard from './BaseCard.vue';
  import type { Ally, Event, Upgrade, Support } from '../../types/card';
  import type { Resource } from '../../types/card';
    
  const props = defineProps<{ 
    card: Ally | Event | Upgrade | Support;
    mode: 'play' | 'resource' | 'used';
  }>();

  const emit = defineEmits<{
    (e: 'play', cardId: number): void;
    (e: 'resource', payload: { instanceId: number, storageId: number, resources: Resource[] }): void;
  }>();

  function playCard() : void {
    emit('play', props.card.instanceId!)  
  }

  function useAsResource(): void {
    console.log('CARD:', props.card.name, props.card.instanceId, props.card.resources);
    emit('resource', { instanceId: props.card.instanceId!, storageId: props.card.storageId!, resources: props.card.resources });
  }
</script>

<template>
  <div class="hand-card-wrapper">
    <BaseCard :img-path="card.imgPath" />

    <div class="button-row">
      <button v-if="mode === 'play'" @click="playCard">Play</button>
      <button v-else-if="mode === 'resource'" @click="useAsResource">Resource</button>
      <button v-else disabled>Used</button> <!-- visually indicate selected resources -->
    </div>
  </div>
</template>

<style scoped>
  .hand-card-wrapper {
    display: flex;            /* make this a flex container */
    flex-direction: column;   /* stack children vertically: card first, buttons below */
    align-items: center;      /* horizontally center all children */
    gap: 8px;                 /* space between card and buttons */
  }
</style>
