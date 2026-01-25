<script setup lang="ts">
    import { ref } from 'vue';
    import type { Ally, Upgrade, Support } from '../../types/card';
    import PlayerTableauCard from '../cards/PlayerTableauCard.vue';

    const props = defineProps<{ tableauCards: (Ally | Upgrade | Support)[] }>();
</script>

<template>
    <div class="tableau-container-wrapper">
        <div class="tableau-container">
            <PlayerTableauCard
                v-for="card in props.tableauCards"
                :key="card.instanceId"
                :card="card"
            />
        </div>
    </div>
</template>

<style scoped>
    
</style>
