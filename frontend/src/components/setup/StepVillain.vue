<script setup lang="ts">
import { useSetupStore } from '../../stores/setupStore';
import { villainLibrary } from '../../cards/cardStore';

const setup = useSetupStore();

const selectedVillain = () => villainLibrary.find(v => v.id === setup.selectedVillainId);
</script>

<template>
    <div class="step-villain">
        <h2 class="step-title">Choose Your Villain</h2>

        <div class="villain-grid">
            <button
                v-for="villain in villainLibrary"
                :key="villain.id"
                class="villain-card"
                :class="{ selected: setup.selectedVillainId === villain.id }"
                @click="setup.selectVillain(villain.id)"
            >
                <img
                    :src="setup.expertMode && villain.expertImgPath ? villain.expertImgPath : villain.imgPath"
                    :alt="villain.name"
                />
                <span class="villain-name">{{ villain.name }}</span>
            </button>
        </div>

        <div class="difficulty-section">
            <div class="difficulty-label">Difficulty</div>
            <div class="difficulty-toggle">
                <button
                    class="diff-btn"
                    :class="{ active: !setup.expertMode }"
                    @click="setup.setExpertMode(false)"
                >
                    Standard
                </button>
                <button
                    class="diff-btn expert"
                    :class="{ active: setup.expertMode }"
                    @click="setup.setExpertMode(true)"
                >
                    Expert
                </button>
            </div>

            <div v-if="setup.expertMode" class="expert-note">
                <template v-if="selectedVillain()?.expertVillainId">
                    Starts on Phase II · 3 additional encounter cards
                </template>
                <template v-else>
                    3 additional encounter cards
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.step-villain {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
}

.step-title {
    font-size: 2rem;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    margin: 0;
    letter-spacing: 0.04em;
}

.villain-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
}

.villain-card {
    background: rgba(255,255,255,0.05);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    transition: border-color 0.2s, transform 0.15s, background 0.2s;
    width: 220px;
}

.villain-card:hover {
    border-color: rgba(255,255,255,0.35);
    transform: translateY(-4px);
    background: rgba(255,255,255,0.08);
}

.villain-card.selected {
    border-color: #e85454;
    border-width: 3px;
    background: rgba(232, 84, 84, 0.22);
    box-shadow: 0 0 0 3px rgba(232, 84, 84, 0.35), 0 8px 24px rgba(232, 84, 84, 0.25);
    transform: translateY(-6px);
}

.villain-card img {
    width: 100%;
    border-radius: 8px;
    display: block;
}

.villain-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
}

/* ── Difficulty ── */
.difficulty-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.difficulty-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
}

.difficulty-toggle {
    display: flex;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    overflow: hidden;
}

.diff-btn {
    background: transparent;
    border: none;
    padding: 9px 28px;
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    letter-spacing: 0.03em;
}

.diff-btn + .diff-btn {
    border-left: 1px solid rgba(255,255,255,0.15);
}

.diff-btn:hover:not(.active) {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.7);
}

.diff-btn.active {
    background: rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.9);
}

.diff-btn.expert.active {
    background: rgba(220, 60, 60, 0.25);
    color: #f08080;
}

.expert-note {
    font-size: 0.78rem;
    color: rgba(240, 128, 128, 0.8);
    font-style: italic;
    letter-spacing: 0.02em;
}
</style>
