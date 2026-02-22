<script setup lang="ts">
    import { computed, ref } from "vue";
    import { getCardImgPathById, getVillainCardImgPathById } from "../../cards/cardStore";
    import PeekModal from "./PeekModal.vue";

    const props = defineProps<{
        deckIds: number[],
        cardBackImgPath: string,
        imageType?: 'player' | 'villain'
    }>();

    const emit = defineEmits<{ (e: "draw"): void }>();

    const peeking = ref(false);

    const resolve = (id: number) =>
        (props.imageType === 'player' ? getCardImgPathById : getVillainCardImgPathById)(id);

    const deckCount = computed(() => props.deckIds.length);

    // Top of deck is last element — show top-first
    const allImgPaths = computed(() => [...props.deckIds].reverse().map(resolve));

    function shuffleDeck() {
        // TODO: implement shuffle
    }
</script>

<template>
    <div class="pile-container">
        <div class="pile-card-container">
            <img :src="props.cardBackImgPath" alt="Deck" class="pile-card" />
            <div class="pile-counter">{{ deckCount }}</div>
        </div>

        <div class="button-row">
            <button @click="peeking = true" :disabled="deckCount === 0">Peek</button>
            <button @click="emit('draw')">Draw</button>
        </div>

        <PeekModal
            v-if="peeking"
            title="Deck"
            :img-paths="allImgPaths"
            @close="peeking = false"
        />
    </div>
</template>

<style scoped>
</style>
