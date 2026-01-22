<script setup lang="ts">
    import { ref } from 'vue';
    import type { Ally, Event, Upgrade, Support } from '../../types/card';
    import HandCard from '../cards/HandCard.vue';
    import { createHandCard } from '../../cards/cardFactory';

    const hand = ref<(Ally | Event | Upgrade | Support)[]>([]);

    function handlePlay(cardId: number) : void {
        
    }

    hand.value.push(createHandCard(1, 1));
    hand.value.push(createHandCard(2, 2));
    hand.value.push(createHandCard(3, 3));
    hand.value.push(createHandCard(4, 4));
    hand.value.push(createHandCard(5, 5));
    hand.value.push(createHandCard(6, 6));
</script>

<template>
    <div class="hand-container-wrapper">
        <div class="hand-container">
            <HandCard
                v-for="card in hand"
                :key="card.id"
                :card="card"
            />
        </div>
    </div>
</template>

<style scoped>
    
</style>
