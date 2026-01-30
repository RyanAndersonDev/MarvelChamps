<script setup lang="ts">
  import { ref } from "vue";
  import PlayerHand from "./components/player-board/PlayerHand.vue";
  import PlayerId from "./components/player-board/PlayerIdentity.vue";
  import PlayerDeck from "./components/piles/DeckPile.vue";
  import PlayerTableau from "./components/player-board/PlayerTableau.vue";
  import { type Ally, type Event, type Upgrade, type Support, type VillainIdentityCardInstance, type MainSchemeInstance, type Treachery, type Attachment, type Minion, type SideScheme } from './types/card'
  import { createHandCard, createMainSchemeCard, createTableauCard, createVillainCard, createVillainIdentityCard, createEngagedMinion, createSideScheme } from "./cards/cardFactory";
  import VillainBoard from "./components/villain-board/VillainBoard.vue";
  import DiscardPile from "./components/piles/DiscardPile.vue";
  import PlayerEncounterCards from "./components/player-board/PlayerEncounterCards.vue";
  import PlayerEngagedMinions from "./components/player-board/PlayerEngagedMinions.vue";
  import SideSchemes from "./components/villain-board/SideSchemes.vue";

  const idIncrementer = ref(0);

  const encounterPileIds = ref<number[]>([]);
  const revealedEncounterCard = ref<(Treachery | Attachment | Minion | SideScheme) | null>();

  const villainCard = ref<VillainIdentityCardInstance>(createVillainIdentityCard(1));
  const mainScheme = ref<MainSchemeInstance>(createMainSchemeCard(1));
  const villainDeckIds = ref<number[]>([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  const villainDiscardIds = ref<number[]>([]);
  const activeSideSchemes = ref<SideScheme[]>([]);

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

  function resolveCurrentEncounterCard(currentInstanceId : number) {
    if (currentInstanceId === revealedEncounterCard.value?.instanceId) {
      const idToUse = revealedEncounterCard.value.storageId!;

      switch (revealedEncounterCard.value.type) {
        case 'attachment':
          // TODO: MAKE ATTACHMENT-SPECIFIC LOGIC TO ATTACH TO VILLAIN
          villainDiscardIds.value.push(idToUse);
          revealedEncounterCard.value = null;
          break;

      case 'minion':
        engagedMinions.value.push(createEngagedMinion(idToUse, ++idIncrementer.value));
        revealedEncounterCard.value = null;
        break;

      case 'side-scheme':
        activeSideSchemes.value.push(createSideScheme(idToUse, ++idIncrementer.value));
        revealedEncounterCard.value = null;
        break;
      
      case 'treachery':
        villainDiscardIds.value.push(idToUse);
        revealedEncounterCard.value = null;
        break;
      }
    }
  }

  function drawFromVillainDeckAsEncounterCard() {
    if (villainDeckIds.value.length > 0) {
      encounterPileIds.value.push(villainDeckIds.value.shift()!);
    }
  }
</script>

<template>
  <main class="game-container">
    <section class="villain-section">
      <div class="villain-wrapper">
        <PlayerEncounterCards class="encounter-component"
          :class="{ 'hidden-deck': encounterPileIds.length === 0 
            && (revealedEncounterCard === null || revealedEncounterCard === undefined) 
          }"
          :card-back-img-path="villainCardBackImg"
          :encounter-card-id-pile="encounterPileIds"
          :revealed-card="revealedEncounterCard!"
          @draw="drawEncounterCardFromPlayerPile"
          @resolve="resolveCurrentEncounterCard"
        />

        <VillainBoard
          :card-instance="villainCard"
          :main-scheme-instance="mainScheme"
          :deckIds="villainDeckIds"
          :discard-ids="villainDiscardIds"
          :card-back-img-path="villainCardBackImg"
          :empty-pile-img-path="villainCardBackImg"
          @draw-as-encounter="drawFromVillainDeckAsEncounterCard"
        />

        <SideSchemes class="side-scheme-component"
          :side-schemes="activeSideSchemes"
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
        :image-type="'player'"
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
    width: 100%;
    padding: 10px 20px;
    box-sizing: border-box;
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
    grid-column: 1;
    justify-self: start;
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
    display: grid;
    grid-template-columns: 1fr auto 1fr; 
    align-items: center;
    gap: 20px;
    width: 100%;
  }

  .side-scheme-component {
    grid-column: 3;
    justify-self: end;
  }

  .hidden-deck {
    visibility: hidden;
    pointer-events: none;
  }
</style>
