<script setup lang="ts">
    import type { VillainIdentityCardInstance } from '../../types/card';
    import VillainIdentityCard from '../cards/VillainIdentityCard.vue';
    import DeckPile from '../piles/DeckPile.vue';
    import DiscardPile from '../piles/DiscardPile.vue';

    const props = defineProps<{ 
        cardInstance: VillainIdentityCardInstance,
        deckIds: number[],
        discardIds: number[],
        cardBackImgPath: string,
        emptyPileImgPath: string
    }>();
</script>

<template>
    <div class="villain-row">
        <DeckPile
            :deck-ids="deckIds"
            :card-back-img-path="emptyPileImgPath"
        />

        <VillainIdentityCard
            :card-instance="props.cardInstance"
        />

        <DiscardPile
            :pile-ids="discardIds"
            :empty-image-path="emptyPileImgPath"
        />
    </div>
</template>

<style scoped>
    .villain-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
    }
</style>
