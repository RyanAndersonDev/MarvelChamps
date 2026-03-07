<script setup lang="ts">
    import { computed } from 'vue';
    import { useGameStore } from '../../stores/gameStore';
    import type { Ally, Upgrade, Support } from '@shared/types/card';
    import PlayerTableauCard from '../cards/PlayerTableauCard.vue';
    import ObligationCard from '../cards/ObligationCard.vue';

    const props = defineProps<{ tableauCards: (Ally | Upgrade | Support)[] }>();
    const store = useGameStore();

    const typeOrder: Record<string, number> = { ally: 0, upgrade: 1, support: 2 };

    const sortedTableau = computed(() =>
        [...props.tableauCards].sort((a, b) => {
            const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
            if (typeDiff !== 0) return typeDiff;
            return a.name.localeCompare(b.name);
        })
    );
</script>

<template>
    <div v-if="props.tableauCards.length > 0 || store.obligations.length > 0" class="tableau-container-wrapper">
        <TransitionGroup name="tableau-card" tag="div" class="tableau-container">
            <ObligationCard
                v-for="ob in store.obligations"
                :key="'ob-' + ob.instanceId"
                :card="ob"
            />
            <PlayerTableauCard
                v-for="card in sortedTableau"
                :key="card.instanceId"
                :card="card"
            />
        </TransitionGroup>
    </div>
</template>

<style scoped>
.tableau-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
}

.tableau-card-enter-active { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.tableau-card-leave-active { transition: all 0.22s ease; position: absolute; }
/* Cards enter from below (hand lives at the bottom of the screen) */
.tableau-card-enter-from   { opacity: 0; transform: translateY(40px) scale(0.8); }
.tableau-card-leave-to     { opacity: 0; transform: translateY(-10px) scale(0.7); }
.tableau-card-move         { transition: transform 0.3s ease; }
</style>
