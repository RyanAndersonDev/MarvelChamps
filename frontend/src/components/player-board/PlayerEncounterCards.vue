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
        <DeckPile class="encounter-deck"
            :deck-ids="encounterCardIdPile"
            :card-back-img-path="cardBackImgPath"
            @draw="revealEncounterCard"
        />

        <VillainCard class="revealed-area"
            v-if="props.revealedCard"
            :card="props.revealedCard"
        />
    </div>
</template>

<style scoped>
    .encounter-card-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        justify-content: flex-start; 
    }

    .encounter-card-container > * {
        flex-shrink: 0;
    }
</style>
