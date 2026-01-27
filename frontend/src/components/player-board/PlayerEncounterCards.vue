<script setup lang="ts">
    import VillainCard from '../cards/VillainCard.vue';
    import DeckPile from '../piles/DeckPile.vue';

    const props = defineProps<{ encounterCardIdPile: number[], cardBackImgPath: string }>();
</script>

<template>
    <div class="encounter-card-container">
        <DeckPile
            :deck-ids="encounterCardIdPile"
            :card-back-img-path="cardBackImgPath"
        />

        <!-- <VillainCard

        /> -->
    </div>
</template>

<style scoped>

</style>
