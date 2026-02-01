<script setup lang="ts">
    import { useGameStore } from '../../stores/gameStore';
    import HandCard from '../cards/HandCard.vue';
    import type { Ally, Event, Upgrade, Support } from '../../types/card';

    const props = defineProps<{ hand: (Ally | Event | Upgrade | Support)[] }>();
    const store = useGameStore();

    function handlePlay(cardId: number) {
        store.startPayment(cardId);
    }

    function handleResource(payload: { instanceId: number }) {
        store.addResourceToPayment(payload.instanceId);
    }

    function cancel() {
        store.resetPayment();
    }

    function getCardMode(cardId: number) {
        if (store.activeCardId === null) return 'play';
        return store.activeCardId === cardId ? 'play' : 'resource';
    }
</script>

<template>
  <div class="hand-container-wrapper">
    <Transition name="fade">
        <button 
            v-if="store.activeCardId !== null" 
            class="btn-cancel" 
            @click="cancel"
        >
            ✕ CANCEL PLAY
        </button>
    </Transition>

    <div class="hand-container">
      <HandCard
        v-for="card in props.hand"
        :key="card.instanceId"
        :card="card"
        :mode="getCardMode(card.instanceId!)"
        :class="{
          'card-active-play': store.activeCardId === card.instanceId,
          'card-is-resource': store.activeCardId !== null && store.activeCardId !== card.instanceId,
          'card-selected-to-pay': store.paymentBufferIds.includes(card.instanceId!)
        }"
        @play="handlePlay"
        @resource="handleResource"
      />
    </div>
  </div>
</template>

<style scoped>
    .hand-container-wrapper {
        position: relative;
        display: flex;
        justify-content: center;
    }

    .hand-container {
        display: flex;
        justify-content: center;
        gap: 10px;
    }

    .btn-cancel {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        background: #c0392b;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        z-index: 100;
    }

    .btn-cancel:hover {
        background: #e74c3c;
        transform: translateX(-50%) translateY(-2px);
    }

    .fade-enter-active, .fade-leave-active {
        transition: opacity 0.3s, transform 0.3s;
    }
    .fade-enter-from, .fade-leave-to {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
    }

    .card-active-play {
        transform: translateY(-20px) scale(1.1);
        filter: drop-shadow(0 0 15px #3498db);
        z-index: 10;
        transition: all 0.3s ease;
    }

    .card-is-resource {
        filter: grayscale(0.3) brightness(0.8);
        opacity: 0.9;
    }

    .card-selected-to-pay {
        opacity: 0.4;
        filter: grayscale(1) blur(1px);
        transform: translateY(10px);
        pointer-events: none;
    }

    .card-is-resource:hover:not(.card-selected-to-pay) {
        filter: brightness(1.2) drop-shadow(0 0 10px #f1c40f);
        cursor: pointer;
    }
</style>
