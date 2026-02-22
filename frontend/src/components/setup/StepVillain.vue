<script setup lang="ts">
import { useSetupStore } from '../../stores/setupStore';
import { villainLibrary } from '../../cards/cardStore';

const setup = useSetupStore();
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
                <img :src="villain.imgPath" :alt="villain.name" />
                <span class="villain-name">{{ villain.name }}</span>
            </button>
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
    background: rgba(232, 84, 84, 0.12);
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
</style>
