<script setup lang="ts">
  import { computed } from 'vue';
  import { useGameStore } from '../../stores/gameStore';
  import BaseCard from './BaseCard.vue';
  import StatusPips from './StatusPips.vue';

  const store = useGameStore();
  const player = computed(() => store.hero);

  const currentSideImg = computed(() => {
    return player.value.identityStatus === 'hero' 
      ? player.value.heroImgPath 
      : player.value.imgPath;
  });

  const hpPercent = computed(() => (player.value.hitPointsRemaining! / player.value.hitPoints) * 100);
  const hpStatusClass = computed(() => {
    if (hpPercent.value > 60) return 'hp-good';
    if (hpPercent.value > 25) return 'hp-low';
    return 'hp-critical';
  });

  const currentLogic = computed(() =>
    player.value.identityStatus === 'hero' ? store.playerIdentity.heroLogic : store.playerIdentity.aeLogic
  );

  const hasManualAbility = computed(() => currentLogic.value?.type !== 'interrupt');

  const handleAbility = () => {
    if (!player.value.exhausted) {
      store.triggerIdentityCardAbility();
    }
  };

  const handleAttack = () => {
    store.requestTarget(null, 'enemy')
      .then(id => store.attackWithIdentity(id));
  };

  const handleThwart = () => {
    store.requestTarget(null, 'scheme')
      .then(id => store.thwartWithIdentity(id));
  };
</script>

<template>
  <div class="identity-compact">
    <div
      class="aura-wrapper"
      :class="player.exhausted ? 'aura-exhausted' : 'aura-ready'"
    >
      <BaseCard
        :img-path="currentSideImg"
        :orientation="'vertical'"
        :zoom-direction="'up'"
        class="mini-identity"
        :class="{ 'is-dimmed': player.exhausted }"
      />

      <div class="stat-badges">
        <template v-if="player.identityStatus === 'hero'">
          <div class="stat-badge blue">{{ player.thw }}</div>
          <div class="stat-badge red">{{ player.atk }}</div>
          <div class="stat-badge green">{{ player.def }}</div>
        </template>
        <template v-else>
          <div class="stat-badge yellow">{{ player.healing }}</div>
        </template>
      </div>
    </div>

    <div class="hp-container">
      <div class="hp-bar-bg">
        <div 
          class="hp-bar-fill" 
          :style="{ width: hpPercent + '%' }"
          :class="hpStatusClass"
        ></div>
      </div>
      <span class="hp-text">{{ player.hitPointsRemaining! }} / {{ player.hitPoints }} HP</span>
    </div>

    <StatusPips :stunned="player.stunned" :confused="player.confused" :tough="player.tough" />

    <div class="compact-controls">
      <div class="row-main">
        <button :disabled="store.currentPhase !== 'PLAYER_TURN' || store.idCardHasFlippedThisTurn" @click="store.flipIdentity" class="btn-sm btn-flip">FLIP</button>
        <button
          v-if="hasManualAbility"
          :disabled="store.currentPhase !== 'PLAYER_TURN' || player.exhausted || (currentLogic.type === 'resource' && !store.activeCardId) || (currentLogic.limit != null && (store.abilityUseCounts['identity'] ?? 0) >= currentLogic.limit.uses)"
          @click="handleAbility"
          class="btn-sm btn-ability"
        >
          ABILITY
        </button>
      </div>

      <div class="row-actions">
        <button
          v-if="player.identityStatus === 'alter-ego'"
          :disabled="store.currentPhase !== 'PLAYER_TURN' || player.exhausted || player.hitPointsRemaining! >= player.hitPoints"
          @click="store.healIdentity"
          class="btn-sm btn-heal"
        >
          RECOVER
        </button>

        <template v-else>
          <button :disabled="store.currentPhase !== 'PLAYER_TURN' || player.exhausted" @click="handleThwart" class="btn-sm btn-thw">THW</button>
          <button :disabled="store.currentPhase !== 'PLAYER_TURN' || player.exhausted" @click="handleAttack" class="btn-sm btn-atk">ATK</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .identity-compact {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 175px;
  }

  .aura-wrapper {
    padding: 2px;
    border-radius: 8px;
    transition: box-shadow 0.3s ease;
    width: 100%;
    position: relative;
  }

  .stat-badges {
    position: absolute;
    top: 6px;
    right: -2px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 15;
    pointer-events: none;
  }

  .stat-badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.75rem;
    color: white;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    border: 2px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
  }

  .stat-badge.blue   { background-color: #2196F3; }
  .stat-badge.red    { background-color: #f44336; }
  .stat-badge.green  { background-color: #27ae60; }
  .stat-badge.yellow { background-color: #e6ac00; }
  .aura-ready { box-shadow: 0 0 12px rgba(0, 255, 100, 0.7); }
  .aura-exhausted { box-shadow: 0 0 12px rgba(255, 0, 0, 0.7); }

  .mini-identity {
    width: 100%;
    height: auto;
    display: block;
  }

  .is-dimmed { 
    filter: grayscale(0.8) brightness(0.4); 
  }

  .hp-container {
    width: 95%;
    position: relative;
    height: 14px;
    display: flex;
    align-items: center;
  }
  .hp-bar-bg {
    width: 100%;
    height: 10px;
    background: #111;
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  .hp-bar-fill {
    height: 100%;
    transition: width 0.4s ease;
  }
  .hp-good { background: #27ae60; }
  .hp-low { background: #f39c12; }
  .hp-critical { background: #c0392b; }

  .hp-text {
    position: absolute;
    width: 100%;
    text-align: center;
    font-size: 0.65rem;
    font-weight: 900;
    color: white;
    text-shadow: 1px 1px 2px black;
    pointer-events: none;
  }

  .compact-controls {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }
  .row-main, .row-actions { display: flex; gap: 4px; }

  .btn-sm {
    flex: 1;
    padding: 6px 0;
    font-size: 0.65rem;
    font-weight: 800;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    background: #333;
    text-transform: uppercase;
  }

  .btn-sm:disabled { opacity: 0.2; cursor: not-allowed; }

  .btn-flip { background: #484664; border: 1px solid #666; }
  .btn-ability { background: #54245c; }

  .btn-heal { background: #f0cc58; color: black; font-weight: 900; }
  .btn-thw { background: #2980b9; }
  .btn-atk { background: #c0392b; }

  button:hover:not(:disabled) { filter: brightness(1.2); }
</style>