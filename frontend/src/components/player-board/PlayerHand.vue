<script setup lang="ts">
    import { ref, watch } from 'vue';
    import type { Ally, Event, Upgrade, Support } from '../../types/card';
    import HandCard from '../cards/HandCard.vue';
    import { createHandCard } from '../../cards/cardFactory';

    const props = defineProps<{ newCardId: number | null }>();
    const hand = ref<(Ally | Event | Upgrade | Support)[]>([]);

    watch(() => props.newCardId, (id) => {
        if (id !== null) {
            hand.value.push(createHandCard(id, hand.value.length));
        }
    })

    function handlePlay(cardId: number) : void {
        
    }
    
    // props.hand.push(createHandCard(1, 1));
    // props.hand.push(createHandCard(2, 2));
    // props.hand.push(createHandCard(3, 3));
    // props.hand.push(createHandCard(4, 4));
    // props.hand.push(createHandCard(5, 5));
    // props.hand.push(createHandCard(6, 6));
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
