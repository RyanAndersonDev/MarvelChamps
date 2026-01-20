<script setup lang="ts">
    import { ref } from 'vue';
    import type { Ally, Event, Upgrade, Support } from '../types/card';
    import HandCard from './HandCard.vue';
    import { createHandCard } from '../cards/cardFactory';

    const hand = ref<(Ally | Event | Upgrade | Support)[]>([]);

    hand.value.push(createHandCard(1, 1));
    hand.value.push(createHandCard(2, 2));
</script>

<template>
    <div class="HandContainer">
        <HandCard
            v-for="card in hand"
            :key="card.id"
            :card="card"
            class="card"
        />
    </div>
</template>

<style scoped>

</style>
