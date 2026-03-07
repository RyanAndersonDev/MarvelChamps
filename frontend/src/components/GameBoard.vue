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
import TeammateBoard from './player-board/TeammateBoard.vue';
import HandCard from './cards/HandCard.vue';

const store = useGameStore();

import { ref, computed, onMounted } from 'vue';
import { useGameScale } from '../composables/useGameScale';
import { useSetupStore } from '../stores/setupStore';
import type { PublicPlayerState } from '../../../backend/types/game';

const setup = useSetupStore();
const { scaleStyle } = useGameScale();

onMounted(() => { store.loadCardRegistry(); });

const heroColors = computed(() => {
  const id = viewingTeammate.value?.identity?.storageId ?? store.playerIdentity?.storageId;
  const hero = id != null ? setup.catalog.heroes.find(h => h.id === id) : undefined;
  return {
    primary:   hero?.primaryColor   ?? '#140c36',
    secondary: hero?.secondaryColor ?? '#f3bbbb',
  };
});

const villainColor = computed(() => {
  const chain = store.villainPhaseChain.join(',');
  const villain = setup.catalog.villains.find(v =>
    v.standardPhaseChain.join(',') === chain ||
    v.expertPhaseChain.join(',') === chain
  );
  return villain?.color ?? '#2a1775';
});

const boardStyle = computed(() => ({
  ...scaleStyle.value,
  '--hero-primary':   heroColors.value.primary,
  '--hero-secondary': heroColors.value.secondary,
  '--villain-color':  villainColor.value,
}));

const handDiscardSelected = ref<number[]>([]);

const turnLabel = computed(() => {
  if (store.currentPhase === 'PLAYER_TURN') {
    if (store.isMyTurn) return { text: 'Your Turn', cls: 'turn-mine' };
    const other = store.otherPlayers.find(p => p.userId === store.activePlayerId);
    return { text: `${other?.username ?? 'Teammate'}'s Turn`, cls: 'turn-other' };
  }
  if (store.villainPhaseTargetId) {
    const label = store.isVillainTargetingMe
      ? 'Villain targeting you'
      : `Villain targeting ${store.otherPlayers.find(p => p.userId === store.villainPhaseTargetId)?.username ?? 'teammate'}`;
    return { text: label, cls: 'turn-villain' };
  }
  return null;
});

// Cards shown in the hand discard modal — filtered by resourceFilter if specified
const discardableCards = computed(() => {
  if (!store.pendingHandDiscard) return store.hand;
  const filter = store.pendingHandDiscard.resourceFilter;
  if (!filter || filter.length === 0) return store.hand;
  return store.hand.filter(c =>
    (c as any).resources?.some((r: string) => filter.includes(r) || r === 'wild')
  );
});

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

// ── Phase tracker ─────────────────────────────────────────────────────────
const phaseSegments = [
  { phase: 'PLAYER_TURN',            label: 'Hero Phase',   isVillain: false },
  { phase: 'VILLAIN_STEP_1_THREAT',  label: '1 · Threat',   isVillain: true  },
  { phase: 'VILLAIN_STEP_2_ACTIVATION', label: '2 · Villain', isVillain: true },
  { phase: 'VILLAIN_STEP_3_MINIONS', label: '3 · Minions',  isVillain: true  },
  { phase: 'VILLAIN_STEP_4_DEAL',    label: '4 · Deal',     isVillain: true  },
  { phase: 'VILLAIN_STEP_5_REVEAL',  label: '5 · Reveal',   isVillain: true  },
];

// ── Cross-player targeting helpers ────────────────────────────────────────
// Teammates who have minions in the current validTargetIds set
const teammateTargetMinions = computed(() =>
  store.targeting.isActive
    ? store.otherPlayers.filter(p =>
        p.engagedMinions.some(m => store.targeting.validTargetIds.includes(m.instanceId))
      )
    : []
);
// Teammates who have allies in the current validTargetIds set
const teammateTargetAllies = computed(() =>
  store.targeting.isActive
    ? store.otherPlayers.filter(p =>
        p.tableau.some(c => store.targeting.validTargetIds.includes(c.instanceId!))
      )
    : []
);

// ── Teammate board panel ───────────────────────────────────────────────────
const envExpanded = ref(false);
const otherBoardsOpen = ref(false);
const viewingTeammateId = ref<string | null>(null);
const viewingTeammate = computed(() =>
  viewingTeammateId.value
    ? store.otherPlayers.find(p => p.userId === viewingTeammateId.value) ?? null
    : null
);

function toggleOtherBoards() {
  otherBoardsOpen.value = !otherBoardsOpen.value;
}

function selectTeammate(userId: string) {
  viewingTeammateId.value = viewingTeammateId.value === userId ? null : userId;
}

function tmIdentityImg(p: PublicPlayerState): string {
  if (!p.identity) return '';
  return p.identity.identityStatus === 'hero' ? p.identity.heroImgPath : p.identity.imgPath;
}
function tmHpPct(p: PublicPlayerState): number {
  const id = p.identity;
  if (!id || !id.hitPoints) return 100;
  return Math.round(((id.hitPointsRemaining ?? id.hitPoints) / id.hitPoints) * 100);
}
function tmHpClass(p: PublicPlayerState): string {
  const pct = tmHpPct(p);
  if (pct > 60) return 'hp-good';
  if (pct > 25) return 'hp-low';
  return 'hp-critical';
}
</script>

<template>
  <!-- Turn indicator banner — only shown in multiplayer -->
  <Transition name="turn-fade">
    <div
      v-if="turnLabel && store.otherPlayers.length > 0"
      class="turn-indicator"
      :class="turnLabel.cls"
    >
      {{ turnLabel.text }}
    </div>
  </Transition>

  <!-- Other boards tab — only shown in multiplayer -->
  <div v-if="store.otherPlayers.length > 0" class="other-boards-tab">
    <!-- Handle -->
    <button class="other-boards-handle" @click="toggleOtherBoards">
      <span class="other-boards-label">OTHER BOARDS</span>
      <span class="other-boards-arrow">{{ otherBoardsOpen ? '▶' : '◀' }}</span>
    </button>

    <!-- Slide-out panel -->
    <Transition name="slide-panel">
      <div v-if="otherBoardsOpen" class="other-boards-panel">
        <div
          v-for="player in store.otherPlayers"
          :key="player.userId"
          class="teammate-wrapper"
          :class="{ 'is-viewing': viewingTeammateId === player.userId }"
          title="Click to view board"
          @click="selectTeammate(player.userId)"
        >
          <TeammateBoard
            :player="player"
            :is-villain-target="player.userId === store.villainPhaseTargetId"
          />
        </div>
      </div>
    </Transition>
  </div>

  <!-- Standard II: Pursued by the Past — fixed top-center tab -->
  <div v-if="store.environmentCard" class="env-tab">
    <button class="env-tab-btn" @click="envExpanded = !envExpanded">
      <span class="env-tab-name">{{ store.environmentCard.name }}</span>
      <span
        class="env-tab-counter"
        :class="{ 'env-counter-warn': store.environmentCard.counters >= store.otherPlayers.length + 4 }"
      >{{ store.environmentCard.counters }}&thinsp;/&thinsp;{{ store.otherPlayers.length + 4 }}</span>
      <span class="env-tab-arrow">{{ envExpanded ? '▲' : '▼' }}</span>
    </button>
    <Transition name="env-drop">
      <div v-if="envExpanded" class="env-panel" @click.stop>
        <img
          :src="store.environmentCard.imgPath || '/cards/misc/villain-card-back.png'"
          :alt="store.environmentCard.name"
          class="env-card-img"
        />
        <div class="env-panel-info">
          <span class="env-side-badge">{{ store.environmentCard.flipped ? 'Side B' : 'Side A' }}</span>
          <span class="env-count-text">
            {{ store.environmentCard.counters }}&nbsp;pursuit counter{{ store.environmentCard.counters !== 1 ? 's' : '' }}
          </span>
        </div>
        <div class="env-pip-row">
          <span
            v-for="i in store.otherPlayers.length + 4"
            :key="i"
            class="env-pip"
            :class="{ filled: i <= store.environmentCard.counters }"
          />
        </div>
      </div>
    </Transition>
  </div>

  <main class="game-container" :style="boardStyle">

    <!-- ── Phase tracker ─────────────────────────────────────────────────── -->
    <div class="phase-bar">
      <div
        v-for="seg in phaseSegments"
        :key="seg.phase"
        class="phase-seg"
        :class="{ 'phase-active': store.currentPhase === seg.phase, 'phase-villain': seg.isVillain }"
      >
        <span class="seg-label">{{ seg.label }}</span>
      </div>
    </div>

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
              <div v-if="option.imgPath" class="option-card" @click="store.activePrompt?.type === 'CHOICE_WINDOW' ? store.respondToPrompt({ type: 'select_option', optionId: String(option.id) }) : store.selectInterruptCard(option)">
                <div class="option-img-wrap">
                  <img :src="option.imgPath" :alt="option.name" />
                  <span v-if="option.cost" class="cost-badge">{{ option.cost }}</span>
                </div>
                <span class="option-name">{{ option.name }}</span>
              </div>

              <button v-else class="option-choice" @click="store.respondToPrompt({ type: 'select_option', optionId: String(option.id) })">
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
        />

        <SideSchemes class="side-scheme-component"
          :side-schemes="store.activeSideSchemes"
        />
      </div>
    </section>

    <section class="middle-section">
      <!-- Viewing-teammate badge -->
      <div v-if="viewingTeammate" class="viewing-badge">
        Viewing <strong>{{ viewingTeammate.username }}</strong>'s board
        <button class="btn-my-board" @click="viewingTeammateId = null">← My Board</button>
      </div>

      <template v-if="viewingTeammate">
        <PlayerEngagedMinions :minions="viewingTeammate.engagedMinions" />
        <PlayerTableau class="tableau-component" :tableau-cards="viewingTeammate.tableau" />
      </template>
      <template v-else>
        <PlayerEngagedMinions :minions="store.engagedMinions" />
        <PlayerTableau class="tableau-component" :tableau-cards="store.tableauCards" />
      </template>

      <!-- Cross-player minion targeting -->
      <div
        v-if="teammateTargetMinions.length > 0 && !viewingTeammate"
        class="tm-minion-targets"
      >
        <template v-for="tm in teammateTargetMinions" :key="tm.userId">
          <div class="tm-minion-label">{{ tm.username }}'s minions</div>
          <PlayerEngagedMinions :minions="tm.engagedMinions" />
        </template>
      </div>

      <!-- Cross-player ally targeting -->
      <div
        v-if="teammateTargetAllies.length > 0 && !viewingTeammate"
        class="tm-minion-targets"
      >
        <template v-for="tm in teammateTargetAllies" :key="tm.userId">
          <div class="tm-minion-label">{{ tm.username }}'s allies</div>
          <PlayerTableau :tableau-cards="tm.tableau" />
        </template>
      </div>
    </section>

    <footer class="bottom-bar">
      <!-- ── Viewing teammate's board ── -->
      <template v-if="viewingTeammate">
        <div class="left-group" style="cursor:pointer" @click="viewingTeammateId = null" title="Back to my board">
          <!-- Deck count stub — same size as real deck -->
          <div class="deck-wrapper">
            <div class="tm-deck-stub">
              <img :src="store.playerCardBackImg" class="tm-deck-back" alt="Deck" />
              <span class="tm-deck-num">{{ viewingTeammate.deckCount }}</span>
            </div>
          </div>
          <!-- Read-only identity card — same width as real identity (175px) -->
          <div v-if="viewingTeammate.identity" class="tm-id-card">
            <img
              :src="tmIdentityImg(viewingTeammate)"
              class="tm-id-img"
              :alt="viewingTeammate.identity.name"
            />
            <div class="tm-id-hp-bar">
              <div
                class="tm-id-hp-fill"
                :class="tmHpClass(viewingTeammate)"
                :style="{ width: tmHpPct(viewingTeammate) + '%' }"
              />
            </div>
            <div class="tm-id-hp-text" :class="tmHpClass(viewingTeammate)">
              {{ viewingTeammate.identity.hitPointsRemaining }} / {{ viewingTeammate.identity.hitPoints }}
            </div>
          </div>
        </div>

        <!-- Real hand cards (coop — teammates can see each other's hands) -->
        <div class="hand tm-hand">
          <HandCard
            v-for="card in viewingTeammate.hand"
            :key="card.instanceId"
            :card="card"
            mode="none"
          />
        </div>

        <!-- Discard pile -->
        <DiscardPile
          class="PlayerDiscard"
          :pileIds="viewingTeammate.playerDiscardIds"
          :empty-image-path="store.playerCardBackImg"
          image-type="player"
        />
      </template>

      <!-- ── My own board ── -->
      <template v-else>
        <div class="left-group">
          <div class="deck-wrapper">
            <Transition name="fade">
              <div v-if="store.currentPhase === 'PLAYER_TURN'" class="end-turn-group">
                <!-- Waiting for a teammate's turn -->
                <div v-if="!store.isMyTurn && store.otherPlayers.length > 0" class="waiting-turn">
                  <div class="waiting-dots"><span/><span/><span/></div>
                  <span class="waiting-name">{{ store.otherPlayers.find(p => p.userId === store.activePlayerId)?.username ?? 'Teammate' }}</span>
                  <span class="waiting-label">taking their turn</span>
                </div>
                <!-- My turn end-turn button -->
                <button
                  v-else
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
            />
          </div>

          <PlayerIdentityCard v-if="store.playerIdentity" />
        </div>

        <PlayerHand class="hand" :hand="store.hand" />

        <DiscardPile
          class="PlayerDiscard"
          :pileIds="store.playerDiscardIds"
          :empty-image-path="store.playerCardBackImg"
          :image-type="'player'"
        />
      </template>
    </footer>
  </main>

  <GameLog />

  <Teleport to="body">
    <Transition name="prompt-fade">
      <div v-if="store.pendingHandDiscard" class="prompt-overlay">
        <div class="prompt-modal">
          <div class="prompt-top">
            <span class="prompt-tag">{{ store.pendingHandDiscard.title }}</span>
            <span v-if="store.activeCardId !== null" class="payment-fraction" :class="store.isCostMet ? 'met' : ''">
              PAYING: {{ Object.values(store.committedResources).reduce((a: number, b: number) => a + b, 0) }}
              / {{ Math.max(0, (store.activeCard?.cost ?? 0) - store.pendingCostReduction) }}
            </span>
          </div>
          <p class="hand-discard-hint">
            {{ store.pendingHandDiscard.hint }}
            ({{ handDiscardSelected.length }} selected)
          </p>
          <div class="options-row">
            <div
              v-for="card in discardableCards"
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
            <button class="btn-pass" @click="store.cancelHandDiscard(); handDiscardSelected.splice(0)">Cancel</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="prompt-fade">
      <div v-if="store.pendingYesNo" class="prompt-overlay">
        <div class="prompt-modal yes-no-modal">
          <div class="prompt-top">
            <span class="prompt-tag">OBLIGATION</span>
          </div>
          <p class="yes-no-question">{{ store.pendingYesNo.question }}</p>
          <div class="yes-no-actions">
            <button class="btn-yes" @click="store.respondYesNo(true)">Yes</button>
            <button class="btn-pass" @click="store.respondYesNo(false)">No</button>
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
    grid-template-rows: auto auto 1fr auto;
    height: 100vh;
    width: 100vw;
    box-sizing: border-box;
    overflow: hidden;
    background-color: #cbcbcb;
  }

  /* ── Phase tracker ─────────────────────────────────────────────────────── */
  .phase-bar {
    display: flex;
    align-items: stretch;
    height: 28px;
    background: rgba(0, 0, 0, 0.55);
    overflow: hidden;
    user-select: none;
  }

  .phase-seg {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    transition: background 0.3s, color 0.3s;
    position: relative;
  }
  .phase-seg:last-child { border-right: none; }

  .phase-seg.phase-active {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    animation: phase-flash 0.5s ease-out;
  }
  .phase-seg.phase-active:not(.phase-villain) {
    background: rgba(46, 204, 113, 0.3);
    color: #a8ffc6;
  }
  .phase-seg.phase-active.phase-villain {
    background: rgba(200, 30, 30, 0.45);
    color: #ffb3b3;
  }

  @keyframes phase-flash {
    0%   { opacity: 0; transform: scaleY(0.6); }
    60%  { opacity: 1; transform: scaleY(1.1); }
    100% { opacity: 1; transform: scaleY(1); }
  }

  .seg-label { pointer-events: none; }

  .villain-section {
    width: 100%;
    padding: 10px 20px;
    box-sizing: border-box;
  }

  .middle-section {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 20px;
    overflow: visible;
    padding: 20px;
  }

  .encounter-component { grid-column: 1; justify-self: start; }
  .tableau-component { display: flex; justify-content: center; }

  .bottom-bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 12px;
    gap: 12px;
    background: var(--hero-primary);
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
    background: var(--hero-secondary);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 800;
    cursor: pointer;
    width: 100%;
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35);
    transition: all 0.1s ease;
    white-space: nowrap;
    z-index: 10;
  }

  .btn-end-turn:hover { filter: brightness(1.15); transform: translateY(-1px); }
  .btn-end-turn:active { transform: translateY(2px); box-shadow: none; }
  .btn-end-turn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; filter: none; }

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

  .payment-fraction {
    font-weight: 900;
    font-size: 0.9rem;
    color: white;
    margin-left: auto;
  }
  .payment-fraction.met { color: #2ecc71; }

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
  .resource-wild      { background: #27ae60; }

  .yes-no-modal { width: 420px; text-align: center; }
  .yes-no-question { font-size: 1.2rem; color: rgba(255,255,255,0.85); margin: 20px 0 28px; line-height: 1.5; }
  .yes-no-actions { display: flex; justify-content: center; gap: 20px; }
  .btn-yes {
    background: #2ecc71;
    border: none;
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    padding: 10px 32px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-yes:hover { background: #27ae60; }

  /* ── Multiplayer UI ────────────────────────────────────────────────────── */

  .turn-indicator {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    padding: 5px 18px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    pointer-events: none;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
  }

  .turn-mine    { background: #2ecc71; color: #0a2e12; }
  .turn-other   { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.2); }
  .turn-villain { background: #e23c3c; color: white; }

  .turn-fade-enter-active, .turn-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
  .turn-fade-enter-from, .turn-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }

  /* ── Other Boards tab ───────────────────────────────────────────────── */
  .other-boards-tab {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 500;
    display: flex;
    align-items: center;
  }

  .other-boards-handle {
    writing-mode: vertical-rl;
    background: rgba(10, 10, 10, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-right: none;
    border-radius: 8px 0 0 8px;
    padding: 14px 7px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: background 0.15s, color 0.15s;
  }
  .other-boards-handle:hover { background: rgba(30,30,30,0.92); color: #fff; }

  .other-boards-label { writing-mode: vertical-rl; }
  .other-boards-arrow { writing-mode: horizontal-tb; font-size: 0.55rem; }

  .other-boards-panel {
    background: rgba(10, 10, 10, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-right: none;
    border-radius: 8px 0 0 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .teammate-wrapper {
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
    border-radius: 8px;
    border: 2px solid transparent;
    transition: border-color 0.15s;
  }
  .teammate-wrapper:hover { transform: translateX(-3px); }
  .teammate-wrapper.is-viewing { border-color: #e8c84a; }

  .slide-panel-enter-active, .slide-panel-leave-active { transition: opacity 0.2s, transform 0.2s; }
  .slide-panel-enter-from, .slide-panel-leave-to { opacity: 0; transform: translateX(20px); }

  /* ── Teammate board view ───────────────────────────────────────────── */

  /* Floating badge in middle-section */
  .middle-section { position: relative; }

  .viewing-badge {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 20px;
    padding: 4px 14px 4px 16px;
    font-size: 0.78rem;
    color: rgba(255,255,255,0.75);
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
    pointer-events: auto;
  }
  .viewing-badge strong { color: #e8c84a; }

  .btn-my-board {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 10px;
    color: rgba(255,255,255,0.7);
    font-size: 0.72rem;
    padding: 2px 10px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .btn-my-board:hover { background: rgba(255,255,255,0.2); color: #fff; }

  /* HP colour classes (reused from TeammateBoard) */
  .hp-good     { background: #4caf50; color: #4caf50; }
  .hp-low      { background: #ff9800; color: #ff9800; }
  .hp-critical { background: #f44336; color: #f44336; }

  /* Teammate deck stub in bottom-bar */
  .tm-deck-stub {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tm-deck-back {
    width: 100px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.15);
    display: block;
  }
  .tm-deck-num {
    position: absolute;
    bottom: 4px;
    right: 4px;
    background: rgba(0,0,0,0.65);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
  }

  /* Read-only identity card in bottom-bar */
  .tm-id-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .tm-id-img {
    width: 175px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.2);
    display: block;
  }
  .tm-id-hp-bar {
    width: 100%;
    height: 10px;
    background: rgba(255,255,255,0.12);
    border-radius: 3px;
    overflow: hidden;
  }
  .tm-id-hp-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s ease;
  }
  .tm-id-hp-text {
    font-size: 0.72rem;
    font-weight: 700;
  }

  /* Teammate hand — uses real HandCard components */
  .tm-hand {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    min-width: 0;
    pointer-events: none;
  }

  /* Waiting-for-teammate indicator */
  .waiting-turn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    min-width: 100px;
  }
  .waiting-name {
    font-size: 0.72rem;
    font-weight: 800;
    color: rgba(255,255,255,0.85);
    text-align: center;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .waiting-label {
    font-size: 0.6rem;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .waiting-dots {
    display: flex;
    gap: 4px;
  }
  .waiting-dots span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255,255,255,0.4);
    animation: waiting-pulse 1.2s ease-in-out infinite;
  }
  .waiting-dots span:nth-child(2) { animation-delay: 0.2s; }
  .waiting-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes waiting-pulse {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40%            { opacity: 1;   transform: scale(1.2); }
  }

  /* Cross-player minion targeting row */
  .tm-minion-targets {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 80, 80, 0.3);
    border-radius: 8px;
    animation: pulse-border 1.5s infinite;
  }

  .tm-minion-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 140, 140, 0.8);
  }

  @keyframes pulse-border {
    0%, 100% { border-color: rgba(255, 80, 80, 0.3); }
    50%       { border-color: rgba(255, 80, 80, 0.7); }
  }

  /* ── Standard II: Environment tab (fixed top-center) ── */
  .env-tab {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 700;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .env-tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(8, 16, 42, 0.92);
    border: 1px solid rgba(100, 150, 255, 0.45);
    border-top: none;
    border-radius: 0 0 10px 10px;
    padding: 5px 16px 6px;
    cursor: pointer;
    color: #bcd4ff;
    font-size: 0.68rem;
    font-weight: 700;
    white-space: nowrap;
    letter-spacing: 0.04em;
    box-shadow: 0 4px 18px rgba(0, 0, 20, 0.6);
    transition: background 0.15s;
    user-select: none;
  }
  .env-tab-btn:hover { background: rgba(18, 36, 90, 0.95); }

  .env-tab-name { font-weight: 800; letter-spacing: 0.05em; }

  .env-tab-counter {
    background: rgba(100, 150, 255, 0.18);
    border-radius: 10px;
    padding: 1px 8px;
    font-size: 0.62rem;
    font-weight: 800;
    transition: background 0.2s, color 0.2s;
  }
  .env-counter-warn {
    background: rgba(255, 70, 70, 0.35);
    color: #ffaaaa;
  }

  .env-tab-arrow { font-size: 0.5rem; opacity: 0.55; }

  .env-panel {
    background: rgba(8, 14, 34, 0.98);
    border: 1px solid rgba(100, 150, 255, 0.4);
    border-top: none;
    border-radius: 0 0 12px 12px;
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 220px;
    box-shadow: 0 14px 44px rgba(0, 0, 0, 0.75);
  }

  .env-card-img {
    width: 100%;
    border-radius: 8px;
    display: block;
    border: 1px solid rgba(100, 150, 255, 0.3);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7);
  }

  .env-panel-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .env-side-badge {
    font-size: 0.62rem;
    font-weight: 800;
    background: rgba(100, 150, 255, 0.25);
    border-radius: 4px;
    padding: 2px 8px;
    color: #a8c8ff;
    letter-spacing: 0.05em;
  }

  .env-count-text {
    font-size: 0.62rem;
    color: #c0d4ff;
  }

  .env-pip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
  }

  .env-pip {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 1.5px solid rgba(100, 150, 255, 0.45);
    background: transparent;
    transition: background 0.2s, box-shadow 0.2s;
  }
  .env-pip.filled {
    background: rgba(100, 150, 255, 0.9);
    box-shadow: 0 0 7px rgba(100, 150, 255, 0.75);
  }

  .env-drop-enter-active { transition: opacity 0.18s ease-out, transform 0.18s ease-out; }
  .env-drop-leave-active { transition: opacity 0.12s ease-in, transform 0.12s ease-in; }
  .env-drop-enter-from, .env-drop-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
