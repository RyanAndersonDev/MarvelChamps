<script setup lang="ts">
    import { ref, computed } from "vue";
    import type { IdentityStatus, CardStatus } from "../../types/card";

    const aePath: string = "/cards/heroes/spider-man/PeterParker-AE.png";
    const heroPath: string = "/cards/heroes/spider-man/PeterParker-Hero.png";

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
  <div class="id-card-container">
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
</style>
