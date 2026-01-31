<script setup lang="ts">
    import { computed } from 'vue';
    import { useGameStore } from '../../stores/gameStore';
    import type { MainSchemeInstance } from '../../types/card';
    import BaseCard from '../cards/BaseCard.vue';

    const props = defineProps<{ schemeInstance: MainSchemeInstance }>();
    const store = useGameStore();

    const isTargetable = computed(() => {
        return store.targeting.isActive 
            && (store.targeting.targetType === 'scheme' || store.targeting.targetType === 'main-scheme');
    });

    function handleSchemeClick() {
        if (isTargetable.value) {
            store.selectTarget(props.schemeInstance.instanceId);
        }
    }
</script>

<template>
  <div 
    class="scheme-container" 
    :class="{ 'targetable': isTargetable }"
    @click="handleSchemeClick"
  >
    <div class="id-card-wrapper">
      <BaseCard
        :img-path="props.schemeInstance.imgPath"
        :orientation="'horizontal'"
        :zoom-direction="'down'"
        class="scheme-card"
      />
      
      <div v-if="isTargetable" class="target-overlay">
        <div class="reticle"></div>
      </div>
    </div>

    <div class="stats-overlay">
      <div class="stat-badge threat">
        <span class="label">THREAT</span>
        <span class="value">{{ schemeInstance.currentThreat }}</span>
      </div>
      <div class="stat-badge threshold">
        <span class="label">LIMIT</span>
        <span class="value">{{ schemeInstance.threatThreshold }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
    .scheme-container {
        position: relative;
        transition: transform 0.2s ease, filter 0.2s ease;
        cursor: default;
    }

    .targetable {
        cursor: pointer;
        filter: drop-shadow(0 0 10px #8e44ad);
        transform: scale(1.02);
    }

    .targetable:hover {
        filter: drop-shadow(0 0 20px #af7ac5);
        transform: scale(1.05);
    }

    .id-card-wrapper {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
    }

    .stats-overlay {
        display: flex;
        justify-content: space-around;
        margin-top: 8px;
        gap: 10px;
    }

    .stat-badge {
        flex: 1;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid #444;
        border-radius: 4px;
        padding: 4px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .threat .value { color: #f1c40f; font-weight: 800; }
    .threshold .value { color: #ecf0f1; }

    .label {
        font-size: 0.6rem;
        color: #aaa;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .target-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(142, 68, 173, 0.2);
        pointer-events: none;
    }

    .reticle {
        width: 40px;
        height: 40px;
        border: 4px solid #fff;
        border-radius: 50%;
        border-style: dashed;
        animation: spin 4s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>