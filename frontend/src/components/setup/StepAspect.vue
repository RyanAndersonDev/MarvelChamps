<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSetupStore } from '../../stores/setupStore';
import { cardMap } from '../../cards/cardStore';
import type { Aspect } from '../../types/card';

const setup = useSetupStore();

const ASPECTS: { id: Aspect; label: string; color: string }[] = [
    { id: 'aggression',  label: 'Aggression',  color: '#c0392b' },
    { id: 'justice',     label: 'Justice',     color: '#d4a017' },
    { id: 'leadership',  label: 'Leadership',  color: '#2471a3' },
    { id: 'protection',  label: 'Protection',  color: '#1e8449' },
];

// Cards in the binder (neutral + currently selected aspect)
const binderCards = computed(() => {
    const all = Array.from(cardMap.entries()).map(([id, card]) => ({ ...card, storageId: id }));
    const neutral = all.filter(c => c.aspect === 'neutral').sort((a, b) => a.cost - b.cost);
    const aspect  = setup.selectedAspect
        ? all.filter(c => c.aspect === setup.selectedAspect).sort((a, b) => a.cost - b.cost)
        : [];
    return { neutral, aspect };
});

// Hero-specific cards (always included, read-only display)
const heroCards = computed(() => {
    const hero = setup.selectedHero;
    if (!hero) return [];
    const uniqueIds = [...new Set(hero.heroDeckIds)];
    return uniqueIds.map(id => {
        const card = cardMap.get(id);
        const count = hero.heroDeckIds.filter(i => i === id).length;
        return card ? { ...card, storageId: id, count } : null;
    }).filter(Boolean) as any[];
});

// Extra copies chosen from the binder (on top of the hero deck)
const extraCounts = ref<Record<number, number>>({});

const MAX_COPIES = 3;

function increment(cardId: number) {
    extraCounts.value[cardId] = Math.min((extraCounts.value[cardId] ?? 0) + 1, MAX_COPIES);
    syncDeck();
}

function decrement(cardId: number) {
    extraCounts.value[cardId] = Math.max((extraCounts.value[cardId] ?? 0) - 1, 0);
    syncDeck();
}

function syncDeck() {
    const hero = setup.selectedHero;
    if (!hero) return;
    const extra: number[] = [];
    for (const [id, count] of Object.entries(extraCounts.value)) {
        for (let i = 0; i < count; i++) extra.push(Number(id));
    }
    setup.setPlayerDeckIds([...hero.heroDeckIds, ...extra]);
}

const totalCards = computed(() => setup.playerDeckIds.length);

// When aspect changes, clear extra counts and re-sync
watch(() => setup.selectedAspect, () => {
    extraCounts.value = {};
    syncDeck();
});
</script>

<template>
    <div class="step-aspect">
        <h2 class="step-title">Build Your Deck</h2>

        <!-- Aspect selector -->
        <div class="aspect-row">
            <button
                v-for="a in ASPECTS"
                :key="a.id"
                class="aspect-btn"
                :class="{ selected: setup.selectedAspect === a.id }"
                :style="setup.selectedAspect === a.id ? { borderColor: a.color, background: a.color + '22' } : {}"
                @click="setup.selectAspect(a.id)"
            >
                {{ a.label }}
            </button>
        </div>

        <!-- Hero cards (read-only) -->
        <div class="section">
            <div class="section-header">
                <span class="section-label">Hero Cards</span>
                <span class="section-note">Always included</span>
            </div>
            <div class="hero-cards-row">
                <div v-for="card in heroCards" :key="card.storageId" class="hero-card-thumb">
                    <img :src="card.imgPath" :alt="card.name" />
                    <span v-if="card.count > 1" class="thumb-count">×{{ card.count }}</span>
                </div>
            </div>
        </div>

        <!-- Binder -->
        <div class="section binder">
            <div class="section-header">
                <span class="section-label">Deck Builder</span>
                <span class="deck-count">{{ totalCards }} cards in deck</span>
            </div>

            <div class="binder-scroll">
                <!-- Neutral -->
                <div class="binder-group-label">Neutral</div>
                <div v-if="binderCards.neutral.length === 0" class="binder-empty">No neutral cards available.</div>
                <div v-for="card in binderCards.neutral" :key="card.storageId" class="binder-row">
                    <img :src="card.imgPath" :alt="card.name" class="binder-img" />
                    <div class="binder-info">
                        <span class="binder-name">{{ card.name }}</span>
                        <span class="binder-tags">{{ card.type }} · cost {{ card.cost }}</span>
                    </div>
                    <div class="binder-counter">
                        <button class="counter-btn" @click="decrement(card.storageId)" :disabled="!extraCounts[card.storageId]">−</button>
                        <span class="counter-val">{{ extraCounts[card.storageId] ?? 0 }}</span>
                        <button class="counter-btn" @click="increment(card.storageId)" :disabled="(extraCounts[card.storageId] ?? 0) >= MAX_COPIES">+</button>
                    </div>
                </div>

                <!-- Aspect-specific -->
                <template v-if="setup.selectedAspect">
                    <div class="binder-group-label" style="margin-top: 16px;">{{ setup.selectedAspect.charAt(0).toUpperCase() + setup.selectedAspect.slice(1) }}</div>
                    <div v-if="binderCards.aspect.length === 0" class="binder-empty">No {{ setup.selectedAspect }} cards available yet.</div>
                    <div v-for="card in binderCards.aspect" :key="card.storageId" class="binder-row">
                        <img :src="card.imgPath" :alt="card.name" class="binder-img" />
                        <div class="binder-info">
                            <span class="binder-name">{{ card.name }}</span>
                            <span class="binder-tags">{{ card.type }} · cost {{ card.cost }}</span>
                        </div>
                        <div class="binder-counter">
                            <button class="counter-btn" @click="decrement(card.storageId)" :disabled="!extraCounts[card.storageId]">−</button>
                            <span class="counter-val">{{ extraCounts[card.storageId] ?? 0 }}</span>
                            <button class="counter-btn" @click="increment(card.storageId)" :disabled="(extraCounts[card.storageId] ?? 0) >= MAX_COPIES">+</button>
                        </div>
                    </div>
                </template>
                <div v-else class="binder-empty" style="margin-top: 16px;">Select an aspect above to see aspect cards.</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.step-aspect {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 100%;
    max-width: 900px;
}

.step-title {
    font-size: 2rem;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    margin: 0;
    letter-spacing: 0.04em;
    text-align: center;
}

/* Aspect selector */
.aspect-row {
    display: flex;
    gap: 10px;
    justify-content: center;
}

.aspect-btn {
    background: rgba(255,255,255,0.05);
    border: 2px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: rgba(255,255,255,0.75);
    padding: 12px 28px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.03em;
}

.aspect-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
.aspect-btn.selected { color: white; }

/* Sections */
.section { display: flex; flex-direction: column; gap: 12px; }

.section-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
}

.section-label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
}

.section-note {
    font-size: 0.72rem;
    color: rgba(255,255,255,0.25);
}

.deck-count {
    margin-left: auto;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
}

/* Hero cards row */
.hero-cards-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.hero-card-thumb {
    position: relative;
    width: 80px;
}

.hero-card-thumb img {
    width: 100%;
    border-radius: 5px;
    display: block;
    border: 1px solid rgba(255,255,255,0.1);
    opacity: 0.85;
}

.thumb-count {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: rgba(0,0,0,0.85);
    color: rgba(255,255,255,0.7);
    font-size: 0.6rem;
    font-weight: 700;
    border-radius: 4px;
    padding: 1px 4px;
}

/* Binder */
.binder { flex: 1; min-height: 0; }

.binder-scroll {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.binder-group-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.3);
    text-transform: uppercase;
    padding: 4px 0 6px;
}

.binder-empty {
    font-size: 0.78rem;
    color: rgba(255,255,255,0.25);
    font-style: italic;
    padding: 4px 0;
}

.binder-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 4px;
    border-radius: 5px;
    transition: background 0.1s;
}

.binder-row:hover { background: rgba(255,255,255,0.04); }

.binder-img {
    width: 52px;
    border-radius: 4px;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.1);
}

.binder-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.binder-name {
    font-size: 1rem;
    color: rgba(255,255,255,0.85);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.binder-tags {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.35);
    text-transform: capitalize;
}

.binder-counter {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.counter-btn {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 4px;
    color: rgba(255,255,255,0.8);
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s;
}

.counter-btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
.counter-btn:disabled { opacity: 0.25; cursor: default; }

.counter-val {
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    min-width: 16px;
    text-align: center;
}
</style>
