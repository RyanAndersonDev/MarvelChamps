<script setup lang="ts">
    import { ref } from 'vue';
    import type { Ally, Event, Upgrade, Support } from '../../types/card';
    import PlayerTableauCard from '../cards/PlayerTableauCard.vue';
    // TODO: Should I translate HandCard => TableauCard, or
    //  destroy and recreate with createTableauCard function
    import { createTableauCard } from '../../cards/cardFactory';

    const tableau = ref<(Ally | Upgrade | Support)[]>([]);

    tableau.value.push(createTableauCard(1, 1));
</script>

<template>
    <div class="tableau-container-wrapper">
        <div class="tableau-container">
            <PlayerTableauCard
                v-for="card in tableau"
                :key="card.id"
                :card="card"
            />
        </div>
    </div>
</template>

<style scoped>
    
</style>
