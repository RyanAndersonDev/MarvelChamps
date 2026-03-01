<script setup lang="ts">
    import { computed, ref } from "vue";
    import { useGameStore } from "../../stores/gameStore";
    import PeekModal from "./PeekModal.vue";

    const props = defineProps<{
        deckIds: number[],
        cardBackImgPath: string,
        imageType?: 'player' | 'villain',
        hidePeek?: boolean,
        showDrawButton?: boolean,
    }>();

    const emit = defineEmits<{ (e: "draw"): void }>();
    const store = useGameStore();

    const peeking = ref(false);

    const resolve = (id: number) => {
        if (props.imageType === 'player') {
            return store.playerCardRegistry[id] ?? '';
        }
        return store.villainCardRegistry[id]?.imgPath ?? '';
    };

    const getName = (id: number): string => {
        if (props.imageType === 'player') return '';
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
    <div class="pile-container">
        <div class="pile-card-container">
            <img :src="props.cardBackImgPath" alt="Deck" class="pile-card" />
            <div class="pile-counter">{{ deckCount }}</div>
        </div>

        <div class="button-row">
            <button v-if="!props.hidePeek" @click="peeking = true" :disabled="deckCount === 0">Peek</button>
            <button v-if="props.showDrawButton !== false" @click="emit('draw')">Draw</button>
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
</style>
