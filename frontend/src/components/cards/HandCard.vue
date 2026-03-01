<script setup lang="ts">
  import BaseCard from './BaseCard.vue';
  import { useGameStore } from '../../stores/gameStore';
  import type { Ally, Event, Upgrade, Support } from '@shared/types/card';
  import type { Resource } from '@shared/types/card';
  const store = useGameStore();
    
  const props = defineProps<{ 
    card: Ally | Event | Upgrade | Support;
    mode: 'play' | 'resource' | 'used' | 'none';
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
    <BaseCard
      :img-path="card.imgPath"
      :orientation="'vertical'"
      :zoom-direction="'up'"
      :no-zoom="store.targeting.isActive"
      @click="mode === 'play' ? playCard() : mode === 'resource' ? useAsResource() : undefined"
    />

    <div class="button-row">
      <button v-if="mode === 'play'" @click="playCard">Play</button>
      <button v-else-if="mode === 'resource'" @click="useAsResource">Resource</button>
      <button v-else-if="mode === 'used'" disabled>Used</button>
    </div>
  </div>
</template>

<style scoped>
  .hand-card-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  /* Override global .button-row button — hand container bg is --hero-secondary,
     so buttons must use --hero-primary to stay visible. */
  .button-row button {
    background-color: var(--hero-primary, #1976d2);
  }
</style>
