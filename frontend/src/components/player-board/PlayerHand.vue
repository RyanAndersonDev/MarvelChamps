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

    function getCardMode(card: any): 'play' | 'resource' | 'none' {
        if (store.activeCardId !== null) {
            return store.activeCardId === card.instanceId ? 'play' : 'resource';
        }
        return store.isHandCardPlayable(card) ? 'play' : 'none';
    }
</script>

<template>
  <div class="hand-container-wrapper">
    <Transition name="fade">
        <div v-if="store.activeCardId !== null" class="payment-bar">
            <div class="payment-cost">
                <span class="payment-label">PAYING</span>
                <span class="payment-fraction" :class="store.isCostMet ? 'met' : ''">
                    {{ Object.values(store.committedResources).reduce((a, b) => a + b, 0) }}
                    /
                    {{ store.activeCard?.cost ?? '?' }}
                </span>
                <span class="generated-list">
                    <template v-for="(count, type) in store.committedResources" :key="type">
                        <span
                            v-for="i in count"
                            :key="`${type}-${i}`"
                            class="resource-pip"
                            :class="type"
                        >{{ (type as string)[0].toUpperCase() }}</span>
                    </template>
                </span>
            </div>
            <button class="btn-cancel" @click="cancel">✕ CANCEL</button>
        </div>
    </Transition>

    <div class="hand-container">
      <HandCard
        v-for="card in props.hand"
        :key="card.instanceId"
        :card="card"
        :mode="getCardMode(card)"
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

    .payment-bar {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(20, 20, 40, 0.95);
        border: 1px solid #444;
        border-radius: 20px;
        padding: 5px 12px 5px 16px;
        z-index: 100;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        white-space: nowrap;
    }

    .payment-cost {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
        color: #ccc;
    }

    .payment-label {
        font-weight: 800;
        font-size: 0.65rem;
        letter-spacing: 0.08em;
        color: #888;
        text-transform: uppercase;
    }

    .payment-fraction {
        font-weight: 900;
        font-size: 1rem;
        color: white;
        transition: color 0.2s;
    }

    .payment-fraction.met { color: #2ecc71; }

    .generated-list {
        display: flex;
        gap: 3px;
    }

    .resource-pip {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.6rem;
        font-weight: 900;
        color: white;
        border: 1px solid rgba(255,255,255,0.4);
    }

    .resource-pip.physical { background: #e74c3c; }
    .resource-pip.mental   { background: #3498db; }
    .resource-pip.energy   { background: #e6c200; }
    .resource-pip.wild     { background: #27ae60; }

    .btn-cancel {
        background: #c0392b;
        color: white;
        border: none;
        padding: 5px 12px;
        border-radius: 14px;
        font-size: 0.7rem;
        font-weight: 800;
        cursor: pointer;
    }

    .btn-cancel:hover { background: #e74c3c; }

    .fade-enter-active, .fade-leave-active {
        transition: opacity 0.3s, transform 0.3s;
    }
    .fade-enter-from, .fade-leave-to {
        opacity: 0;
        transform: translateX(-50%) translateY(6px);
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
