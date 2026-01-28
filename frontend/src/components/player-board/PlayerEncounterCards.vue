<script setup lang="ts">
    import type { Treachery, Attachment, Minion, SideScheme } from '../../types/card';
    import VillainCard from '../cards/VillainCard.vue';
    import DeckPile from '../piles/DeckPile.vue';

    const props = defineProps<{ 
        encounterCardIdPile: number[], 
        cardBackImgPath: string,
        revealedCard: (Treachery | Attachment | Minion | SideScheme) | null
    }>();

    const emit = defineEmits<{
        (e: "draw"): void
    }>();

    function revealEncounterCard() {
        emit("draw");
    }
</script>

<template>
    <div class="encounter-card-container">
        <DeckPile
            :deck-ids="encounterCardIdPile"
            :card-back-img-path="cardBackImgPath"
            @draw="revealEncounterCard"
        />

        <VillainCard
            v-if="props.revealedCard"
            :card="props.revealedCard"
        />
    </div>
</template>

<style scoped>

</style>
