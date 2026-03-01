<script setup lang="ts">
import { useSetupStore } from '../../stores/setupStore';

const setup = useSetupStore();
</script>

<template>
    <div class="step-hero">
        <h2 class="step-title">Choose Your Hero</h2>
        <div class="hero-grid">
            <button
                v-for="hero in setup.catalog.heroes"
                :key="hero.id"
                class="hero-card"
                :class="{ selected: setup.selectedHeroId === hero.id }"
                @click="setup.selectHero(hero.id)"
            >
                <img :src="hero.heroImgPath" :alt="hero.name" />
                <span class="hero-name">{{ hero.name }}</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.step-hero {
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

.hero-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
}

.hero-card {
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

.hero-card:hover {
    border-color: rgba(255,255,255,0.35);
    transform: translateY(-4px);
    background: rgba(255,255,255,0.08);
}

.hero-card.selected {
    border-color: #e8c84a;
    border-width: 3px;
    background: rgba(232, 200, 74, 0.22);
    box-shadow: 0 0 0 3px rgba(232, 200, 74, 0.35), 0 8px 24px rgba(232, 200, 74, 0.25);
    transform: translateY(-6px);
}

.hero-card img {
    width: 100%;
    border-radius: 8px;
    display: block;
}

.hero-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
}
</style>
