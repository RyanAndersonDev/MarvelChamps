<script setup lang="ts">
    import { computed, ref } from "vue";
    import { useGameStore } from "../../stores/gameStore";
    import PeekModal from "./PeekModal.vue";

    const props = defineProps<{
        deckIds: number[],
        cardBackImgPath: string,
        imageType?: 'player' | 'villain',
        hidePeek?: boolean,
    }>();

    const store = useGameStore();

    const peeking = ref(false);

    const resolve = (id: number) => {
        if (props.imageType === 'player') {
            return store.playerCardRegistry[id]?.imgPath ?? '';
        }
        return store.villainCardRegistry[id]?.imgPath ?? '';
    };

    const getName = (id: number): string => {
        if (props.imageType === 'player') return store.playerCardRegistry[id]?.name ?? '';
        return store.villainCardRegistry[id]?.name ?? '';
    };

    const ids = computed(() => props.deckIds ?? []);

    const deckCount = computed(() => ids.value.length);

    const allImgPaths = computed(() =>
        [...ids.value]
            .sort((a, b) => getName(a).localeCompare(getName(b)))
            .map(resolve)
    );
</script>

<template>
    <div class="pile-container" :class="{ 'draw-flash': props.imageType === 'player' && store.cardDrawFlash }">
        <div class="pile-card-container">
            <img :src="props.cardBackImgPath" alt="Deck" class="pile-card" />
            <div class="pile-counter">{{ deckCount }}</div>
        </div>

        <div class="button-row">
            <button v-if="!props.hidePeek" @click="peeking = true" :disabled="deckCount === 0">Peek</button>
        </div>

        <PeekModal
            v-if="peeking && !props.hidePeek"
            title="Deck"
            :img-paths="allImgPaths"
            @close="peeking = false"
        />
    </div>
</template>

<style scoped>
    @keyframes deck-deal {
        0%   { filter: drop-shadow(0 0 0px rgba(100, 180, 255, 0)); }
        25%  { filter: drop-shadow(0 0 14px rgba(100, 180, 255, 1)) brightness(1.15); }
        60%  { filter: drop-shadow(0 0 8px rgba(100, 180, 255, 0.5)); }
        100% { filter: drop-shadow(0 0 0px rgba(100, 180, 255, 0)); }
    }

    .draw-flash {
        animation: deck-deal 0.5s ease-out;
    }
</style>
