<script setup lang="ts">
import { computed } from 'vue';
import type { PublicPlayerState } from '../../../../backend/types/game';
import { useGameStore } from '../../stores/gameStore';

const props = defineProps<{
    player: PublicPlayerState;
    isVillainTarget: boolean;
}>();

const store = useGameStore();

const identityImg = computed(() => {
    if (!props.player.identity) return '';
    const id = props.player.identity;
    return id.identityStatus === 'hero' ? id.heroImgPath : id.imgPath;
});

const hpPercent = computed(() => {
    const id = props.player.identity;
    if (!id || !id.hitPoints) return 100;
    return Math.round((id.hitPointsRemaining! / id.hitPoints) * 100);
});

const hpClass = computed(() => {
    if (hpPercent.value > 60) return 'hp-good';
    if (hpPercent.value > 25) return 'hp-low';
    return 'hp-critical';
});

const tableauImgFor = (storageId: number | undefined) => {
    if (storageId == null) return '';
    return store.playerCardRegistry[storageId] ?? '';
};
</script>

<template>
  <div class="teammate-board" :class="{ 'villain-targeting': isVillainTarget }">
    <div class="teammate-header">
      <span class="teammate-name">{{ player.username }}</span>
      <span v-if="isVillainTarget" class="villain-target-badge">Villain Target</span>
    </div>

    <div class="teammate-body">
      <!-- Identity card -->
      <div class="teammate-identity" v-if="player.identity">
        <img v-if="identityImg" :src="identityImg" :alt="player.identity.name" class="identity-img" />
        <div class="teammate-hp" :class="hpClass">
          {{ player.identity.hitPointsRemaining }}/{{ player.identity.hitPoints }} HP
        </div>
      </div>

      <!-- Stats row -->
      <div class="teammate-stats">
        <span class="stat-badge">✋ {{ player.handCount }}</span>
        <span class="stat-badge">🃏 {{ player.deckCount }}</span>
        <span v-if="player.encounterPileCount > 0" class="stat-badge encounter">⚡ {{ player.encounterPileCount }}</span>
        <span v-if="player.engagedMinions.length > 0" class="stat-badge minion">⚔ {{ player.engagedMinions.length }}</span>
      </div>

      <!-- Tableau (compact) -->
      <div v-if="player.tableau.length > 0" class="teammate-tableau">
        <div
          v-for="card in player.tableau"
          :key="card.instanceId"
          class="teammate-tableau-card"
          :title="card.name"
        >
          <img
            v-if="tableauImgFor(card.storageId)"
            :src="tableauImgFor(card.storageId)"
            :alt="card.name"
          />
          <span v-else class="card-name-fallback">{{ card.name }}</span>
        </div>
      </div>

      <!-- Engaged minions (compact) -->
      <div v-if="player.engagedMinions.length > 0" class="teammate-minions">
        <div
          v-for="minion in player.engagedMinions"
          :key="minion.instanceId"
          class="teammate-minion"
          :title="minion.name"
        >
          <span class="minion-name">{{ minion.name }}</span>
          <span class="minion-hp">{{ minion.hitPointsRemaining }}/{{ minion.hitPoints }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.teammate-board {
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 180px;
  max-width: 240px;
  transition: border-color 0.3s;
}

.teammate-board.villain-targeting {
  border-color: #e23c3c;
  box-shadow: 0 0 8px rgba(226, 60, 60, 0.5);
}

.teammate-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.teammate-name {
  font-weight: bold;
  font-size: 0.75rem;
  color: #e8e8e8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.villain-target-badge {
  background: #e23c3c;
  color: white;
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}

.teammate-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.teammate-identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.identity-img {
  width: 36px;
  height: 52px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.2);
}

.teammate-hp {
  font-size: 0.7rem;
  font-weight: bold;
}
.hp-good { color: #4caf50; }
.hp-low  { color: #ff9800; }
.hp-critical { color: #f44336; }

.teammate-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.stat-badge {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.65rem;
  color: #ccc;
}

.stat-badge.encounter { background: rgba(230, 180, 0, 0.25); color: #f0c040; }
.stat-badge.minion    { background: rgba(226, 60, 60, 0.25); color: #f08080; }

.teammate-tableau {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.teammate-tableau-card {
  width: 28px;
  height: 40px;
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.15);
}

.teammate-tableau-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-name-fallback {
  font-size: 0.5rem;
  color: #aaa;
  display: block;
  padding: 2px;
}

.teammate-minions {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.teammate-minion {
  display: flex;
  justify-content: space-between;
  background: rgba(226, 60, 60, 0.15);
  border-radius: 3px;
  padding: 2px 5px;
  font-size: 0.65rem;
  color: #f08080;
}

.minion-name { flex: 1; }
.minion-hp { color: #ccc; }
</style>
