<script setup lang="ts">
  import { computed, ref } from "vue";
  import { useGameStore } from "../../stores/gameStore";
  import BaseCard from './BaseCard.vue';
  import StatusPips from './StatusPips.vue';
  import type { Ally, Upgrade, Support } from '@shared/types/card';

  const store = useGameStore();
  const props = defineProps<{ card: Ally | Upgrade | Support }>();

  const allyStats = computed(() => {
      if (props.card.type === 'ally') return props.card as Ally;
      return null;
  });

  const isTargetable = computed(() =>
      props.card.type === 'ally' &&
      store.targeting.isActive &&
      store.targeting.validTargetIds.includes(props.card.instanceId!)
  );

  function handleCardClick() {
      if (isTargetable.value) store.selectTarget(props.card.instanceId!);
  }

  const effectiveThw = computed(() => {
      if (!allyStats.value) return 0;
      const attachments: any[] = (allyStats.value as any).attachments ?? [];
      const dynamicBonus = (allyStats.value as any).dynamicThwBonus === 'sideSchemeCount' ? store.activeSideSchemes.length : 0;
      return (allyStats.value.thw ?? 0) + attachments.reduce((sum, att) => sum + (att.thwMod ?? 0), 0) + dynamicBonus;
  });

  const effectiveAtk = computed(() => {
      if (!allyStats.value) return 0;
      const attachments: any[] = (allyStats.value as any).attachments ?? [];
      return (allyStats.value.atk ?? 0) + attachments.reduce((sum, att) => sum + (att.atkMod ?? 0), 0);
  });

  const realAttachments = computed(() =>
      ((allyStats.value as any)?.attachments ?? []).filter((att: any) => !att.temporary)
  );

  function doAction(): void {
    store.activateTableauCard(props.card.instanceId!);
  }

  const isQuiver = computed(() => (props.card as any).storageId === 67);
  const quiverCards = computed((): any[] => isQuiver.value ? ((props.card as any).attachedCards ?? []) : []);
  const quiverOpen = ref(false);

  function playArrow(instanceId: number) {
    quiverOpen.value = false;
    store.playFromQuiver(instanceId);
  }
</script>

<template>
  <div class="tableau-card-wrapper" :class="{ 'is-targetable': isTargetable }" @click="handleCardClick">
    <Transition name="counter-pop" mode="out-in">
        <div
            v-if="(card.type === 'upgrade' || card.type === 'support') && (card as any).counters > 0"
            :key="(card as any).counters"
            class="counter-badge"
        >{{ (card as any).counters }}</div>
    </Transition>

    <div v-if="card.type === 'ally'" class="stat-badges">
        <div class="stat-badge blue">{{ effectiveThw }}</div>
        <div class="stat-badge red">{{ effectiveAtk }}</div>
        <div class="stat-badge orange">{{ allyStats!.hitPointsRemaining }}</div>
        <div v-if="(allyStats as any)?.counters > 0" class="stat-badge purple">{{ (allyStats as any).counters }}</div>
    </div>

    <BaseCard
      :img-path="card.imgPath"
      :orientation="'vertical'"
      :zoom-direction="'out'"
      :size="'small'"
      :no-zoom="store.targeting.isActive"
      :class="{ 'is-exhausted': card.exhausted }"
    />

    <!-- Ally attachments (hover tooltip) -->
    <div v-if="realAttachments.length" class="attachment-badge">
        ⚙ {{ realAttachments.length }}
        <div class="attachment-tooltip">
            <div v-for="att in realAttachments" :key="(att as any).instanceId ?? (att as any).storageId" class="tooltip-entry">
                <img :src="(att as any).imgPath" class="tooltip-img" />
                <span>{{ (att as any).name }}</span>
            </div>
        </div>
    </div>

    <!-- Quiver arrow badge (click to toggle panel) -->
    <div
      v-if="isQuiver && quiverCards.length > 0"
      class="quiver-badge"
      @click.stop="quiverOpen = !quiverOpen"
    >
      ⇧ {{ quiverCards.length }}
      <!-- Panel opens above the card so it doesn't push down into the hand area -->
      <Transition name="quiver-pop">
        <div v-if="quiverOpen" class="quiver-panel" @click.stop>
          <div v-for="qcard in quiverCards" :key="qcard.instanceId" class="quiver-entry">
            <img :src="qcard.imgPath" :alt="qcard.name" class="quiver-img" />
            <button
              class="quiver-play-btn"
              :disabled="store.currentPhase !== 'PLAYER_TURN'"
              @click.stop="playArrow(qcard.instanceId)"
            >Play</button>
          </div>
        </div>
      </Transition>
    </div>

    <StatusPips
      v-if="card.type === 'ally'"
      :stunned="allyStats?.stunned"
      :confused="allyStats?.confused"
      :tough="allyStats?.tough"
    />

    <div class="button-row">
      <button
        v-if="card.type === 'ally' && store.currentPhase === 'PLAYER_TURN'"
        class="ally-thw-button"
        :disabled="card.exhausted"
        @click="store.thwartWithAlly(card.instanceId!)"
      >THW</button>

      <button
        v-if="card.type === 'ally' && store.currentPhase === 'PLAYER_TURN'"
        class="ally-atk-button"
        :disabled="card.exhausted"
        @click="store.attackWithAlly(card.instanceId!)"
      >ATK</button>

      <button
        v-if="card.logic && !card.logic.forced && card.logic.type !== 'response' && card.logic.type !== 'interrupt' && (store.currentPhase === 'PLAYER_TURN' || store.activeCardId !== null)"
        :disabled="(card.abilityExhausts && card.exhausted) || (card.logic?.type === 'resource' && store.activeCardId === null)"
        @click="doAction">Action</button>
    </div>
  </div>
</template>

<style scoped>
  .tableau-card-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: fit-content;
  }

  .is-targetable {
    box-shadow: 0 0 16px 4px #f1c40f;
    border-radius: 8px;
    cursor: pointer;
  }

  .is-exhausted {
    filter: brightness(0.4) grayscale(0.7);
    transition: filter 0.2s ease-in-out;
  }

  .stat-badges {
    position: absolute;
    top: 5px;
    right: 5px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 99;
    pointer-events: none;
  }

  .stat-badge {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    width: 22px !important;
    height: 22px !important;
    min-width: 22px !important;
    min-height: 22px !important;
    border-radius: 50% !important;

    color: white !important;
    font-weight: bold !important;
    font-size: 0.75rem !important;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;

    border: 2px solid white !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5) !important;
  }

  .counter-pop-enter-active { animation: counter-bounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  .counter-pop-leave-active { animation: counter-bounce 0.15s ease reverse; }
  @keyframes counter-bounce {
    from { transform: scale(0.4); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  .counter-badge {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e6ac00;
    color: white;
    font-weight: bold;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    z-index: 99;
    pointer-events: none;
  }

  .stat-badge.blue { background-color: #2196F3 !important; }
  .stat-badge.red { background-color: #f44336 !important; }
  .stat-badge.orange { background-color: #FF9800 !important; }
  .stat-badge.purple { background-color: #9C27B0 !important; }

  /* ── Ally attachments ── */
  .attachment-badge {
    position: absolute;
    bottom: 36px;
    left: 4px;
    background: #e67e22;
    color: white;
    font-size: 0.65rem;
    font-weight: 900;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1.5px solid #fff;
    z-index: 99;
    cursor: default;
    pointer-events: all;
  }

  .attachment-tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    background: rgba(10, 10, 20, 0.97);
    border: 1px solid #e67e22;
    border-radius: 8px;
    padding: 16px;
    z-index: 9999;
    flex-direction: row;
    gap: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.9);
    white-space: nowrap;
  }

  .attachment-badge:hover .attachment-tooltip {
    display: flex;
  }

  .tooltip-entry {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #eee;
    font-size: 0.85rem;
    font-weight: 700;
    text-align: center;
  }

  .tooltip-img {
    width: 240px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.7);
    flex-shrink: 0;
  }

  /* ── Quiver badge + panel ── */
  .quiver-badge {
    position: absolute;
    bottom: 36px;
    right: 4px;
    background: #2980b9;
    color: white;
    font-size: 0.65rem;
    font-weight: 900;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1.5px solid #fff;
    z-index: 99;
    cursor: pointer;
    user-select: none;
    pointer-events: all;
  }

  .quiver-panel {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    background: rgba(10, 10, 20, 0.97);
    border: 1px solid #2980b9;
    border-radius: 8px;
    padding: 12px;
    z-index: 9999;
    display: flex;
    flex-direction: row;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.9);
    white-space: nowrap;
  }

  .quiver-entry {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .quiver-img {
    width: 200px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.7);
  }

  .quiver-play-btn {
    width: 100%;
    padding: 5px 12px;
    font-size: 0.75rem;
    font-weight: bold;
    background: #27ae60;
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .quiver-play-btn:hover:not(:disabled) { background: #2ecc71; }
  .quiver-play-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .quiver-pop-enter-active, .quiver-pop-leave-active { transition: opacity 0.15s, transform 0.15s; }
  .quiver-pop-enter-from, .quiver-pop-leave-to { opacity: 0; transform: translateY(6px); }

  /* ── Buttons ── */
  .button-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    width: 100%;
    justify-content: center;
  }

  button {
    width: 100%;
    padding: 4px 0;
    font-size: 0.65rem;
    font-weight: bold;
    cursor: pointer;
    background: var(--hero-primary, #333);
    color: white;
    border: 1px solid #000;
    border-radius: 4px;
  }

  button:last-child:nth-child(odd) {
    grid-column: 1 / span 2;
    justify-self: center;
    width: auto;
    min-width: 50%;
    padding-left: 10px;
    padding-right: 10px;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ally-thw-button { background-color: #2196F3 !important; }
  .ally-atk-button { background-color: #f44336 !important; }
</style>
