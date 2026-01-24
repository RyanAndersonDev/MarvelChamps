<script setup lang="ts">
    import { ref, computed } from "vue";
    import { getCardImgPathById } from '../../cards/cardStore'

    const props = defineProps<{ pileIds: number[] }>();

    const discardCount = computed(() =>
        props.pileIds.length
    );

    const lastPlayedImage = computed(() => {
        if (props.pileIds.length === 0) {
            return "/cards/misc/player-card-back.png";
        }

        return getCardImgPathById(props.pileIds[-1]!);
    });

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
