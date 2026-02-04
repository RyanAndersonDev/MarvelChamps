<script setup lang="ts">
  import { computed } from "vue";
  import { useGameStore } from "../../stores/gameStore";
  import BaseCard from './BaseCard.vue';
  import type { Ally, Upgrade, Support } from '../../types/card';
  import type { PlayerCardType } from '../../types/card';
    
  const store = useGameStore();
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
      :class="{ 'is-exhausted': card.exhausted }"
    />

    <div class="button-row">
      <button 
        v-if="card.type === 'ally' && store.currentPhase === 'PLAYER_TURN'" 
        class="ally-thw-button"
        :disabled="card.exhausted"
        @click="store.thwartWithAlly(card.instanceId!)"
      >THW</button>
      
      <button 
        v-if="card.type === 'ally' && store.currentPhase === 'PLAYER_TURN'"
        class="ally-atk-button"
        :disabled="card.exhausted"
        @click="store.attackWithAlly(card.instanceId!)"
      >ATK</button>
      
      <button 
        v-if="!card.logic.forced && store.currentPhase === 'PLAYER_TURN'"
        :disabled="!card.abilityExhausts"
        @click="doAction">Action</button>
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
    width: fit-content;
  }

  .is-exhausted {
    filter: brightness(0.4) grayscale(0.7);
    transition: filter 0.2s ease-in-out;
  }

  .stat-badges {
    position: absolute;
    top: 5px;
    right: 5px; 
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 99;
    pointer-events: none;
  }

  .stat-badge {
    display: flex !important; 
    align-items: center !important;
    justify-content: center !important;
    
    width: 22px !important;
    height: 22px !important;
    min-width: 22px !important;
    min-height: 22px !important;
    border-radius: 50% !important;
    
    color: white !important;
    font-weight: bold !important;
    font-size: 0.75rem !important;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
    
    border: 2px solid white !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5) !important;
  }

  .stat-badge.blue { background-color: #2196F3 !important; }
  .stat-badge.red { background-color: #f44336 !important; }
  .stat-badge.orange { background-color: #FF9800 !important; }

  .button-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr); 
    gap: 4px;
    width: 100%;
    justify-content: center; 
  }

  button {
    width: 100%;
    padding: 4px 0;
    font-size: 0.65rem;
    font-weight: bold;
    cursor: pointer;
    background: #333;
    color: white;
    border: 1px solid #555;
    border-radius: 4px;
  }

  button:last-child:nth-child(odd) {
    grid-column: 1 / span 2; 
    justify-self: center;
    width: auto;
    min-width: 50%;
    padding-left: 10px;
    padding-right: 10px;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ally-thw-button { background-color: #2196F3 !important; }
  .ally-atk-button { background-color: #f44336 !important; }
</style>
