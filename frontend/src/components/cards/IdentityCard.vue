<script setup lang="ts">
    import { ref, computed } from 'vue';
    import BaseCard from './BaseCard.vue';
    import type { IdentityCardInstance } from '../../types/card';
    import { createIdentityCard } from '../../cards/cardFactory';

    const props = defineProps<{ cardId: number }>();
    const card = ref<IdentityCardInstance>(createIdentityCard(props.cardId));

    const imgPath = computed(() => 
        card.value.identityStatus === "alter-ego" 
            ? card.value.imgPath 
            : card.value.heroImgPath
    );

    function flipId () {
        card.value.identityStatus = card.value.identityStatus === "alter-ego" ? "hero" : "alter-ego";
    }

    function toggleExhaust () {
        card.value.exhausted = !card.value.exhausted;
    }

    function healOrDefend() {
        card.value.identityStatus === "alter-ego" ? heal() : defend();
    }

    function heal() {
        // TODO:
        //  HEAL
        console.log("healing!");
    }

    function defend() {
        // TODO:
        //  DEFEND
        console.log("defending!");
    }

    function doAbility() {
        // TODO:
        //  IDENTITY ABILITIES
        console.log("doing ability!");
    }
</script>

<template>
    <div class="id-card-wrapper">
        <BaseCard 
            :img-path="imgPath" 
            class="id-card"
            />

        <div class="button-row">
            <button @click="toggleExhaust">
                {{ card.exhausted ? "Exhaust" : "Ready Up" }}
            </button>
            <button @click="flipId">
                Flip
            </button>
            <button @click="doAbility">
                Ability
            </button>
            <button :disabled="card.exhausted" @click="healOrDefend">
                {{ card.identityStatus === "alter-ego" ? "Heal" : "Defend!" }}
            </button>
        </div>
    </div>
</template>

<style scoped>
    .id-card-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 0px;
    }

    /* STATUS TEXT */
    .ready {
        color: green;
        font-weight: bold;
        font-size: larger;
    }

    .exhausted {
        color: red;
        font-weight: bold;
        font-size: larger;
    }

    /* STATUS GLOW */
    .id-card-wrapper {
        box-shadow: 0 0 8px rgba(0, 255, 0, 0.9);
    }

    .id-card.exhausted {
        box-shadow: 0 0 8px rgba(255, 0, 0, 0.9);
    }
    
    .button-row {
        width: 80%;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;

        padding: 0px 10px;
        box-sizing: border-box;
    }
</style>
