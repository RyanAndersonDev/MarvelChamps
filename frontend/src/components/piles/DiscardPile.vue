<script setup lang="ts">
    import { computed, ref } from "vue";
    import { getCardImgPathById, getVillainCardImgPathById } from "../../cards/cardStore";
    import { useGameStore } from "../../stores/gameStore";
    import PeekModal from "./PeekModal.vue";

    const props = defineProps<{
        pileIds: number[],
        emptyImagePath: string,
        imageType: 'player' | 'villain'
    }>();

    const store = useGameStore();
    const peeking = ref(false);

    const resolve = (id: number) => {
        if (props.imageType === 'player') {
            return store.playerCardRegistry[id] ?? getCardImgPathById(id);
        }
        return getVillainCardImgPathById(id);
    };

    const discardCount = computed(() => props.pileIds.length);

    const lastPlayedImage = computed(() =>
        props.pileIds.length ? resolve(props.pileIds[props.pileIds.length - 1]!) : props.emptyImagePath
    );

    const topCardIsSideScheme = computed(() =>
        props.pileIds.length > 0 && lastPlayedImage.value.includes('-SideScheme')
    );

    const allImgPaths = computed(() => [...props.pileIds].reverse().map(resolve));
</script>

<template>
    <div class="pile-container">
        <div class="pile-card-container">
            <div v-if="topCardIsSideScheme" class="side-scheme-frame">
                <img :src="lastPlayedImage" alt="Discard Pile" class="side-scheme-img" />
            </div>
            <img v-else :src="lastPlayedImage" alt="Discard Pile" class="pile-card" />
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
.side-scheme-frame {
    width: 200px;
    aspect-ratio: 2 / 3;
    overflow: hidden;
    position: relative;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
}

.side-scheme-img {
    position: absolute;
    width: 150%;
    height: 66.67%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-90deg);
}
</style>
