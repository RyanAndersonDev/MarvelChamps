<script setup lang="ts">
    import { ref } from "vue";
    import { getCardImgPathById } from '../../cards/cardStore'

    const pile = ref<number[]>([1]);

    function setImgAsLastPlayed() : string {
        if (pile.value.length === 0) {
            return "";
        }

        const lastCardId : number = pile.value[pile.value.length - 1] as number;

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
