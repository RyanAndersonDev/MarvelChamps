<script setup lang="ts">
    import { ref } from "vue";
    import { getCardImgPathById } from '../../cards/cardStore'

    const props = defineProps<{ pile: number[] }>();

    function setImgAsLastPlayed() : string {
        if (props.pile.length === 0) {
            // TODO: Find default empty image and store in universal location
            return "/cards/misc/player-card-back.png";
        }

        const lastCardId : number = props.pile[props.pile.length - 1] as number;

        return getCardImgPathById(lastCardId);
    }

    function peekPile() {
        // TODO: implement peek
    }
</script>

<template>
    <div class="pile-container">
        <div class="pile-card-container">
            <img
                :src= setImgAsLastPlayed()
                alt="Discard Pile"
                class="pile-card"
            />

            <div class="pile-counter">
                {{ pile.length }}
            </div>
        </div>

        <div class="button-row">
            <button @click="peekPile">Peek</button>
        </div>
    </div>
</template>

<style scoped>

</style>
