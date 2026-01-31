<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import type { SideScheme } from '../../types/card';
import BaseCard from './BaseCard.vue';

const props = defineProps<{ card: SideScheme }>();
const store = useGameStore();

const isTargetable = computed(() => {
    return store.targeting.isActive 
        && (store.targeting.targetType === 'scheme' || store.targeting.targetType === 'main-scheme');
});

function handleCardClick() {
  if (isTargetable.value) {
    store.selectTarget(props.card.instanceId);
  }
}
</script>

<template>
  <div 
    class="side-scheme-container" 
    :class="{ 'is-targetable': isTargetable }"
    @click="handleCardClick"
  >
    <div class="side-scheme-card-wrapper">
      <BaseCard
        :img-path="card.imgPath"
        :orientation="'horizontal'"
        :zoom-direction="'down'"
        :size="'small'"
        class="scheme-card"
      />

      <div class="threat-badge">
        {{ card.threatRemaining }}
      </div>

      <div v-if="isTargetable" class="target-glow">
        <div class="pulse-ring"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
    .side-scheme-container {
        position: relative;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        cursor: default;
        display: inline-block;
    }

    .is-targetable {
        cursor: pointer;
        filter: drop-shadow(0 0 12px rgba(142, 68, 173, 0.8));
    }

    .is-targetable:hover {
        transform: scale(1.1);
        filter: drop-shadow(0 0 20px rgba(175, 122, 197, 1));
    }

    .side-scheme-card-wrapper {
        position: relative;
    }

    .threat-badge {
        position: absolute;
        bottom: -5px;
        right: -5px;
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
        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        z-index: 2;
    }

    .target-glow {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .pulse-ring {
        width: 80%;
        height: 80%;
        border: 3px solid white;
        border-radius: 10px;
        opacity: 0;
        animation: pulse-out 2s infinite;
    }

    @keyframes pulse-out {
        0% { transform: scale(0.8); opacity: 0; }
        50% { opacity: 0.6; }
        100% { transform: scale(1.2); opacity: 0; }
    }
</style>