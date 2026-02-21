<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useGameStore } from '../stores/gameStore';
import type { LogType } from '../types/log';

const store = useGameStore();
const isOpen = ref(false);
const logContainer = ref<HTMLElement | null>(null);

// Group non-phase entries by round number
const entriesByRound = computed(() => {
    const groups = new Map<number, typeof store.gameLog>();
    for (const entry of store.gameLog) {
        if (entry.type === 'phase') continue;
        if (!groups.has(entry.round)) groups.set(entry.round, []);
        groups.get(entry.round)!.push(entry);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
});

const totalEntries = computed(() =>
    store.gameLog.filter(e => e.type !== 'phase').length
);

const typeColors: Record<LogType, string> = {
    damage:  '#e74c3c',
    heal:    '#2ecc71',
    threat:  '#e67e22',
    status:  '#9b59b6',
    play:    '#3498db',
    villain: '#c0392b',
    surge:   '#f1c40f',
    draw:    '#1abc9c',
    discard: '#95a5a6',
    system:  '#7f8c8d',
    phase:   '#ecf0f1',
};

function toggle() {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        nextTick(() => scrollToBottom());
    }
}

function scrollToBottom() {
    if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
}

watch(() => store.gameLog.length, () => {
    if (isOpen.value) {
        nextTick(() => scrollToBottom());
    }
});
</script>

<template>
    <div class="game-log-wrapper">
        <div v-if="isOpen" ref="logContainer" class="log-body">
            <div v-if="entriesByRound.length === 0" class="log-empty">
                No events yet.
            </div>
            <div v-for="[round, entries] in entriesByRound" :key="round" class="round-group">
                <div class="round-header">Round {{ round }}</div>
                <div v-for="entry in entries" :key="entry.id" class="log-entry">
                    <span class="entry-dot" :style="{ backgroundColor: typeColors[entry.type] }"></span>
                    <span class="entry-text">{{ entry.message }}</span>
                </div>
            </div>
        </div>

        <button class="log-toggle-bar" @click="toggle">
            <span class="log-title">Game Log</span>
            <span class="log-count">({{ totalEntries }})</span>
            <span class="log-chevron">{{ isOpen ? '▼' : '▲' }}</span>
        </button>
    </div>
</template>

<style scoped>
.game-log-wrapper {
    position: fixed;
    bottom: 0;
    right: 16px;
    width: 360px;
    z-index: 200;
    display: flex;
    flex-direction: column;
    font-family: monospace;
    font-size: 0.78rem;
}

.log-toggle-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #1a1a2e;
    border: none;
    border-top: 2px solid #41b883;
    border-left: 2px solid #41b883;
    border-right: 2px solid #41b883;
    border-radius: 6px 6px 0 0;
    color: #e0e0e0;
    padding: 5px 12px;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.15s;
}

.log-toggle-bar:hover {
    background: #252545;
}

.log-title {
    font-weight: 700;
    color: #41b883;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.log-count {
    color: #888;
    font-size: 0.75rem;
}

.log-chevron {
    margin-left: auto;
    color: #41b883;
    font-size: 0.7rem;
}

.log-body {
    background: #0d1117;
    border-left: 2px solid #41b883;
    border-right: 2px solid #41b883;
    max-height: 260px;
    overflow-y: auto;
    padding: 8px 6px;
    scrollbar-width: thin;
    scrollbar-color: #41b883 #0d1117;
}

.log-body::-webkit-scrollbar {
    width: 5px;
}
.log-body::-webkit-scrollbar-track {
    background: #0d1117;
}
.log-body::-webkit-scrollbar-thumb {
    background: #41b883;
    border-radius: 4px;
}

.log-empty {
    color: #555;
    text-align: center;
    padding: 12px;
    font-style: italic;
}

.round-group {
    margin-bottom: 6px;
}

.round-header {
    color: #41b883;
    font-weight: 700;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #1e3a2a;
    padding-bottom: 2px;
    margin-bottom: 4px;
}

.log-entry {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 1px 0;
}

.entry-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 4px;
}

.entry-text {
    color: #c9d1d9;
    line-height: 1.4;
    word-break: break-word;
}
</style>
