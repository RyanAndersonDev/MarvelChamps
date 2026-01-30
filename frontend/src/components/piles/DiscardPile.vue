<script setup lang="ts">
    import { computed } from "vue";
    import { getCardImgPathById, getVillainCardImgPathById } from "../../cards/cardStore";

    const props = defineProps<{ 
        pileIds: number[], 
        emptyImagePath: string,
        imageType: 'player' | 'villain'
    }>();

    const discardCount = computed(() =>
        props.pileIds.length
    );

    const lastPlayedImage = computed(() =>
        props.imageType === 'player'
        ?   props.pileIds.length
            ? getCardImgPathById(props.pileIds[props.pileIds.length - 1]!)
            : props.emptyImagePath

        :   props.pileIds.length
            ? getVillainCardImgPathById(props.pileIds[props.pileIds.length - 1]!)
            : props.emptyImagePath
    );

    function peekPile() {
        // TODO: implement peek
    }
</script>

<template>
    <div class="pile-container">
        <div class="pile-card-container">
            <img
                :src= lastPlayedImage
                alt="Discard Pile"
                class="pile-card"
            />

            <div class="pile-counter">
                {{ discardCount }}
            </div>
        </div>

        <div class="button-row">
            <button @click="peekPile">Peek</button>
        </div>
    </div>
</template>

<style scoped>

</style>
