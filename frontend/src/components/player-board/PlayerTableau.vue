<script setup lang="ts">
    import type { Ally, Upgrade, Support } from '../../types/card';
    import PlayerTableauCard from '../cards/PlayerTableauCard.vue';

    const props = defineProps<{ tableauCards: (Ally | Upgrade | Support)[] }>();
</script>

<template>
    <div class="tableau-container-wrapper">
        <TransitionGroup name="tableau-card" tag="div" class="tableau-container">
            <PlayerTableauCard
                v-for="card in props.tableauCards"
                :key="card.instanceId"
                :card="card"
            />
        </TransitionGroup>
    </div>
</template>

<style scoped>
.tableau-card-enter-active { transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.tableau-card-leave-active { transition: all 0.2s ease; position: absolute; }
.tableau-card-enter-from   { opacity: 0; transform: translateY(-20px) scale(0.8); }
.tableau-card-leave-to     { opacity: 0; transform: scale(0.7); }
.tableau-card-move         { transition: transform 0.3s ease; }
</style>
