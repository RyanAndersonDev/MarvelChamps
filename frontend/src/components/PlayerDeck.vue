<script setup lang="ts">
    import { ref } from "vue";
    import type { PlayerCard } from "../types/card";

    const deck = ref<PlayerCard[]>([]);

    function peekDeck() {
        // TODO: implement peek
    }

    function shuffleDeck() {
        deck.value = [...deck.value].sort(() => Math.random() - 0.5);
    }
</script>

<template>
  <div class="DeckContainer">
    <div class="deck-card-container">
      <img
        src="/cards/misc/player-card-back.png"
        alt="Deck"
        class="card"
      />

      <div class="deck-counter">
        {{ deck.length }}
      </div>
    </div>

    <div class="button-row">
      <button @click="peekDeck">Peek</button>
      <button @click="shuffleDeck">Shuffle</button>
    </div>
  </div>
</template>

<style scoped>
    /* CONTAINER */
    .DeckContainer {
        padding: 12px;
    }

    /* IMAGE */
    .card {
        width: 200px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .deck-card-container {
        position: relative;
    }

    /* CARD COUNTER */
    .deck-counter {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        width: 44px;
        height: 44px;
        border-radius: 50%;

        background: rgba(255, 255, 255, 0.75);
        color: black;

        display: flex;
        align-items: center;
        justify-content: center;

        font-weight: bold;
        font-size: 1.1rem;
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
