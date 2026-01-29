<script setup lang="ts">
  import { ref } from "vue";
  import PlayerHand from "./components/player-board/PlayerHand.vue";
  import PlayerId from "./components/player-board/PlayerIdentity.vue";
  import PlayerDeck from "./components/piles/DeckPile.vue";
  import PlayerTableau from "./components/player-board/PlayerTableau.vue";
  import { type Ally, type Event, type Upgrade, type Support, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme } from './types/card'
  import { createHandCard, createMainSchemeCard, createTableauCard, createVillainCard, createVillainIdentityCard, createEngagedMinion } from "./cards/cardFactory";
  import VillainBoard from "./components/villain-board/VillainBoard.vue";
  import DiscardPile from "./components/piles/DiscardPile.vue";
  import PlayerEncounterCards from "./components/player-board/PlayerEncounterCards.vue";
  import PlayerEngagedMinions from "./components/player-board/PlayerEngagedMinions.vue";

  const idIncrementer = ref(0);

  const encounterPileIds = ref<number[]>([1, 2, 3]);
  const revealedEncounterCard = ref<(Treachery | Attachment | Minion | SideScheme) | null>();

  const villainCard = ref<VillainIdentityCardInstance>(createVillainIdentityCard(1));
  const mainScheme = ref<MainSchemeInstance>(createMainSchemeCard(1));
  const villainDeckIds = ref<number[]>([8, 7, 6, 5, 4, 3, 2, 1]);
  const villainDiscardIds = ref<number[]>([]);

  const engagedMinions = ref<Minion[]>([]);
  const tableauCards = ref<(Ally | Upgrade | Support)[]>([]);

  const deckIds = ref<number[]>([ 8, 7, 6, 5, 4, 3, 2, 1]);
  const idCardId = ref(1);
  const hand = ref<(Ally | Event | Upgrade | Support)[]>([]);
  const playerDiscardIds = ref<number[]>([]);

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

  function drawEncounterCardFromPlayerPile() {
    if (encounterPileIds.value.length === 0)
      return;

    const id = encounterPileIds.value.shift()!;
    revealedEncounterCard.value = createVillainCard(id, ++idIncrementer.value)
  }
</script>

<template>
  <main class="game-container">
    <section class="villain-section">
      <div class="villain-wrapper">
        <PlayerEncounterCards class="encounter-component"
          :card-back-img-path="villainCardBackImg"
          :encounter-card-id-pile="encounterPileIds"
          :revealed-card="revealedEncounterCard!"
          @draw="drawEncounterCardFromPlayerPile"
        />

        <VillainBoard
          :card-instance="villainCard"
          :main-scheme-instance="mainScheme"
          :deckIds="villainDeckIds"
          :discard-ids="villainDiscardIds"
          :card-back-img-path="villainCardBackImg"
          :empty-pile-img-path="villainCardBackImg"
        />
      </div>
    </section>

    <section class="middle-section">
      <PlayerEngagedMinions
        :minions="engagedMinions"
      />

      <PlayerTableau class="tableau-component"
        :tableau-cards="tableauCards"
      />
    </section>

    <footer class="bottom-bar">
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

      <PlayerHand class="hand"
        :hand="hand"
        @discard="discardPlayerCardsFromHand"
        @send-to-tableau="makeTableauCardFromHand"
        @destroy-hand-card="destroyHandCard"
      />

      <DiscardPile class="PlayerDiscard"
        :pileIds="playerDiscardIds"
        :empty-image-path="playerCardBackImg"
      />
    </footer>
  </main>
</template>

<style scoped>
  .game-container {
    display: grid;
    grid-template-rows: auto 1fr auto; 
    height: 100vh;
    width: 100vw;
    box-sizing: border-box;
    overflow: hidden;
    background-color: #cbcbcb;
  }

  .villain-section {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    position: relative;
    min-height: 200px;
  }

  .middle-section {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 20px;
    overflow-y: auto;
    padding: 20px;
  }

  .encounter-component {
    position: absolute;
    left: 24px;
    top: 50%;
    transform: translateY(-50%);
  }

  .tableau-component {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .bottom-bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 12px;
    gap: 12px;
    background: #140c36;
  }

  .left-group {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }

  .hand {
    flex: 1;
    display: flex;
    justify-content: center;
    min-width: 0;
  }

  .PlayerDiscard {
    flex-shrink: 0;
  }

  .villain-wrapper {
    display: flex;
    justify-content: center;
  }
</style>
