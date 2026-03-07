<script setup lang="ts">
    import type { Treachery, Attachment, Minion, SideScheme } from '@shared/types/card';
    import VillainCard from '../cards/VillainCard.vue';
    import DeckPile from '../piles/DeckPile.vue';
    import { computed } from 'vue';
    import { useGameStore } from '../../stores/gameStore';
    const store = useGameStore();
    const isEncounterPhase = computed(() =>
        store.currentPhase === 'VILLAIN_STEP_4_DEAL' || store.currentPhase === 'VILLAIN_STEP_5_REVEAL'
    );

    const props = defineProps<{
        encounterCardIdPile: number[],
        cardBackImgPath: string,
        revealedCard: (Treachery | Attachment | Minion | SideScheme) | null
    }>();

    const emit = defineEmits<{
        (e: "resolve", currentInstanceId: number): void
    }>();

    function resolveCurrentCard(currentInstanceId: number) {
        if (currentInstanceId === props.revealedCard?.instanceId) {
            emit('resolve', currentInstanceId);
        }
    }
</script>

<template>
    <div class="encounter-card-container" :class="{
        'phase-glow-purple': isEncounterPhase,
        'hl-activating': store.highlights['encounter-zone'] === 'activating',
        'hl-targeted': store.highlights['encounter-zone'] === 'targeted',
    }">
        <DeckPile class="encounter-deck"
            :deck-ids="encounterCardIdPile"
            :card-back-img-path="cardBackImgPath"
            :hide-peek="true"
        />

        <Transition name="card-reveal">
            <VillainCard class="revealed-area"
                v-if="props.revealedCard"
                :key="props.revealedCard.instanceId"
                :card="props.revealedCard"
                @resolve="resolveCurrentCard"
            />
        </Transition>
    </div>
</template>

<style scoped>
    .encounter-card-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        justify-content: flex-start;
        perspective: 800px;
        border-radius: 10px;
        padding: 4px;
        transition: box-shadow 0.3s;
    }

    @keyframes phase-pulse-purple {
        0%, 100% { box-shadow: 0 0 10px rgba(140, 60, 220, 0.5); }
        50%       { box-shadow: 0 0 32px rgba(170, 80, 255, 1); }
    }
    .phase-glow-purple { animation: phase-pulse-purple 1s ease-in-out infinite; }

    .encounter-card-container > * {
        flex-shrink: 0;
    }

    /* Pulse the resolve button to draw attention */
    .revealed-area.zoomed :deep(button) {
        font-size: 0.85rem;
        padding: 6px 18px;
        animation: resolve-pulse 1.4s ease-in-out infinite;
    }
    @keyframes resolve-pulse {
        0%, 100% { box-shadow: 0 0 0px rgba(255,255,255,0); }
        50%       { box-shadow: 0 0 14px rgba(255, 200, 60, 0.9); }
    }

    /* ── Encounter card flip-in ── */
    .card-reveal-enter-active {
        animation: encounter-flip-in 0.55s cubic-bezier(0.215, 0.61, 0.355, 1);
    }
    .card-reveal-leave-active {
        animation: encounter-flip-out 0.25s ease-in;
    }

    @keyframes encounter-flip-in {
        0%   { transform: perspective(600px) rotateY(-90deg) scale(0.85); opacity: 0; filter: brightness(1.8); }
        40%  { filter: brightness(1.3); }
        100% { transform: perspective(600px) rotateY(0deg) scale(1);    opacity: 1; filter: brightness(1); }
    }
    @keyframes encounter-flip-out {
        from { transform: scale(1);    opacity: 1; }
        to   { transform: scale(0.85); opacity: 0; }
    }
</style>
