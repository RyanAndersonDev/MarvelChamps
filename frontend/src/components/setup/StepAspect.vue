<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useSetupStore } from '../../stores/setupStore';
import type { Aspect } from '@shared/types/card';

const setup = useSetupStore();

const TABS: { id: string; label: string; color: string }[] = [
    { id: 'aggression',  label: 'Aggression',  color: '#c0392b' },
    { id: 'justice',     label: 'Justice',     color: '#d4a017' },
    { id: 'leadership',  label: 'Leadership',  color: '#2471a3' },
    { id: 'protection',  label: 'Protection',  color: '#1e8449' },
    { id: 'neutral',     label: 'Neutral',     color: '#888888' },
];

const binderTab = ref<string | null>(null);

function selectTab(id: string) {
    binderTab.value = id;
    if (id !== 'neutral') {
        setup.selectAspect(id as Aspect);
    }
}

// Populated by fetch from backend on mount — always up-to-date with cardStore.ts
const allCards = ref<any[]>([]);

const activeBinderCards = computed(() => {
    if (!binderTab.value) return [];
    return allCards.value
        .filter(c => c.aspect === binderTab.value)
        .sort((a: any, b: any) => a.cost - b.cost);
});

const extraCounts = ref<Record<number, number>>({});

// Full living deck: hero base cards + anything added from the binder
const deckDisplay = computed(() => {
    const hero = setup.selectedHero;
    if (!hero) return [];

    const countMap = new Map<number, number>();
    for (const id of hero.heroDeckIds) {
        countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
    for (const [id, count] of Object.entries(extraCounts.value)) {
        const num = Number(id);
        if (count > 0) countMap.set(num, (countMap.get(num) ?? 0) + count);
    }

    return [...countMap.entries()]
        .map(([id, count]) => {
            const card = allCards.value.find((c: any) => c.storageId === id);
            return card ? { ...card, count } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (a.cost ?? 0) - (b.cost ?? 0)) as any[];
});

// Which non-neutral aspect has cards added — locks the other 3 tabs
const lockedAspect = computed(() => {
    for (const [id, count] of Object.entries(extraCounts.value)) {
        if (count > 0) {
            const card = allCards.value.find((c: any) => c.storageId === Number(id));
            if (card && card.aspect !== 'neutral' && card.aspect !== 'hero') return card.aspect;
        }
    }
    return null;
});

const MAX_COPIES = 3;

function maxForCard(cardId: number): number {
    return allCards.value.find((c: any) => c.storageId === cardId)?.maxCopies ?? MAX_COPIES;
}

function increment(cardId: number) {
    extraCounts.value[cardId] = Math.min((extraCounts.value[cardId] ?? 0) + 1, maxForCard(cardId));
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

const zoomedImg = ref<string | null>(null);

watch(() => setup.selectedAspect, () => {
    extraCounts.value = {};
    syncDeck();
});

onMounted(async () => {
    const resp = await fetch('http://localhost:3000/api/cards');
    allCards.value = await resp.json();

    if (setup.selectedAspect) {
        binderTab.value = setup.selectedAspect;
    }

    const hero = setup.selectedHero;
    if (!hero) return;
    const baseCounts = new Map<number, number>();
    for (const id of hero.heroDeckIds) {
        baseCounts.set(id, (baseCounts.get(id) ?? 0) + 1);
    }
    const storedCounts = new Map<number, number>();
    for (const id of setup.playerDeckIds) {
        storedCounts.set(id, (storedCounts.get(id) ?? 0) + 1);
    }
    const restored: Record<number, number> = {};
    for (const [id, count] of storedCounts) {
        const extra = count - (baseCounts.get(id) ?? 0);
        if (extra > 0) restored[id] = extra;
    }
    extraCounts.value = restored;
});
</script>

<template>
    <div class="step-aspect">

        <!-- Top bar -->
        <div class="top-bar">
            <h2 class="step-title">Build Your Deck</h2>
            <span class="deck-count-badge">{{ totalCards }} cards</span>
        </div>

        <!-- Two-column layout -->
        <div class="columns">

            <!-- Left: living deck -->
            <div class="deck-panel">
                <div class="section-label">Your Deck</div>
                <div class="deck-grid">
                    <div v-for="card in deckDisplay" :key="card.storageId" class="deck-card-thumb">
                        <img :src="card.imgPath" :alt="card.name" @click="zoomedImg = card.imgPath" />
                        <span v-if="card.count > 1" class="thumb-count">×{{ card.count }}</span>
                    </div>
                </div>
            </div>

            <!-- Right: binder -->
            <div class="binder-panel">
                <div class="section-label">Add Cards</div>

                <!-- Tabs -->
                <div class="aspect-tabs">
                    <button
                        v-for="tab in TABS"
                        :key="tab.id"
                        class="aspect-tab"
                        :class="{ selected: binderTab === tab.id }"
                        :disabled="tab.id !== 'neutral' && lockedAspect !== null && lockedAspect !== tab.id"
                        :style="{
                            borderColor: binderTab === tab.id ? tab.color : tab.color + '55',
                            color:       binderTab === tab.id ? tab.color : tab.color + 'aa',
                            background:  binderTab === tab.id ? tab.color + '22' : 'transparent',
                        }"
                        @click="selectTab(tab.id)"
                    >
                        {{ tab.label }}
                    </button>
                </div>

                <!-- Card grid -->
                <div class="binder-scroll">
                    <div v-if="!binderTab" class="binder-empty">Select a tab above to browse cards.</div>
                    <div v-else-if="activeBinderCards.length === 0" class="binder-empty">No cards available.</div>
                    <div v-else class="binder-grid">
                        <div v-for="card in activeBinderCards" :key="card.storageId" class="binder-card">
                            <img :src="card.imgPath" :alt="card.name" class="binder-card-img" @click="zoomedImg = card.imgPath" />
                            <div class="binder-counter">
                                <button class="counter-btn" @click="decrement(card.storageId)" :disabled="!extraCounts[card.storageId]">−</button>
                                <span class="counter-val">{{ extraCounts[card.storageId] ?? 0 }}</span>
                                <button class="counter-btn" @click="increment(card.storageId)" :disabled="(extraCounts[card.storageId] ?? 0) >= maxForCard(card.storageId)">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
        <!-- Lightbox -->
        <Teleport to="body">
            <Transition name="zoom-fade">
                <div v-if="zoomedImg" class="lightbox" @click="zoomedImg = null">
                    <img :src="zoomedImg" class="lightbox-img" />
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.step-aspect {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    height: 100%;
}

/* Top bar */
.top-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
}

.step-title {
    font-size: 2rem;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    margin: 0;
    letter-spacing: 0.04em;
}

.deck-count-badge {
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 4px 14px;
}

/* Two-column layout */
.columns {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 24px;
    flex: 1;
    min-height: 0;
}

.section-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    margin-bottom: 10px;
    flex-shrink: 0;
}

/* Left: deck panel */
.deck-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.deck-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
    align-content: flex-start;
    overflow-y: auto;
    padding-right: 4px;
}

.deck-card-thumb {
    position: relative;
}

.deck-card-thumb img {
    width: 100%;
    border-radius: 6px;
    display: block;
    border: 1px solid rgba(255,255,255,0.1);
    cursor: zoom-in;
}

.binder-card-img { cursor: zoom-in; }

.thumb-count {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: rgba(0,0,0,0.85);
    color: rgba(255,255,255,0.7);
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: 4px;
    padding: 2px 5px;
}

/* Right: binder panel */
.binder-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.aspect-tabs {
    display: flex;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    flex-shrink: 0;
}

.aspect-tab {
    background: transparent;
    border: 2px solid;
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.02em;
}

.aspect-tab:hover:not(:disabled) { filter: brightness(1.25); }
.aspect-tab.selected { font-weight: 700; }
.aspect-tab:disabled { opacity: 0.25; cursor: not-allowed; }

.binder-scroll {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 16px;
    overflow-y: auto;
    flex: 1;
}

.binder-empty {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.25);
    font-style: italic;
    padding: 8px 0;
}

/* Card grid */
.binder-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 18px;
}

.binder-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.binder-card-img {
    width: 100%;
    border-radius: 6px;
    display: block;
    border: 1px solid rgba(255,255,255,0.1);
}

.binder-counter {
    display: flex;
    align-items: center;
    gap: 6px;
}

.counter-btn {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 4px;
    color: rgba(255,255,255,0.8);
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 1.1rem;
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
    min-width: 14px;
    text-align: center;
}

/* Lightbox */
.lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    cursor: zoom-out;
    backdrop-filter: blur(4px);
}

.lightbox-img {
    max-height: 85vh;
    max-width: 85vw;
    border-radius: 10px;
    box-shadow: 0 20px 80px rgba(0,0,0,0.8);
    pointer-events: none;
}

.zoom-fade-enter-active, .zoom-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.zoom-fade-enter-from, .zoom-fade-leave-to { opacity: 0; transform: scale(0.95); }
</style>
