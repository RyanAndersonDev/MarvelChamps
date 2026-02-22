<script setup lang="ts">
    import type { MainSchemeInstance, VillainIdentityCardInstance } from '../../types/card';
    import VillainIdentityCard from '../cards/VillainIdentityCard.vue';
    import DeckPile from '../piles/DeckPile.vue';
    import DiscardPile from '../piles/DiscardPile.vue';
    import MainScheme from './MainScheme.vue';
    import VillainAttachments from './VillainAttachments.vue';

    const props = defineProps<{ 
        cardInstance: VillainIdentityCardInstance,
        mainSchemeInstance: MainSchemeInstance,
        deckIds: number[],
        discardIds: number[],
        cardBackImgPath: string,
        emptyPileImgPath: string
    }>();

    const emit = defineEmits<{ 
        (e: 'drawAsEncounter'): void;
    }>();
</script>

<template>
    <div class="villain-row">
        <DeckPile
            :deck-ids="deckIds"
            :card-back-img-path="emptyPileImgPath"
            @draw="emit('drawAsEncounter')"
        />

        <MainScheme
            :scheme-instance="props.mainSchemeInstance"
        />

        <div class="villain-col">
            <VillainIdentityCard
                :card-instance="props.cardInstance"
            />
            <VillainAttachments
                :attachments="props.cardInstance.attachments || []"
            />
        </div>

        <DiscardPile
            :pile-ids="discardIds"
            :empty-image-path="emptyPileImgPath"
            :image-type="'villain'"
        />
    </div>
</template>

<style scoped>
    .villain-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        justify-content: center;
        gap: 16px;
    }

    .villain-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }
</style>
