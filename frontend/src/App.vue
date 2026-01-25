<script setup lang="ts">
  import { ref } from "vue";
  import PlayerHand from "./components/player-board/PlayerHand.vue";
  import PlayerId from "./components/player-board/PlayerId.vue";
  import PlayerDeck from "./components/piles/PlayerDeck.vue";
  import PlayerDiscard from "./components/piles/PlayerDiscard.vue";
  import PlayerTableau from "./components/player-board/PlayerTableau.vue";
  import type { Ally, Event, Upgrade, Support, VillainIdentityCardInstance } from './types/card'
  import { createHandCard, createTableauCard, createVillainIdentityCard } from "./cards/cardFactory";
  import VillainCard from "./components/cards/VillainIdentityCard.vue";

  const idCardId = ref(1);

  const villainCard = ref<VillainIdentityCardInstance>(createVillainIdentityCard(1));

  const deckIds = ref<number[]>([ 8, 3, 2, 5, 1, 2, 3, 4, 5, 6, 7, 8]);
  const hand = ref<(Ally | Event | Upgrade | Support)[]>([]);
  const discardIds = ref<number[]>([]);
  const tableauCards = ref<(Ally | Upgrade | Support)[]>([]);
  const idIncrementer = ref(0);

  function drawCardFromDeck() {
    if (deckIds.value.length === 0)
      return;

    const id = deckIds.value.shift()!;
    hand.value.push(createHandCard(id, ++idIncrementer.value));
  }

  function makeTableauCardFromHand(cardId : number) {
    tableauCards.value.push(createTableauCard(cardId, ++idIncrementer.value))
  }

  function discardCards(cardIds: number[]) {
    discardIds.value.push(...cardIds);
    hand.value = hand.value.filter(c => !cardIds.includes(c.storageId!));
  }

  function destroyHandCard(cardId: number) {
    hand.value = hand.value.filter(c => c.instanceId !== cardId)
  }
</script>

<template>
  <main>
    <VillainCard
      :card-instance="villainCard"
    />

    <PlayerTableau 
      :tableau-cards="tableauCards"
    />

    <div class="bottom-bar">
      <div class="left-group">
        <PlayerDeck 
          :deckIds="deckIds" 
          @draw="drawCardFromDeck"
        />

        <PlayerId 
          :id-card-id="idCardId"
        />
      </div>

      <PlayerHand
        :hand="hand"
        @discard="discardCards"
        @send-to-tableau="makeTableauCardFromHand"
        @destroy-hand-card="destroyHandCard"
        class="hand"
      />

      <PlayerDiscard 
        :pileIds="discardIds"
      />
    </div>
  </main>
</template>

<style scoped>
  main {
    max-width: 100vw;
    padding: 24px;
  }

  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;

    display: flex;
    align-items: flex-end;

    padding: 12px;
    gap: 12px;

    background: #5e5c66;
    box-sizing: border-box;
  }

  .left-group {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }

  .PlayerDiscard {
    flex-shrink: 0;
  }

  .hand {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: center;
  }
</style>
