<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { useGameStore } from '../../stores/gameStore';
    import BaseCard from './BaseCard.vue';
    import type { Obligation } from '@shared/types/card';

    const props = defineProps<{ card: Obligation }>();
    const store = useGameStore();

    const isAlterEgo = computed(() => store.playerIdentity?.identityStatus === 'alter-ego');
    const isMyTurn = computed(() => store.isMyTurn && store.currentPhase === 'PLAYER_TURN');

    // Local state for the "pick a hero-aspect card" flow
    const picking = ref(false);

    const heroCards = computed(() =>
        store.hand.filter(c => (c as any).aspect === 'hero')
    );

    function startRemove() {
        if (heroCards.value.length === 0) return;
        picking.value = true;
    }

    function confirmRemove(handCardInstanceId: number) {
        store.removeObligation(props.card.instanceId, handCardInstanceId);
        picking.value = false;
    }
</script>

<template>
    <div class="obligation-card">
        <BaseCard
            :img-path="props.card.imgPath"
            :orientation="'vertical'"
            :zoom-direction="'up'"
        />
        <div class="obligation-label">OBLIGATION</div>

        <!-- Alter-ego action: remove by discarding a hero-aspect card -->
        <button
            v-if="isAlterEgo && isMyTurn && !picking"
            class="btn-remove"
            :disabled="heroCards.length === 0"
            :title="heroCards.length === 0 ? 'No identity-specific cards in hand' : 'Discard an identity card to remove this obligation'"
            @click="startRemove"
        >REMOVE</button>

        <!-- Card picker overlay -->
        <div v-if="picking" class="pick-overlay">
            <p class="pick-label">Pick an identity card to discard:</p>
            <div class="pick-cards">
                <button
                    v-for="c in heroCards"
                    :key="c.instanceId"
                    class="pick-card-btn"
                    @click="confirmRemove(c.instanceId)"
                >{{ c.name }}</button>
            </div>
            <button class="btn-cancel" @click="picking = false">Cancel</button>
        </div>
    </div>
</template>

<style scoped>
    .obligation-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .obligation-label {
        font-size: 0.55rem;
        letter-spacing: 1px;
        color: #e74c3c;
        font-weight: 700;
        text-transform: uppercase;
        background: rgba(0,0,0,0.7);
        padding: 1px 6px;
        border-radius: 3px;
    }

    .btn-remove {
        font-size: 0.65rem;
        padding: 3px 8px;
        background: #c0392b;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 700;
    }

    .btn-remove:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .pick-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.92);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px;
        z-index: 30;
    }

    .pick-label {
        color: #f1c40f;
        font-size: 0.7rem;
        text-align: center;
        margin: 0;
    }

    .pick-cards {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
    }

    .pick-card-btn {
        font-size: 0.65rem;
        padding: 4px 6px;
        background: #2980b9;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
    }

    .pick-card-btn:hover {
        background: #3498db;
    }

    .btn-cancel {
        font-size: 0.6rem;
        padding: 2px 8px;
        background: #555;
        color: #ccc;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
</style>
