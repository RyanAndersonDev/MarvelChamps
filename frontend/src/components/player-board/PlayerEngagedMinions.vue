<script setup lang="ts">
    import type { Minion } from '@shared/types/card';
    import PlayerEngagedMinion from '../cards/PlayerEngagedMinion.vue';
    import { useGameStore } from '../../stores/gameStore';

    const props = defineProps<{ minions: Minion[] }>();
    const store = useGameStore();
</script>

<template>
    <div v-if="props.minions.length > 0" class="engaged-minions-wrapper" :class="{ 'phase-glow-orange': store.currentPhase === 'VILLAIN_STEP_3_MINIONS' }">
        <div class="engaged-minion-container">
            <PlayerEngagedMinion
                v-for="minion in minions"
                :key="minion.instanceId"
                :card="minion"
            />
        </div>
    </div>
</template>

<style scoped>
    @keyframes phase-pulse-orange {
        0%, 100% { box-shadow: 0 0 10px rgba(230, 120, 0, 0.5); }
        50%       { box-shadow: 0 0 32px rgba(255, 150, 0, 1); }
    }
    .phase-glow-orange {
        border-radius: 8px;
        animation: phase-pulse-orange 1s ease-in-out infinite;
    }
</style>
