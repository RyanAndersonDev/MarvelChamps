<script setup lang="ts">
    import type { MainSchemeInstance, VillainIdentityCardInstance } from '@shared/types/card';
    import VillainIdentityCard from '../cards/VillainIdentityCard.vue';
    import DeckPile from '../piles/DeckPile.vue';
    import DiscardPile from '../piles/DiscardPile.vue';
    import MainScheme from './MainScheme.vue';
    import VillainAttachments from './VillainAttachments.vue';
    import { useGameStore } from '../../stores/gameStore';

    const store = useGameStore();

    const props = defineProps<{ 
        cardInstance: VillainIdentityCardInstance,
        mainSchemeInstance: MainSchemeInstance,
        deckIds: number[],
        discardIds: number[],
        cardBackImgPath: string,
        emptyPileImgPath: string
    }>();

</script>

<template>
    <div class="villain-row" style="position: relative">
        <DeckPile
            :deck-ids="deckIds"
            :card-back-img-path="emptyPileImgPath"
            :show-draw-button="false"
        />

        <MainScheme
            :scheme-instance="props.mainSchemeInstance"
        />

        <div class="villain-col">
            <VillainIdentityCard
                :card-instance="props.cardInstance"
            />
            <VillainAttachments
                :attachments="props.cardInstance.attachments || []"
                :host-id="props.cardInstance.instanceId"
            />
        </div>

        <DiscardPile
            :pile-ids="discardIds"
            :empty-image-path="emptyPileImgPath"
            :image-type="'villain'"
        />

        <Transition name="boost">
            <div v-if="store.boostCard" class="boost-overlay">
                <div class="boost-card">
                    <img :src="store.boostCard.imgPath" :alt="store.boostCard.name" />
                    <div class="boost-badge">
                        <span>+{{ store.boostCard.boostIcons }}</span>
                        <div class="boost-label">BOOST</div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
    .villain-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        justify-content: center;
        gap: 16px;
    }

    .villain-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    /* Boost card overlay */
    .boost-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 50;
    }

    .boost-card {
        position: relative;
        width: 100px;
        filter: drop-shadow(0 0 16px rgba(255, 180, 0, 0.8));
    }

    .boost-card img {
        width: 100%;
        border-radius: 8px;
        display: block;
    }

    .boost-badge {
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        background: #ffb400;
        color: #1a1a1a;
        border-radius: 20px;
        padding: 2px 10px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        min-width: 48px;
    }

    .boost-badge span {
        display: block;
        font-size: 1.3rem;
        font-weight: 900;
        line-height: 1.2;
    }

    .boost-label {
        font-size: 0.55rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        opacity: 0.8;
    }

    /* Transitions */
    .boost-enter-active {
        animation: boost-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .boost-leave-active {
        animation: boost-out 0.5s ease-in;
    }

    @keyframes boost-in {
        from { transform: scale(0.2) rotateY(90deg); opacity: 0; }
        to   { transform: scale(1) rotateY(0deg);   opacity: 1; }
    }

    @keyframes boost-out {
        from { transform: translateX(0)    scale(1);   opacity: 1; }
        to   { transform: translateX(120px) scale(0.3); opacity: 0; }
    }
</style>
