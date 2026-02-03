<script setup lang="ts">
  import { computed } from "vue";
  import BaseCard from './BaseCard.vue';
  import type { Ally, Upgrade, Support } from '../../types/card';
  import type { PlayerCardType } from '../../types/card';
    
  const props = defineProps<{ card: Ally | Upgrade | Support }>();

  const allyStats = computed(() => {
      if (props.card.type === 'ally') {
          return props.card as Ally;
      }
      
      return null;
  });

  function doAction() : void {
    const cardType : PlayerCardType = props.card.type;
    console.log("test");
  }
</script>

<template>
  <div class="tableau-card-wrapper">
    <div v-if="card.type === 'ally'" class="stat-badges">
        <div class="stat-badge blue">{{ allyStats!.thw }}</div>
        <div class="stat-badge red">{{ allyStats!.atk }}</div>
        <div class="stat-badge orange">{{ allyStats!.hitPointsRemaining }}</div>
    </div>

    <BaseCard 
      :img-path="card.imgPath"
      :orientation="'vertical'"
      :zoom-direction="'out'"
      :size="'small'"
    />

    <div class="button-row">
      <button @click="doAction">Action</button>
      <button v-if="card.type === 'ally'" @click="doAction">Attack</button>
    </div>
  </div>
</template>

<style scoped>
  .tableau-card-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .stat-badges {
    position: absolute;
    top: 5px;
    right: -8px; 
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 10;
    pointer-events: none;
  }

  .stat-badge {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.75rem;
    color: white;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    font-family: sans-serif;
  }

  .stat-badge.blue { background-color: #2196F3; }
  .stat-badge.red { background-color: #f44336; }
  .stat-badge.orange { background-color: #FF9800; }

  .button-row {
    display: flex;
    gap: 4px;
  }

  button {
    padding: 2px 8px;
    font-size: 0.7rem;
    cursor: pointer;
  }
</style>
