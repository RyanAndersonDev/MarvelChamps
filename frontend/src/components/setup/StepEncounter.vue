<script setup lang="ts">
import { useSetupStore } from '../../stores/setupStore';
import { encounterLibrary, villainCardMap } from '../../cards/cardStore';

const setup = useSetupStore();
</script>

<template>
    <div class="step-encounter">
        <h2 class="step-title">Choose a Modular Encounter Set</h2>

        <div class="encounter-grid">
            <button
                v-for="set in encounterLibrary"
                :key="set.id"
                class="encounter-card"
                :class="{ selected: setup.selectedEncounterSetId === set.id }"
                @click="setup.selectEncounterSet(set.id)"
            >
                <div class="encounter-name">{{ set.name }}</div>
                <div class="encounter-desc">{{ set.description }}</div>
                <div class="encounter-cards-preview">
                    <span
                        v-for="(cardId, i) in [...new Set(set.cardIds)]"
                        :key="i"
                        class="card-chip"
                    >
                        {{ villainCardMap.get(cardId)?.name }}
                        <span class="card-chip-count" v-if="set.cardIds.filter(id => id === cardId).length > 1">
                            ×{{ set.cardIds.filter(id => id === cardId).length }}
                        </span>
                    </span>
                </div>
            </button>
        </div>
    </div>
</template>

<style scoped>
.step-encounter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    width: 100%;
}

.step-title {
    font-size: 2rem;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    margin: 0;
    letter-spacing: 0.04em;
}

.encounter-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: center;
    width: 100%;
    max-width: 1000px;
}

.encounter-card {
    background: rgba(255,255,255,0.05);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 28px 32px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color 0.2s, transform 0.15s, background 0.2s;
    text-align: left;
    min-width: 360px;
    max-width: 440px;
}

.encounter-card:hover {
    border-color: rgba(255,255,255,0.35);
    transform: translateY(-4px);
    background: rgba(255,255,255,0.08);
}

.encounter-card.selected {
    border-color: #54a0e8;
    border-width: 3px;
    background: rgba(84, 160, 232, 0.22);
    box-shadow: 0 0 0 3px rgba(84, 160, 232, 0.35), 0 8px 24px rgba(84, 160, 232, 0.25);
    transform: translateY(-6px);
}

.encounter-name {
    font-size: 1.4rem;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
}

.encounter-desc {
    font-size: 1rem;
    color: rgba(255,255,255,0.5);
    line-height: 1.4;
}

.encounter-cards-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
}

.card-chip {
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 0.9rem;
    color: rgba(255,255,255,0.6);
    display: flex;
    align-items: center;
    gap: 4px;
}

.card-chip-count {
    color: rgba(255,255,255,0.4);
    font-size: 0.65rem;
}
</style>
