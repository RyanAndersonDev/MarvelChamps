<script setup lang="ts">
  import { ref } from "vue";
  import PlayerHand from "./components/player-board/PlayerHand.vue";
  import PlayerId from "./components/player-board/PlayerIdentity.vue";
  import PlayerDeck from "./components/piles/DeckPile.vue";
  import PlayerTableau from "./components/player-board/PlayerTableau.vue";
  import { type Ally, type Event, type Upgrade, type Support, type VillainIdentityCardInstance, type MainSchemeInstance } from './types/card'
  import { createHandCard, createMainSchemeCard, createTableauCard, createVillainIdentityCard } from "./cards/cardFactory";
  import VillainBoard from "./components/villain-board/VillainBoard.vue";
  import DiscardPile from "./components/piles/DiscardPile.vue";

  const idIncrementer = ref(0);
  
  const villainCard = ref<VillainIdentityCardInstance>(createVillainIdentityCard(1));
  const mainScheme = ref<MainSchemeInstance>(createMainSchemeCard(1));
  const villainDeckIds = ref<number[]>([8, 7, 6, 5, 4, 3, 2, 1]);
  const villainDiscardIds = ref<number[]>([]);

  const idCardId = ref(1);
  const deckIds = ref<number[]>([ 8, 7, 6, 5, 4, 3, 2, 1]);
  const hand = ref<(Ally | Event | Upgrade | Support)[]>([]);
  const playerDiscardIds = ref<number[]>([]);
  const tableauCards = ref<(Ally | Upgrade | Support)[]>([]);

  const playerCardBackImg = "/cards/misc/player-card-back.png";
  const villainCardBackImg = "/cards/misc/villain-card-back.png";

  function drawCardFromDeck() {
    if (deckIds.value.length === 0)
      return;

    const id = deckIds.value.shift()!;
    hand.value.push(createHandCard(id, ++idIncrementer.value));
  }

  function makeTableauCardFromHand(cardId : number) {
    tableauCards.value.push(createTableauCard(cardId, ++idIncrementer.value))
  }

  function discardPlayerCardsFromHand(cardIds: number[]) {
    playerDiscardIds.value.push(...cardIds);
    hand.value = hand.value.filter(c => !cardIds.includes(c.storageId!));
  }

  function discardVillainCards(cardIds: number[]) {
    villainDiscardIds.value.push(...cardIds);
  }

  function destroyHandCard(cardId: number) {
    hand.value = hand.value.filter(c => c.instanceId !== cardId)
  }
</script>

<template>
  <main>
    <div class="villain-wrapper">
      <VillainBoard
        :card-instance="villainCard"
        :main-scheme-instance="mainScheme"
        :deckIds="villainDeckIds"
        :discard-ids="villainDiscardIds"
        :card-back-img-path="villainCardBackImg"
        :empty-pile-img-path="villainCardBackImg"
      />
    </div>

    <PlayerTableau 
      :tableau-cards="tableauCards"
    />

    <div class="bottom-bar">
      <div class="left-group">
        <PlayerDeck 
          :deckIds="deckIds"
          :card-back-img-path="playerCardBackImg"
          @draw="drawCardFromDeck"
        />

        <PlayerId 
          :id-card-id="idCardId"
        />
      </div>

      <PlayerHand
        :hand="hand"
        @discard="discardPlayerCardsFromHand"
        @send-to-tableau="makeTableauCardFromHand"
        @destroy-hand-card="destroyHandCard"
        class="hand"
      />

      <DiscardPile
        :pileIds="playerDiscardIds"
        :empty-image-path="playerCardBackImg"
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

  .villain-wrapper {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
  }
</style>
