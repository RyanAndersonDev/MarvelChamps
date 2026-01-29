<script setup lang="ts">
    import type { Minion } from '../../types/card';
    import PlayerEngagedMinion from '../cards/PlayerEngagedMinion.vue';

    const props = defineProps<{ minions: Minion[] }>();
</script>

<template>
    <div class="engaged-minions-wrapper">
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

</style>
