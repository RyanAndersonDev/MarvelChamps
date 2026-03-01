<script setup lang="ts">
    import { useGameStore } from '../../stores/gameStore';
    import HandCard from '../cards/HandCard.vue';
    import type { Ally, Event, Upgrade, Support } from '@shared/types/card';

    const props = defineProps<{ hand: (Ally | Event | Upgrade | Support)[] }>();
    const store = useGameStore();

    function handlePlay(cardId: number) {
        store.startPayment(cardId);
    }

    function handleResource(payload: { instanceId: number }) {
        store.addResourceToPayment(payload.instanceId);
    }

    function cancel() {
        store.targeting = { isActive: false, action: null, validTargetIds: [] };
        store.resetPayment();
    }

    function getCardMode(card: any): 'play' | 'resource' | 'none' {
        if (card.type === 'resource') {
            return store.activeCardId !== null && store.activeCardId !== card.instanceId ? 'resource' : 'none';
        }
        if (store.activeCardId !== null) {
            return store.activeCardId === card.instanceId ? 'play' : 'resource';
        }
        return store.isHandCardPlayable(card) ? 'play' : 'none';
    }

    function handleEndOfTurnCardClick(instanceId: number) {
        store.toggleEndOfTurnCard(instanceId);
    }
</script>

<template>
  <div class="hand-container-wrapper">

    <!-- Discard Phase Bar -->
    <Transition name="fade">
      <div v-if="store.endOfTurnPhase === 'discard'" class="eot-bar discard-bar">
        <div class="eot-info">
          <span class="eot-label">DISCARD PHASE</span>
          <span class="eot-hint">Select {{ store.endOfTurnDiscardCount }} card{{ store.endOfTurnDiscardCount !== 1 ? 's' : '' }} to discard</span>
          <span class="eot-count" :class="store.endOfTurnSelectedIds.length === store.endOfTurnDiscardCount ? 'met' : ''">
            {{ store.endOfTurnSelectedIds.length }} / {{ store.endOfTurnDiscardCount }}
          </span>
        </div>
        <button
          class="btn-confirm"
          :disabled="store.endOfTurnSelectedIds.length !== store.endOfTurnDiscardCount"
          @click="store.confirmEndOfTurnDiscard()"
        >CONFIRM</button>
      </div>
    </Transition>

    <Transition name="fade">
        <div v-if="(store.activeCardId !== null || (store.targeting.isActive && store.targeting.action === 'engine')) && store.endOfTurnPhase !== 'discard'" class="payment-bar">
            <div class="payment-cost">
                <template v-if="store.activeCardId !== null">
                    <span class="payment-label">PAYING</span>
                    <span class="payment-fraction" :class="store.isCostMet ? 'met' : ''">
                        {{ Object.values(store.committedResources).reduce((a, b) => a + b, 0) }}
                        /
                        {{ Math.max(0, (store.activeCard?.cost ?? 0) - store.pendingCostReduction) }}
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
                </template>
                <template v-else>
                    <span class="payment-label">SELECT TARGET</span>
                </template>
            </div>
            <button class="btn-cancel" @click="cancel">✕ CANCEL</button>
        </div>
    </Transition>

    <TransitionGroup name="hand-card" tag="div" class="hand-container">
      <div
        v-for="card in props.hand"
        :key="card.instanceId"
        :class="[
          store.endOfTurnPhase ? 'eot-card-wrapper' : 'hand-card-slot',
          { 'card-eot-selected': !!store.endOfTurnPhase && store.endOfTurnSelectedIds.includes(card.instanceId!) }
        ]"
        @click="store.endOfTurnPhase ? handleEndOfTurnCardClick(card.instanceId!) : undefined"
      >
        <HandCard
          :card="card"
          :mode="store.endOfTurnPhase ? 'none' : getCardMode(card)"
          :class="!store.endOfTurnPhase ? {
            'card-active-play': store.activeCardId === card.instanceId,
            'card-is-resource': store.activeCardId !== null && store.activeCardId !== card.instanceId,
            'card-selected-to-pay': store.paymentBufferIds.includes(card.instanceId!)
          } : {}"
          @play="handlePlay"
          @resource="handleResource"
        />
        <div v-if="store.endOfTurnPhase" class="eot-select-indicator">✓</div>
      </div>
    </TransitionGroup>
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

    .hand-card-slot { display: contents; }

    .hand-card-enter-active { transition: all 0.3s ease; }
    .hand-card-leave-active { transition: all 0.25s ease; position: absolute; }
    .hand-card-enter-from   { opacity: 0; transform: translateY(40px) scale(0.85); }
    .hand-card-leave-to     { opacity: 0; transform: translateY(30px) scale(0.8); }
    .hand-card-move         { transition: transform 0.3s ease; }

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

    /* End-of-turn phase styles */
    .eot-bar {
        position: absolute;
        top: -52px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: 20px;
        padding: 6px 14px;
        z-index: 100;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        white-space: nowrap;
    }

    .discard-bar {
        background: rgba(180, 30, 30, 0.95);
        border: 1px solid #e74c3c;
    }


    .eot-info {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.75rem;
        color: #fff;
    }

    .eot-label {
        font-weight: 900;
        font-size: 0.65rem;
        letter-spacing: 0.1em;
        color: rgba(255,255,255,0.7);
    }

    .eot-hint {
        color: #eee;
    }

    .eot-count {
        font-weight: 900;
        font-size: 1rem;
        color: #fff;
    }

    .eot-count.met { color: #2ecc71; }


    .btn-confirm {
        background: rgba(255,255,255,0.15);
        color: white;
        border: 1px solid rgba(255,255,255,0.4);
        padding: 5px 14px;
        border-radius: 14px;
        font-size: 0.7rem;
        font-weight: 800;
        cursor: pointer;
        transition: background 0.15s;
    }

    .btn-confirm:hover:not(:disabled) { background: rgba(255,255,255,0.3); }
    .btn-confirm:disabled { opacity: 0.35; cursor: not-allowed; }

    .eot-card-wrapper {
        position: relative;
        cursor: pointer;
        transition: transform 0.15s, filter 0.15s;
        border-radius: 8px;
    }

    .eot-card-wrapper:hover { transform: translateY(-8px); filter: brightness(1.1); }

    .card-eot-selected {
        transform: translateY(-16px) !important;
        filter: drop-shadow(0 0 12px #f1c40f) brightness(1.15) !important;
    }

    .eot-select-indicator {
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        background: #f1c40f;
        color: #000;
        font-weight: 900;
        font-size: 0.75rem;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #000;
        pointer-events: none;
        opacity: 0;
    }

    .card-eot-selected .eot-select-indicator { opacity: 1; }
</style>
