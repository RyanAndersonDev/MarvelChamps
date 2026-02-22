<script setup lang="ts">
    import { computed, ref } from "vue";
    import { getCardImgPathById, getVillainCardImgPathById } from "../../cards/cardStore";
    import PeekModal from "./PeekModal.vue";

    const props = defineProps<{
        pileIds: number[],
        emptyImagePath: string,
        imageType: 'player' | 'villain'
    }>();

    const peeking = ref(false);

    const resolve = (id: number) =>
        props.imageType === 'player' ? getCardImgPathById(id) : getVillainCardImgPathById(id);

    const discardCount = computed(() => props.pileIds.length);

    const lastPlayedImage = computed(() =>
        props.pileIds.length ? resolve(props.pileIds[props.pileIds.length - 1]!) : props.emptyImagePath
    );

    const allImgPaths = computed(() => [...props.pileIds].reverse().map(resolve));
</script>

<template>
    <div class="pile-container">
        <div class="pile-card-container">
            <img :src="lastPlayedImage" alt="Discard Pile" class="pile-card" />
            <div class="pile-counter">{{ discardCount }}</div>
        </div>

        <div class="button-row">
            <button @click="peeking = true" :disabled="discardCount === 0">Peek</button>
        </div>

        <PeekModal
            v-if="peeking"
            title="Discard Pile"
            :img-paths="allImgPaths"
            @close="peeking = false"
        />
    </div>
</template>

<style scoped>
</style>
