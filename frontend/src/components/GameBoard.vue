<script setup lang="ts">
import { useGameStore } from '../stores/gameStore';
import PlayerHand from './player-board/PlayerHand.vue';
import PlayerDeck from './piles/DeckPile.vue';
import PlayerTableau from './player-board/PlayerTableau.vue';
import VillainBoard from './villain-board/VillainBoard.vue';
import DiscardPile from './piles/DiscardPile.vue';
import PlayerEncounterCards from './player-board/PlayerEncounterCards.vue';
import PlayerEngagedMinions from './player-board/PlayerEngagedMinions.vue';
import SideSchemes from './villain-board/SideSchemes.vue';
import PlayerIdentityCard from './cards/PlayerIdentityCard.vue';
import GameLog from './GameLog.vue';

const store = useGameStore();

import { ref } from 'vue';

const handDiscardSelected = ref<number[]>([]);
const resourcePaySelected = ref<number[]>([]);

function toggleResourcePayCard(instanceId: number) {
  if (!store.pendingResourcePayment) return;
  const needed = store.pendingResourcePayment.needed.length;
  const idx = resourcePaySelected.value.indexOf(instanceId);
  if (idx >= 0) {
    resourcePaySelected.value.splice(idx, 1);
  } else if (resourcePaySelected.value.length < needed) {
    resourcePaySelected.value.push(instanceId);
  }
}

function confirmResourcePay() {
  store.confirmResourcePayment(resourcePaySelected.value);
  resourcePaySelected.value = [];
}

function toggleHandDiscardCard(instanceId: number) {
  if (!store.pendingHandDiscard) return;
  const idx = handDiscardSelected.value.indexOf(instanceId);
  if (idx >= 0) {
    handDiscardSelected.value.splice(idx, 1);
  } else if (handDiscardSelected.value.length < store.pendingHandDiscard.maxCount) {
    handDiscardSelected.value.push(instanceId);
  }
}

function confirmHandDiscard() {
  store.confirmHandDiscard(handDiscardSelected.value);
  handDiscardSelected.value = [];
}

const EVENT_LABELS: Record<string, string> = {
  VILLAIN_ATTACK:          'Villain is attacking',
  VILLAIN_SCHEME:          'Villain is scheming',
  ENEMY_ATTACK:            'Enemy is activating',
  MINION_ATTACK:           'Minion is attacking',
  MINION_SCHEME:           'Minion is scheming',
  takeIdentityDamage:      'Taking damage',
  takeAllyDamage:          'Ally taking damage',
  ENTITY_DAMAGED:          'Entity taking damage',
  VILLAIN_TAKES_DAMAGE:    'Villain taking damage',
  BOOST_CARD_DRAWN:        'Boost card drawn',
  BOOST_CARD_REVEALED:     'Boost card revealed',
  SIDE_SCHEME_ENTERING:    'Side scheme entering play',
  MINION_DEFEATED:         'Minion defeated',
  ALLY_ATTACKS:            'Ally attacking',
  ENTITY_TAKES_DAMAGE:     'Entity taking damage',
};

function friendlyEvent(event: string): string {
  if (EVENT_LABELS[event]) return EVENT_LABELS[event];
  const s = event.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
</script>

<template>
  <main class="game-container">
    <Transition name="prompt-fade">
      <div v-if="store.activePrompt" class="prompt-overlay">
        <div class="prompt-modal">
          <div class="prompt-top">
            <span class="prompt-tag">{{ store.activePrompt.type === 'DEFENSE_CHOICE' ? 'DEFENSE' : 'INTERRUPT' }}</span>
            <span class="prompt-event">{{ friendlyEvent(store.activePrompt.event) }}</span>
            <button class="btn-pass" @click="store.passInterrupt">Pass</button>
          </div>

          <div class="options-row">
            <template v-for="option in store.activePrompt.cards" :key="option.instanceId || option.id">
              <div v-if="option.imgPath" class="option-card" @click="store.activePrompt?.type === 'CHOICE_WINDOW' ? store.activePrompt.resolve(option.id) : store.selectInterruptCard(option)">
                <div class="option-img-wrap">
                  <img :src="option.imgPath" :alt="option.name" />
                  <span v-if="option.cost" class="cost-badge">{{ option.cost }}</span>
                </div>
                <span class="option-name">{{ option.name }}</span>
              </div>

              <button v-else class="option-choice" @click="store.activePrompt.resolve(option.id)">
                {{ option.name }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <section class="villain-section">
      <div class="villain-wrapper">
        <PlayerEncounterCards class="encounter-component"
          :class="{ 'hidden-deck': store.encounterPileIds.length === 0
            && (store.revealedEncounterCard === null || store.revealedEncounterCard === undefined)
          }"
          :card-back-img-path="store.villainCardBackImg"
          :encounter-card-id-pile="store.encounterPileIds"
          :revealed-card="store.revealedEncounterCard!"
          @draw="store.drawEncounterCardFromPlayerPile"
          @resolve="store.resolveCurrentEncounterCard"
        />

        <VillainBoard
          v-if="store.villainCard"
          :card-instance="store.villainCard!"
          :main-scheme-instance="store.mainScheme!"
          :deckIds="store.villainDeckIds"
          :discard-ids="store.villainDiscardIds"
          :card-back-img-path="store.villainCardBackImg"
          :empty-pile-img-path="store.villainCardBackImg"
          @draw-as-encounter="store.drawFromVillainDeckAsEncounterCard"
        />

        <SideSchemes class="side-scheme-component"
          :side-schemes="store.activeSideSchemes"
        />
      </div>
    </section>

    <section class="middle-section">
      <PlayerEngagedMinions :minions="store.engagedMinions" />
      <PlayerTableau class="tableau-component" :tableau-cards="store.tableauCards" />
    </section>

    <footer class="bottom-bar">
      <div class="left-group">
        <div class="deck-wrapper">
          <Transition name="fade">
            <div v-if="store.currentPhase === 'PLAYER_TURN'" class="end-turn-group">
              <button
                class="btn-end-turn"
                :class="{
                  'phase-discard': store.endOfTurnPhase === 'discard',
                  'phase-mulligan': store.endOfTurnPhase === 'mulligan',
                }"
                :disabled="store.endOfTurnPhase === 'discard' && store.endOfTurnSelectedIds.length !== store.endOfTurnDiscardCount"
                @click="store.endOfTurnPhase === 'mulligan' ? store.confirmMulligan() : store.advanceGame()"
              >
                <template v-if="store.endOfTurnPhase === 'discard'">
                  DISCARD ({{ store.endOfTurnSelectedIds.length }}/{{ store.endOfTurnDiscardCount }})
                </template>
                <template v-else-if="store.endOfTurnPhase === 'mulligan'">
                  DONE DISCARDING
                </template>
                <template v-else>END TURN</template>
              </button>
            </div>
          </Transition>

          <PlayerDeck
            :deckIds="store.deckIds"
            :card-back-img-path="store.playerCardBackImg"
            image-type="player"
            @draw="store.drawCardFromDeck"
          />
        </div>

        <PlayerIdentityCard v-if="store.playerIdentity" />
      </div>

      <PlayerHand
        class="hand"
        :hand="store.hand"
        @discard="store.discardPlayerCardsFromHand"
        @send-to-tableau="store.makeTableauCardFromHand"
        @destroy-hand-card="store.destroyHandCard"
      />

      <DiscardPile
        class="PlayerDiscard"
        :pileIds="store.playerDiscardIds"
        :empty-image-path="store.playerCardBackImg"
        :image-type="'player'"
      />
    </footer>
  </main>

  <GameLog />

  <Teleport to="body">
    <Transition name="prompt-fade">
      <div v-if="store.pendingHandDiscard" class="prompt-overlay">
        <div class="prompt-modal">
          <div class="prompt-top">
            <span class="prompt-tag">LEGAL PRACTICE</span>
            <span class="prompt-event">Discard cards to remove threat</span>
          </div>
          <p class="hand-discard-hint">
            Select up to {{ store.pendingHandDiscard.maxCount }} cards to discard.
            Each discarded card removes 1 threat from the main scheme.
            ({{ handDiscardSelected.length }} selected)
          </p>
          <div class="options-row">
            <div
              v-for="card in store.hand"
              :key="card.instanceId"
              class="option-card"
              :class="{ 'hand-discard-selected': handDiscardSelected.includes(card.instanceId!) }"
              @click="toggleHandDiscardCard(card.instanceId!)"
            >
              <div class="option-img-wrap">
                <img :src="card.imgPath" :alt="card.name" />
                <span v-if="card.cost" class="cost-badge">{{ card.cost }}</span>
              </div>
              <span class="option-name">{{ card.name }}</span>
            </div>
          </div>
          <div class="hand-discard-actions">
            <button class="btn-pass" @click="confirmHandDiscard">Confirm ({{ handDiscardSelected.length }})</button>
            <button class="btn-pass" @click="store.confirmHandDiscard([]); handDiscardSelected.splice(0)">Cancel</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="prompt-fade">
      <div v-if="store.pendingResourcePayment" class="prompt-overlay">
        <div class="prompt-modal">
          <div class="prompt-top">
            <span class="prompt-tag">ABILITY COST</span>
            <span class="prompt-event">
              Pay:
              <span
                v-for="(res, i) in store.pendingResourcePayment.needed"
                :key="i"
                class="resource-pip"
                :class="`resource-${res}`"
              >{{ res }}</span>
            </span>
          </div>
          <p class="hand-discard-hint">Select a card from your hand to pay the resource cost.</p>
          <div class="options-row">
            <div
              v-for="card in store.hand.filter(c => c.resources?.some(r => store.pendingResourcePayment!.needed.includes(r)))"
              :key="card.instanceId"
              class="option-card"
              :class="{ 'hand-discard-selected': resourcePaySelected.includes(card.instanceId!) }"
              @click="toggleResourcePayCard(card.instanceId!)"
            >
              <div class="option-img-wrap">
                <img :src="card.imgPath" :alt="card.name" />
                <div class="resource-pips">
                  <span
                    v-for="(res, i) in card.resources"
                    :key="i"
                    class="resource-pip"
                    :class="`resource-${res}`"
                  >{{ res[0].toUpperCase() }}</span>
                </div>
              </div>
              <span class="option-name">{{ card.name }}</span>
            </div>
          </div>
          <div class="hand-discard-actions">
            <button class="btn-pass" :disabled="resourcePaySelected.length < store.pendingResourcePayment.needed.length" @click="confirmResourcePay">Confirm</button>
            <button class="btn-pass" @click="store.confirmResourcePayment([]); resourcePaySelected.splice(0)">Cancel</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="fade">
      <div v-if="store.gameOver" class="game-over-overlay" :class="store.gameOver">
        <div class="game-over-box">
          <div class="game-over-title">{{ store.gameOver === 'win' ? '🦸 VICTORY!' : '💀 DEFEATED' }}</div>
          <div class="game-over-subtitle">{{ store.gameOver === 'win' ? 'The villain has been defeated!' : 'The villain has won...' }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
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

  .encounter-component { grid-column: 1; justify-self: start; }
  .tableau-component { width: 100%; display: flex; justify-content: center; }

  .bottom-bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 12px;
    gap: 12px;
    background: #140c36;
  }

  .left-group { display: flex; gap: 12px; flex-shrink: 0; align-items: flex-end; }

  .deck-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 100px;
  }

  .end-turn-group { display: flex; flex-direction: column; gap: 4px; align-items: stretch; }

  .btn-end-turn {
    background: #e67e22;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 800;
    cursor: pointer;
    width: 100%;
    box-shadow: 0 3px 0 #a04000;
    transition: all 0.1s ease;
    white-space: nowrap;
    z-index: 10;
  }

  .btn-end-turn.phase-discard { background: #c0392b; box-shadow: 0 3px 0 #7b241c; cursor: not-allowed; }
  .btn-end-turn.phase-mulligan { background: #2980b9; box-shadow: 0 3px 0 #1a5276; }
  .btn-end-turn.phase-mulligan:hover { background: #3498db; }
  .btn-end-turn:hover { background: #f39c12; transform: translateY(-1px); }
  .btn-end-turn:active { transform: translateY(2px); box-shadow: none; }
  .btn-end-turn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .hand { flex: 1; display: flex; justify-content: center; min-width: 0; }
  .PlayerDiscard { flex-shrink: 0; }

  .villain-wrapper {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 20px;
    width: 100%;
  }

  .side-scheme-component { grid-column: 3; justify-self: end; }
  .hidden-deck { visibility: hidden; pointer-events: none; }

  .fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
  .fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }

  .prompt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(3px);
  }

  .prompt-modal {
    background: #111;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 28px 32px 32px;
    width: 820px;
    max-width: 92vw;
    box-shadow: 0 12px 60px rgba(0, 0, 0, 0.7);
  }

  .prompt-top { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }

  .prompt-tag {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.07);
    border-radius: 20px;
    padding: 5px 14px;
    flex-shrink: 0;
  }

  .prompt-event { font-size: 1.4rem; font-weight: 600; color: rgba(255, 255, 255, 0.85); flex: 1; }

  .btn-pass {
    margin-left: auto;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.35);
    font-size: 1rem;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 4px;
    transition: color 0.15s;
    flex-shrink: 0;
  }

  .btn-pass:hover { color: rgba(255, 255, 255, 0.75); }

  .options-row { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }

  .option-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: transform 0.15s;
  }

  .option-card:hover { transform: translateY(-6px); }
  .option-img-wrap { position: relative; width: 150px; }

  .option-img-wrap img {
    width: 100%;
    border-radius: 8px;
    display: block;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .cost-badge {
    position: absolute;
    bottom: -8px;
    right: -8px;
    background: #e8c84a;
    color: #111;
    font-size: 1rem;
    font-weight: 800;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
  }

  .option-name {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.65);
    text-align: center;
    max-width: 150px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .option-choice {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.85);
    padding: 16px 40px;
    border-radius: 8px;
    font-size: 1.2rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    letter-spacing: 0.03em;
  }

  .option-choice:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.35); }

  .prompt-fade-enter-active, .prompt-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
  .prompt-fade-enter-from, .prompt-fade-leave-to { opacity: 0; transform: translateY(6px); }

  .game-over-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(6px);
  }

  .game-over-overlay.win  { background: rgba(0, 60, 20, 0.85); }
  .game-over-overlay.lose { background: rgba(60, 0, 0, 0.85); }

  .hand-discard-hint {
    font-size: 0.9rem;
    color: rgba(255,255,255,0.6);
    margin: 0 0 20px;
  }

  .hand-discard-selected .option-img-wrap img {
    outline: 3px solid #f1c40f;
    border-radius: 8px;
  }

  .hand-discard-actions {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 24px;
  }

  .game-over-box {
    text-align: center;
    padding: 60px 80px;
    border-radius: 20px;
    background: rgba(0,0,0,0.6);
    border: 2px solid rgba(255,255,255,0.2);
    box-shadow: 0 0 60px rgba(0,0,0,0.8);
  }

  .game-over-title { font-size: 3.5rem; font-weight: 900; color: white; letter-spacing: 0.05em; margin-bottom: 16px; }
  .game-over-subtitle { font-size: 1.1rem; color: rgba(255,255,255,0.7); }

  .resource-pips { display: flex; gap: 3px; justify-content: center; margin-top: 4px; flex-wrap: wrap; }
  .resource-pip {
    font-size: 0.6rem; font-weight: 800; padding: 2px 6px; border-radius: 10px;
    text-transform: uppercase; letter-spacing: 0.05em; color: white;
  }
  .resource-physical { background: #27ae60; }
  .resource-mental    { background: #2980b9; }
  .resource-energy    { background: #e67e22; }
  .resource-wild      { background: #8e44ad; }
</style>
