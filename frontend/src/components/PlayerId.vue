<script setup lang="ts">
    import { ref, computed } from "vue";
    import type { IdentityStatus, CardStatus } from "../types/card";

    const aePath: string = "/cards/heroes/PeterParker-AE.png";
    const heroPath: string = "/cards/heroes/PeterParker-Hero.png";

    const exhaustStatus = ref<CardStatus>("ready");
    const idSide = ref<IdentityStatus>("alter-ego");

    const cardImagePath = computed(() => 
        idSide.value === "hero" ? heroPath : aePath
    );

    function toggleExhaust () {
        exhaustStatus.value = exhaustStatus.value === "ready" ? "exhausted" : "ready";
    }

    function flipId () {
        idSide.value = idSide.value === "alter-ego" ? "hero" : "alter-ego";
    }

    function healOrDefend() {
        idSide.value === "alter-ego" ? heal() : defend();
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
  <div class="IdCardContainer">
    <p :class="exhaustStatus">  
        {{ exhaustStatus === "ready" ? "Ready!" : "Exhausted" }}
    </p>

    <img
      :src="cardImagePath"
      alt="Alter Ego"
      class="card"
      :class="exhaustStatus"
    />
    
    <br>

    <div class="button-row">

        <button @click="toggleExhaust">
            {{ exhaustStatus === "ready" ? "Exhaust" : "Ready Up" }}
        </button>

        <button @click="flipId">
            Flip
        </button>

        <!-- TODO: Add a property to heroes depending on if they can use their hero/ae abilities, 
         then determine if these buttons need to be disabled or not -->
        <button @click="doAbility">
            Ability
        </button>

        <button :disabled="exhaustStatus === 'exhausted'" @click="healOrDefend">
            {{ idSide === "alter-ego" ? "Heal" : "Defend!" }}
        </button>
    </div>
  </div>
</template>

<style scoped>
    .IdCardContainer {
        padding: 12px;
        display: inline-block;
    }

    /* CARD IMAGE */
    .card {
        width: 250px;
        border-radius: 12px;
        object-fit: cover;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: box-shadow 0.2s ease;
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
    .card.ready {
        box-shadow: 0 0 8px rgba(0, 255, 0, 0.9);
    }

    .card.exhausted {
        box-shadow: 0 0 8px rgba(255, 0, 0, 0.9);
    }

    /* BUTTONS */
    .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        justify-content: center;
        margin-top: 10px;
    }

    .button-row button {
        flex: 0 0 50%;
        max-width: 150px;
        max-height: 100px;
        min-width: 105px;
        white-space: nowrap;
        padding: 10px 16px;
        font-weight: bold;
        font-size: 1rem;
        cursor: pointer;
        border-radius: 6px;
        border: none;
        background-color: #1976d2;
        color: white;
        transition: background-color 0.2s;
    }

    .button-row button:hover {
        background-color: red;
    }

    .button-row button:disabled {
        background-color: red;
    }
</style>
