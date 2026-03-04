<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLobbyStore } from '../stores/lobbyStore';
import { useGameStore } from '../stores/gameStore';

const router = useRouter();
const lobbyStore = useLobbyStore();
const gameStore = useGameStore();

const joinCode = ref('');
const error = ref('');
const loading = ref(false);

const devUser = localStorage.getItem('devUser') ?? 'Player1';

function changeUser() {
    const name = prompt('Enter your player name (requires page reload):', devUser);
    if (name && name.trim()) {
        localStorage.setItem('devUser', name.trim());
        window.location.reload();
    }
}

async function createRoom() {
    error.value = '';
    loading.value = true;
    try {
        lobbyStore.listenForUpdates();
        await lobbyStore.createRoom();
        router.push('/lobby');
    } catch (e: any) {
        error.value = e.message;
        lobbyStore.reset();
    } finally {
        loading.value = false;
    }
}

async function joinRoom() {
    if (!joinCode.value.trim()) {
        error.value = 'Enter a room code.';
        return;
    }
    error.value = '';
    loading.value = true;
    try {
        lobbyStore.listenForUpdates();
        await lobbyStore.joinRoom(joinCode.value.trim());
        router.push('/lobby');
    } catch (e: any) {
        error.value = e.message;
        lobbyStore.reset();
    } finally {
        loading.value = false;
    }
}

function soloGame() {
    router.push('/setup');
}
</script>

<template>
    <div class="landing">

        <!-- Resume saved game banner -->
        <Transition name="resume-fade">
            <div v-if="gameStore.resumeOffer" class="resume-banner">
                <div class="resume-icon">⚔</div>
                <div class="resume-details">
                    <span class="resume-headline">Resume saved game?</span>
                    <span class="resume-meta">
                        vs <strong>{{ gameStore.resumeOffer.villainName }}</strong>
                        &middot; Round {{ gameStore.resumeOffer.roundNumber }}
                        &middot; {{ gameStore.resumeOffer.heroName }}
                        <template v-if="gameStore.resumeOffer.playerNames.length > 1">
                            &amp; {{ gameStore.resumeOffer.playerNames.filter(n => n !== gameStore.resumeOffer!.heroName).join(', ') }}
                        </template>
                    </span>
                </div>
                <div class="resume-actions">
                    <button class="btn-resume" @click="gameStore.acceptResume()">Resume</button>
                    <button class="btn-discard" @click="gameStore.declineResume()">Discard</button>
                </div>
            </div>
        </Transition>

        <div class="landing-card">
            <h1 class="title">MARVEL CHAMPIONS</h1>
            <p class="subtitle">The Card Game</p>

            <div class="player-badge" @click="changeUser" title="Click to change name">
                Playing as: <strong>{{ devUser }}</strong> <span class="change-hint">(change)</span>
            </div>

            <div class="mode-buttons">
                <button class="btn-mode btn-solo" @click="soloGame" :disabled="loading">
                    <span class="mode-icon">⚡</span>
                    <span class="mode-label">Solo Game</span>
                    <span class="mode-desc">Single player</span>
                </button>

                <button class="btn-mode btn-create" @click="createRoom" :disabled="loading">
                    <span class="mode-icon">+</span>
                    <span class="mode-label">Create Room</span>
                    <span class="mode-desc">Host a multiplayer game</span>
                </button>
            </div>

            <div class="join-row">
                <input
                    v-model="joinCode"
                    class="join-input"
                    placeholder="Room code (e.g. HERO-42)"
                    @keyup.enter="joinRoom"
                    :disabled="loading"
                    maxlength="12"
                />
                <button class="btn-join" @click="joinRoom" :disabled="loading || !joinCode.trim()">
                    Join Room
                </button>
            </div>

            <p v-if="error" class="error-msg">{{ error }}</p>
            <p v-if="loading" class="loading-msg">Connecting...</p>
        </div>
    </div>
</template>

<style scoped>
.landing {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: #0d0d0d;
}

/* ── Resume banner ───────────────────────────────────────────────────────────── */
.resume-banner {
    display: flex;
    align-items: center;
    gap: 18px;
    background: rgba(255, 200, 50, 0.08);
    border: 1px solid rgba(255, 200, 50, 0.3);
    border-radius: 12px;
    padding: 16px 22px;
    width: 100%;
    max-width: 520px;
}

.resume-icon {
    font-size: 1.6rem;
    flex-shrink: 0;
}

.resume-details {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
}

.resume-headline {
    font-size: 0.9rem;
    font-weight: 700;
    color: rgba(255, 220, 80, 0.95);
}

.resume-meta {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.5);
}

.resume-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}

.btn-resume {
    background: rgba(255, 200, 50, 0.15);
    border: 1px solid rgba(255, 200, 50, 0.5);
    border-radius: 7px;
    color: rgba(255, 220, 80, 0.95);
    padding: 7px 16px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
}
.btn-resume:hover { background: rgba(255, 200, 50, 0.28); }

.btn-discard {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    color: rgba(255, 255, 255, 0.35);
    padding: 7px 12px;
    font-size: 0.82rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
}
.btn-discard:hover { color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.25); }

.resume-fade-enter-active, .resume-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.resume-fade-enter-from, .resume-fade-leave-to { opacity: 0; transform: translateY(-8px); }

.landing-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 52px 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    min-width: 420px;
    max-width: 520px;
}

.title {
    font-size: 2.6rem;
    font-weight: 900;
    color: #e8c84a;
    letter-spacing: 0.08em;
    margin: 0;
    text-align: center;
}

.subtitle {
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin: -16px 0 0;
}

.player-badge {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
}
.player-badge:hover { background: rgba(255, 255, 255, 0.1); }
.player-badge strong { color: rgba(255, 255, 255, 0.85); }
.change-hint { font-size: 0.7rem; opacity: 0.6; }

.mode-buttons {
    display: flex;
    gap: 16px;
    width: 100%;
}

.btn-mode {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 20px 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
    color: #fff;
}
.btn-mode:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.09);
    transform: translateY(-2px);
}
.btn-mode:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-solo { border-color: rgba(100, 180, 255, 0.3); }
.btn-solo:hover:not(:disabled) { border-color: #64b4ff; }
.btn-create { border-color: rgba(232, 200, 74, 0.3); }
.btn-create:hover:not(:disabled) { border-color: #e8c84a; }

.mode-icon { font-size: 1.8rem; line-height: 1; }
.mode-label { font-weight: 700; font-size: 0.95rem; letter-spacing: 0.03em; }
.mode-desc { font-size: 0.7rem; color: rgba(255, 255, 255, 0.45); }

.join-row {
    display: flex;
    gap: 8px;
    width: 100%;
}

.join-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    outline: none;
    transition: border-color 0.2s;
}
.join-input:focus { border-color: rgba(255, 255, 255, 0.4); }
.join-input::placeholder { text-transform: none; letter-spacing: normal; color: rgba(255,255,255,0.25); }
.join-input:disabled { opacity: 0.5; }

.btn-join {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 10px 18px;
    color: #fff;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
}
.btn-join:hover:not(:disabled) { background: rgba(255, 255, 255, 0.18); }
.btn-join:disabled { opacity: 0.4; cursor: not-allowed; }

.error-msg {
    color: #f44336;
    font-size: 0.82rem;
    margin: 0;
    text-align: center;
}
.loading-msg {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.82rem;
    margin: 0;
}
</style>
