<script setup lang="ts">
  import { computed } from 'vue';
  import { useGameStore } from '../../stores/gameStore';
  import BaseCard from './BaseCard.vue';

  const store = useGameStore();
  const player = computed(() => store.playerIdentity);

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

    <div class="compact-controls">
      <div class="row-main">
        <button @click="store.flipIdentity" class="btn-sm btn-flip">FLIP</button>
        <button 
          :disabled="player.exhausted" 
          @click="handleAbility" 
          class="btn-sm btn-ability"
        >
          ABILITY
        </button>
      </div>

      <div class="row-actions">
        <button 
          v-if="player.identityStatus === 'alter-ego'" 
          :disabled="player.exhausted"
          @click="store.healIdentity" 
          class="btn-sm btn-heal"
        >
          RECOVER
        </button>

        <template v-else>
          <button :disabled="player.exhausted" @click="handleThwart" class="btn-sm btn-thw">THW</button>
          <button :disabled="player.exhausted" @click="handleAttack" class="btn-sm btn-atk">ATK</button>
          <button :disabled="player.exhausted" @click="store.defend" class="btn-sm btn-def">DEF</button>
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
  }
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
  .btn-def { background: #27ae60; }

  button:hover:not(:disabled) { filter: brightness(1.2); }
</style>