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
    }

    function defend() {
        // TODO:
        //  DEFEND
    }

    function doAbility() {
        // TODO:
        //  IDENTITY ABILITIES
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

        <button @click="healOrDefend">
            {{ idSide === "alter-ego" ? "Heal" : "Defend!" }}
        </button>

        <button @click="doAbility">
            Ability
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
    gap: 5px;
    justify-content: center;
    margin-top: 10px;
}

.button-row button {
    flex: 1;
    max-width: 130px;
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
</style>
