<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLobbyStore } from '../stores/lobbyStore';
import { useSetupStore, type HeroCatalogEntry } from '../stores/setupStore';

const router = useRouter();
const lobbyStore = useLobbyStore();
const setupStore = useSetupStore();

const error = ref('');
const starting = ref(false);
const copied = ref(false);

// ── Hero + aspect selection ───────────────────────────────────────────────────
const selectedHeroId = ref<number | null>(null);
const selectedAspect = ref<string>('leadership');

const aspects = [
    { id: 'aggression', label: 'Aggression', color: '#c0392b' },
    { id: 'justice',    label: 'Justice',    color: '#dbe729' },
    { id: 'leadership', label: 'Leadership', color: '#279aae' },
    { id: 'protection', label: 'Protection', color: '#13831c' },
];

// ── Deck builder state ────────────────────────────────────────────────────────
const allCards = ref<any[]>([]);
const extraCounts = ref<Record<number, number>>({});
const binderTab = ref<string | null>(null);
const zoomedImg = ref<string | null>(null);
const cardsLoaded = ref(false);

const BINDER_TABS = [
    { id: 'aggression', label: 'Aggression', color: '#c0392b' },
    { id: 'justice',    label: 'Justice',    color: '#d4a017' },
    { id: 'leadership', label: 'Leadership', color: '#2471a3' },
    { id: 'protection', label: 'Protection', color: '#1e8449' },
    { id: 'neutral',    label: 'Neutral',    color: '#888888' },
];

const selectedHero = computed(() => heroById(selectedHeroId.value ?? null));

const deckDisplay = computed(() => {
    const hero = selectedHero.value;
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

const activeBinderCards = computed(() => {
    if (!binderTab.value) return [];
    return allCards.value
        .filter(c => c.aspect === binderTab.value)
        .sort((a: any, b: any) => a.cost - b.cost);
});

const lockedAspect = computed(() => {
    for (const [id, count] of Object.entries(extraCounts.value)) {
        if (count > 0) {
            const card = allCards.value.find((c: any) => c.storageId === Number(id));
            if (card && card.aspect !== 'neutral' && card.aspect !== 'hero') return card.aspect as string;
        }
    }
    return null;
});

const totalCards = computed(() => {
    const hero = selectedHero.value;
    if (!hero) return 0;
    const extras = Object.values(extraCounts.value).reduce((s, c) => s + c, 0);
    return hero.heroDeckIds.length + extras;
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
    const hero = selectedHero.value;
    if (!hero) return;
    const extra: number[] = [];
    for (const [id, count] of Object.entries(extraCounts.value)) {
        for (let i = 0; i < count; i++) extra.push(Number(id));
    }
    lobbyStore.selectHero(hero.id, selectedAspect.value, [...hero.heroDeckIds, ...extra]);
}

async function loadCards() {
    if (cardsLoaded.value) return;
    try {
        const resp = await fetch('http://localhost:3000/api/cards');
        allCards.value = await resp.json();
        cardsLoaded.value = true;
    } catch { /* non-fatal */ }
}

// ── Host config ───────────────────────────────────────────────────────────────
const localVillainId   = ref<number | null>(null);
const localEncounterId = ref<number | null>(null);
const localExpertMode  = ref(false);

const room = computed(() => lobbyStore.room);
const isHost = computed(() => lobbyStore.isHost);
const myLobbyPlayer = computed(() => lobbyStore.myLobbyPlayer);
const amReady       = computed(() => lobbyStore.amReady);

const heroById = (id: number | null): HeroCatalogEntry | undefined =>
    id != null ? setupStore.catalog.heroes.find(h => h.id === id) : undefined;

// ── Redirect if room was lost ─────────────────────────────────────────────────
let redirectTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
    await setupStore.fetchCatalog();

    if (!room.value) {
        redirectTimer = setTimeout(() => {
            if (!room.value) router.replace('/');
        }, 500);
        return;
    }

    prefillFromRoom();
});

function prefillFromRoom() {
    const me = myLobbyPlayer.value;
    if (me?.heroId != null) {
        selectedHeroId.value = me.heroId;
        loadCards();
    }
    if (me?.aspect) {
        selectedAspect.value = me.aspect;
        binderTab.value = me.aspect;
    }

    if (isHost.value && room.value) {
        if (room.value.selectedVillainId != null) localVillainId.value = room.value.selectedVillainId;
        if (room.value.selectedEncounterSetId != null) localEncounterId.value = room.value.selectedEncounterSetId;
        localExpertMode.value = room.value.expertMode;
    }
}

watch(room, (r, prev) => {
    if (r && !prev && redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
        prefillFromRoom();
    }
}, { immediate: false });

onUnmounted(() => {
    if (redirectTimer) clearTimeout(redirectTimer);
    lobbyStore.reset();
});

watch(room, (r) => {
    if (!r) return;
    if (isHost.value) {
        if (r.selectedVillainId != null && localVillainId.value == null)
            localVillainId.value = r.selectedVillainId;
        if (r.selectedEncounterSetId != null && localEncounterId.value == null)
            localEncounterId.value = r.selectedEncounterSetId;
    }
    const me = r.players.find(p => p.user.id === lobbyStore.myUserId);
    if (me?.heroId != null && selectedHeroId.value == null) {
        selectedHeroId.value = me.heroId;
    }
});

// ── Actions ───────────────────────────────────────────────────────────────────

function pickHero(heroId: number) {
    selectedHeroId.value = heroId;
    const hero = heroById(heroId);
    if (!hero) return;
    extraCounts.value = {};
    binderTab.value = selectedAspect.value;
    lobbyStore.selectHero(heroId, selectedAspect.value, [...hero.heroDeckIds]);
    loadCards();
}

function clearHero() {
    selectedHeroId.value = null;
    extraCounts.value = {};
}

/** Called from sidebar aspect buttons OR binder non-neutral tabs */
function pickAspect(aspect: string) {
    selectedAspect.value = aspect;
    binderTab.value = aspect;
    if (selectedHeroId.value == null) return;
    const hero = heroById(selectedHeroId.value);
    if (!hero) return;
    // Clear extra aspect-specific cards when switching aspect
    for (const key in extraCounts.value) {
        const card = allCards.value.find((c: any) => c.storageId === Number(key));
        if (card && card.aspect !== 'neutral' && card.aspect !== 'hero') {
            extraCounts.value[Number(key)] = 0;
        }
    }
    syncDeck();
}

function selectBinderTab(id: string) {
    if (id === 'neutral') {
        binderTab.value = id;
    } else {
        pickAspect(id);
    }
}

function applyHostConfig() {
    if (!isHost.value) return;
    if (localVillainId.value == null || localEncounterId.value == null) return;
    lobbyStore.configure(localVillainId.value, localEncounterId.value, localExpertMode.value);
}

function toggleReady() {
    lobbyStore.setReady(!amReady.value);
}

async function startGame() {
    error.value = '';
    starting.value = true;
    try {
        await lobbyStore.startGame();
        // main.ts permanent listener will handle navigation when game:stateUpdate arrives
    } catch (e: any) {
        error.value = e.message;
        starting.value = false;
    }
}

function copyCode() {
    if (!room.value) return;
    navigator.clipboard.writeText(room.value.code).then(() => {
        copied.value = true;
        setTimeout(() => (copied.value = false), 1500);
    });
}

function goBack() {
    lobbyStore.reset();
    router.push('/');
}
</script>

<template>
    <div v-if="room" class="lobby">

        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <header class="lobby-header">
            <button class="btn-back" @click="goBack">← Back</button>
            <div class="room-code-block">
                <span class="room-label">Room Code</span>
                <span class="room-code">{{ room.code }}</span>
                <button class="btn-copy" @click="copyCode">{{ copied ? 'Copied!' : 'Copy' }}</button>
            </div>
            <div class="host-badge" v-if="isHost">Host</div>
        </header>

        <!-- ── Main layout ─────────────────────────────────────────────────── -->
        <div class="lobby-body">

            <!-- Left: Player list + actions -->
            <aside class="lobby-sidebar">

                <!-- Player list -->
                <section class="panel">
                    <h3 class="panel-title">Players ({{ room.players.length }})</h3>
                    <div class="player-list">
                        <div
                            v-for="p in room.players"
                            :key="p.user.id"
                            class="player-row"
                            :class="{ 'is-me': p.user.id === lobbyStore.myUserId, 'is-ready': p.isReady }"
                        >
                            <div class="player-avatar">
                                <img
                                    v-if="heroById(p.heroId ?? null)"
                                    :src="heroById(p.heroId!)!.heroImgPath"
                                    :alt="heroById(p.heroId!)!.name"
                                />
                                <span v-else class="avatar-placeholder">?</span>
                            </div>
                            <div class="player-info">
                                <span class="player-name">
                                    {{ p.user.username }}
                                    <span v-if="p.user.id === room.hostUserId" class="crown">★</span>
                                </span>
                                <span class="player-hero">
                                    {{ heroById(p.heroId ?? null)?.name ?? 'No hero selected' }}
                                    <span v-if="p.aspect && p.aspect !== 'hero'" class="aspect-tag">{{ p.aspect }}</span>
                                </span>
                            </div>
                            <div class="player-status" :class="p.isReady ? 'ready' : 'not-ready'">
                                {{ p.isReady ? 'Ready' : 'Not Ready' }}
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Host: villain & encounter config -->
                <section v-if="isHost" class="panel">
                    <h3 class="panel-title">Game Config</h3>

                    <label class="field-label">Villain</label>
                    <select v-model="localVillainId" class="field-select" @change="applyHostConfig">
                        <option :value="null" disabled>— Select villain —</option>
                        <option v-for="v in setupStore.catalog.villains" :key="v.id" :value="v.id">
                            {{ v.name }}
                        </option>
                    </select>

                    <label class="field-label">Encounter Set</label>
                    <select v-model="localEncounterId" class="field-select" @change="applyHostConfig">
                        <option :value="null" disabled>— Select encounter —</option>
                        <option v-for="e in setupStore.catalog.encounters" :key="e.id" :value="e.id">
                            {{ e.name }}
                        </option>
                    </select>

                    <label class="expert-row">
                        <input type="checkbox" v-model="localExpertMode" @change="applyHostConfig" />
                        <span>Expert Mode</span>
                    </label>

                    <div v-if="room.selectedVillainId == null || room.selectedEncounterSetId == null" class="config-hint">
                        Select villain + encounter to enable start.
                    </div>
                </section>

                <!-- Non-host: game config summary -->
                <section v-else class="panel config-summary">
                    <h3 class="panel-title">Game Config</h3>
                    <div class="summary-row">
                        <span class="summary-label">Villain:</span>
                        <span>{{ setupStore.catalog.villains.find(v => v.id === room.selectedVillainId)?.name ?? 'Not set' }}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">Encounter:</span>
                        <span>{{ setupStore.catalog.encounters.find(e => e.id === room.selectedEncounterSetId)?.name ?? 'Not set' }}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">Mode:</span>
                        <span>{{ room.expertMode ? 'Expert' : 'Standard' }}</span>
                    </div>
                </section>

                <!-- Aspect selection -->
                <section class="panel">
                    <h3 class="panel-title">Aspect</h3>
                    <div class="aspect-row">
                        <button
                            v-for="a in aspects"
                            :key="a.id"
                            class="aspect-btn"
                            :class="{ selected: selectedAspect === a.id }"
                            :style="selectedAspect === a.id ? { borderColor: a.color, background: a.color + '22' } : {}"
                            @click="pickAspect(a.id)"
                        >
                            {{ a.label }}
                        </button>
                    </div>
                </section>

                <!-- Footer actions -->
                <div class="lobby-actions">
                    <button
                        class="btn-ready"
                        :class="{ 'btn-ready-active': amReady }"
                        :disabled="selectedHeroId == null"
                        @click="toggleReady"
                    >
                        {{ amReady ? 'Unready' : 'Ready Up' }}
                    </button>

                    <button
                        v-if="isHost"
                        class="btn-start"
                        :disabled="!room.canStart || starting"
                        @click="startGame"
                    >
                        {{ starting ? 'Starting...' : 'Start Game' }}
                    </button>
                    <p v-else class="waiting-msg">
                        Waiting for host to start...
                    </p>
                </div>

                <p v-if="error" class="error-msg">{{ error }}</p>
            </aside>

            <!-- Right: Hero picker / Deck builder -->
            <main class="lobby-main">

                <!-- Hero picker -->
                <template v-if="selectedHeroId == null">
                    <h2 class="section-title">Choose Your Hero</h2>
                    <div class="hero-grid">
                        <button
                            v-for="hero in setupStore.catalog.heroes"
                            :key="hero.id"
                            class="hero-card"
                            @click="pickHero(hero.id)"
                        >
                            <img :src="hero.heroImgPath" :alt="hero.name" />
                            <span class="hero-name">{{ hero.name }}</span>
                        </button>
                    </div>
                </template>

                <!-- Deck builder -->
                <template v-else>
                    <div class="deck-builder-header">
                        <button class="btn-change-hero" @click="clearHero">← Change Hero</button>
                        <h2 class="section-title">{{ selectedHero?.name }} — Build Deck</h2>
                        <span class="deck-count-badge">{{ totalCards }} cards</span>
                    </div>

                    <div class="deck-builder-columns">

                        <!-- Left: current deck -->
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

                            <div class="binder-tabs">
                                <button
                                    v-for="tab in BINDER_TABS"
                                    :key="tab.id"
                                    class="binder-tab"
                                    :class="{ selected: binderTab === tab.id }"
                                    :disabled="tab.id !== 'neutral' && lockedAspect !== null && lockedAspect !== tab.id"
                                    :style="{
                                        borderColor: binderTab === tab.id ? tab.color : tab.color + '55',
                                        color:       binderTab === tab.id ? tab.color : tab.color + 'aa',
                                        background:  binderTab === tab.id ? tab.color + '22' : 'transparent',
                                    }"
                                    @click="selectBinderTab(tab.id)"
                                >
                                    {{ tab.label }}
                                </button>
                            </div>

                            <div class="binder-scroll">
                                <div v-if="!cardsLoaded" class="binder-empty">Loading cards...</div>
                                <div v-else-if="!binderTab" class="binder-empty">Select a tab above to browse cards.</div>
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
                </template>

            </main>
        </div>
    </div>

    <!-- Fallback while redirecting -->
    <div v-else class="loading-screen">
        <p>Redirecting...</p>
    </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────────── */
.lobby {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #0d0d0d;
    color: #e8e8e8;
    overflow: hidden;
}

.lobby-header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 14px 28px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-back {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.55);
    padding: 6px 12px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
}
.btn-back:hover { color: #fff; border-color: rgba(255,255,255,0.35); }

.room-code-block {
    display: flex;
    align-items: center;
    gap: 10px;
}
.room-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.4);
}
.room-code {
    font-size: 1.4rem;
    font-weight: 800;
    color: #e8c84a;
    letter-spacing: 0.08em;
}
.btn-copy {
    background: rgba(232, 200, 74, 0.12);
    border: 1px solid rgba(232, 200, 74, 0.3);
    border-radius: 5px;
    color: #e8c84a;
    padding: 4px 10px;
    font-size: 0.72rem;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-copy:hover { background: rgba(232, 200, 74, 0.22); }

.host-badge {
    margin-left: auto;
    background: rgba(232, 200, 74, 0.15);
    border: 1px solid rgba(232, 200, 74, 0.4);
    border-radius: 4px;
    color: #e8c84a;
    font-size: 0.7rem;
    padding: 3px 8px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.lobby-body {
    flex: 1;
    display: flex;
    overflow: hidden;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────────── */
.lobby-sidebar {
    width: 320px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 16px;
    border-right: 1px solid rgba(255, 255, 255, 0.07);
    overflow-y: auto;
}

.panel {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.panel-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
}

/* Player list */
.player-list { display: flex; flex-direction: column; gap: 8px; }

.player-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: border-color 0.2s;
}
.player-row.is-me { border-color: rgba(232, 200, 74, 0.25); }
.player-row.is-ready { border-color: rgba(76, 175, 80, 0.3); }

.player-avatar {
    width: 40px;
    height: 58px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
.player-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { font-size: 1.1rem; color: rgba(255,255,255,0.25); }

.player-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.player-name { font-weight: 700; font-size: 0.82rem; color: #e8e8e8; }
.crown { color: #e8c84a; font-size: 0.7rem; }
.player-hero { font-size: 0.7rem; color: rgba(255,255,255,0.45); }
.aspect-tag {
    font-size: 0.62rem;
    text-transform: capitalize;
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    padding: 1px 4px;
    margin-left: 4px;
}

.player-status { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
.ready { color: #4caf50; }
.not-ready { color: rgba(255,255,255,0.3); }

/* Host config */
.field-label {
    font-size: 0.7rem;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: -4px;
}
.field-select {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    color: #e8e8e8;
    padding: 7px 10px;
    font-size: 0.82rem;
    width: 100%;
    cursor: pointer;
}
.field-select:focus { outline: none; border-color: rgba(255,255,255,0.35); }

.expert-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    color: rgba(255,255,255,0.65);
    cursor: pointer;
}
.config-hint { font-size: 0.7rem; color: rgba(255,200,50,0.65); }

/* Config summary (non-host) */
.config-summary .summary-row {
    display: flex;
    gap: 6px;
    font-size: 0.78rem;
    color: rgba(255,255,255,0.65);
}
.summary-label { color: rgba(255,255,255,0.4); min-width: 64px; }

/* Aspect */
.aspect-row { display: flex; gap: 6px; flex-wrap: wrap; }
.aspect-btn {
    flex: 1;
    min-width: 80px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    color: rgba(255,255,255,0.65);
    padding: 6px 4px;
    font-size: 0.72rem;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, color 0.2s;
}
.aspect-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
.aspect-btn.selected { color: #fff; font-weight: 700; }

/* Actions */
.lobby-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 4px;
}

.btn-ready {
    width: 100%;
    padding: 12px;
    border-radius: 8px;
    border: 2px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.7);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
}
.btn-ready:hover:not(:disabled) {
    border-color: #4caf50;
    background: rgba(76,175,80,0.12);
    color: #4caf50;
}
.btn-ready.btn-ready-active {
    border-color: #4caf50;
    background: rgba(76,175,80,0.18);
    color: #4caf50;
}
.btn-ready:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-start {
    width: 100%;
    padding: 13px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #e8c84a, #c8a030);
    color: #0d0d0d;
    font-size: 0.95rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s;
}
.btn-start:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-start:disabled { opacity: 0.35; cursor: not-allowed; }

.waiting-msg { font-size: 0.75rem; color: rgba(255,255,255,0.35); text-align: center; margin: 0; }
.error-msg { color: #f44336; font-size: 0.78rem; margin: 0; text-align: center; }

/* ── Main area ────────────────────────────────────────────────────────────── */
.lobby-main {
    flex: 1;
    padding: 24px 28px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 0;
}

.section-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    margin: 0;
    letter-spacing: 0.03em;
}

/* ── Hero grid ───────────────────────────────────────────────────────────── */
.hero-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}

.hero-card {
    background: rgba(255,255,255,0.05);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: border-color 0.2s, transform 0.15s, background 0.2s;
    width: 160px;
}
.hero-card:hover {
    border-color: rgba(255,255,255,0.3);
    transform: translateY(-3px);
    background: rgba(255,255,255,0.08);
}
.hero-card img { width: 100%; border-radius: 6px; display: block; }
.hero-name { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.8); text-align: center; }

/* ── Deck builder ─────────────────────────────────────────────────────────── */
.deck-builder-header {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
}

.btn-change-hero {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    color: rgba(255,255,255,0.55);
    padding: 6px 12px;
    font-size: 0.78rem;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
    white-space: nowrap;
}
.btn-change-hero:hover { color: #fff; border-color: rgba(255,255,255,0.3); }

.deck-count-badge {
    font-size: 0.9rem;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 4px 14px;
}

.deck-builder-columns {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 24px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
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

.deck-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.deck-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
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

.binder-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.binder-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    flex-shrink: 0;
}

.binder-tab {
    background: transparent;
    border: 2px solid;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}
.binder-tab:hover:not(:disabled) { filter: brightness(1.25); }
.binder-tab.selected { font-weight: 700; }
.binder-tab:disabled { opacity: 0.25; cursor: not-allowed; }

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

.binder-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
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
    cursor: zoom-in;
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

/* ── Loading fallback ────────────────────────────────────────────────────── */
.loading-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.4);
    background: #0d0d0d;
}
</style>
