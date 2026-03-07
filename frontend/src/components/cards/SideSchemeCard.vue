<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import type { SideScheme } from '@shared/types/card';
import BaseCard from './BaseCard.vue';

const props = defineProps<{ card: SideScheme }>();
const store = useGameStore();

const heldCardDetails = computed(() =>
    (props.card.heldCards ?? []).map(id => {
        const player = store.playerCardRegistry[id];
        if (player) return { imgPath: player.imgPath, name: player.name };
        const villain = store.villainCardRegistry[id];
        if (villain) return { imgPath: villain.imgPath, name: villain.name };
        return { imgPath: '', name: `Card #${id}` };
    })
);

const isTargetable = computed(() => {
    return store.targeting.isActive
        && store.targeting.validTargetIds.includes(props.card.instanceId);
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
    :class="{
      'is-targetable': isTargetable,
      'hl-activating': store.highlights[String(card.instanceId)] === 'activating',
      'hl-targeted': store.highlights[String(card.instanceId)] === 'targeted',
    }"
    @click="handleCardClick"
  >
    <div class="side-scheme-card-wrapper">
      <BaseCard
        :img-path="card.imgPath"
        :orientation="'horizontal'"
        :zoom-direction="'down'"
        :size="'small'"
        :no-zoom="store.targeting.isActive"
        class="scheme-card"
      />

      <div class="threat-badge">
        {{ card.threatRemaining }}
      </div>

      <!-- Held cards badge (e.g. Mockingbird under Marked For Death) -->
      <div v-if="heldCardDetails.length" class="held-badge">
        ⚙ {{ heldCardDetails.length }}
        <div class="held-tooltip">
          <div v-for="(hc, i) in heldCardDetails" :key="i" class="tooltip-entry">
            <img v-if="hc.imgPath" :src="hc.imgPath" class="tooltip-img" />
            <span>{{ hc.name }}</span>
          </div>
        </div>
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

    .held-badge {
        position: absolute;
        top: -6px;
        left: -6px;
        background: #e67e22;
        color: white;
        font-size: 0.6rem;
        font-weight: 900;
        padding: 2px 5px;
        border-radius: 4px;
        border: 1.5px solid #fff;
        z-index: 10;
        cursor: default;
        pointer-events: all;
    }

    .held-tooltip {
        display: none;
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        background: rgba(10, 10, 20, 0.97);
        border: 1px solid #e67e22;
        border-radius: 8px;
        padding: 12px;
        z-index: 9999;
        flex-direction: row;
        gap: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.9);
        white-space: nowrap;
    }

    .held-badge:hover .held-tooltip { display: flex; }

    .tooltip-entry {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        color: #eee;
        font-size: 0.8rem;
        font-weight: 700;
    }

    .tooltip-img {
        width: 180px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.7);
    }
</style>