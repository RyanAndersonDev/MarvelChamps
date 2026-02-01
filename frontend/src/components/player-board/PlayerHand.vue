<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { useGameStore } from '../../stores/gameStore';
    import type { Ally, Event, Upgrade, Support } from '../../types/card';
    import HandCard from '../cards/HandCard.vue';
    import type { Resource } from '../../types/card';

    const props = defineProps<{ hand: (Ally | Event | Upgrade | Support)[] }>();
    const emit = defineEmits<{
        (e: 'discard', cardIds: number[]): void;
        (e: 'sendToTableau', cardId: number): void;
        (e: 'destroyHandCard', cardId: number): void;
    }>();

    const store = useGameStore();
    
    const activeCardId = ref<number | null>(null);
    const cardIdsToDiscard = ref<number[]>([]);

    const rscReqAmt = computed(() => {
        if (activeCardId.value === null)
            return;

        const activeCard = props.hand.find(card => card.instanceId === activeCardId.value);
        return activeCard?.cost || null;
    });

    const activeResources = ref<Map<Resource, number>>(
        new Map<Resource, number>([
            ['physical', 0],
            ['mental', 0],
            ['energy', 0],
            ['wild', 0],
        ])
    );

    function handlePlay(cardId: number) : void {
        const currentCard = props.hand.find(c => c.instanceId === cardId);

        if (currentCard?.cost === 0) {
            cardIdsToDiscard.value.push(currentCard.instanceId!);
            emit('discard', [...cardIdsToDiscard.value]);
            resolveCardEffect();

            cardIdsToDiscard.value = [];
            activeResources.value.clear();
            activeCardId.value = null;
        }
        else {
            activeCardId.value = cardId;
        }
    }

    function handleAllResourcesFromEvent(payload: { instanceId: number, storageId: number, resources: Resource[] }) {
        handleAllResources(payload.resources, payload.instanceId, payload.storageId);
    }

    async function handleAllResources(rscArr: Resource[], instanceId: number, storageId: number) {
        rscArr.forEach(r => {
            const map = activeResources.value;
            if (!map) 
                return;

            const current = map.get(r) ?? 0;
            map.set(r, current + 1);
        });

        cardIdsToDiscard.value.push(instanceId);

        if (resolvePlay()) {
            const card = props.hand.find(c => c.instanceId === activeCardId.value!);
            if (!card) return;

            if (card.type === "event") {
                if (!cardIdsToDiscard.value.includes(card.instanceId!)) {
                    cardIdsToDiscard.value.push(card.instanceId!);
                }
            } 
            else if (card.type === "upgrade" && card.attachmentLocation !== "tableau") {
                const loc = card.attachmentLocation;
                if (loc === "minion" || loc === "villain" || loc === "enemy") {
                    try {
                        const targetId = await store.requestTarget(card, loc);
                        store.attachToTarget(card as Upgrade, targetId);
                        emit('destroyHandCard', card.instanceId!);
                    } catch (error) {
                        console.log(`Targeting for ${loc} was cancelled or failed`);
                        return; 
                    }
                }
            } 
            else {
                sendToTableau(card.storageId!);
                emit('destroyHandCard', card.instanceId!);
            }

            emit('discard', [...cardIdsToDiscard.value]);

            cardIdsToDiscard.value = [];
            activeResources.value.clear();
            activeCardId.value = null;

            resolveCardEffect();
            console.log("Play resolved successfully!");
        }
    }

    function resolveCardEffect() {
        // TODO:
        //  Do the action
    }

    function resolvePlay(): boolean {
        let total = 0;

        activeResources.value.forEach((amount, type) => {
            console.log(type, amount);
            total += amount;
        });

        return total >= rscReqAmt.value!; 
    }
    
    function getCardMode(cardId : number) : 'play' | 'resource' {
        if (activeCardId.value === null)
            return 'play';

        return activeCardId.value === cardId ? 'play' : 'resource';
    }

    function sendToTableau(cardId : number) {
        emit('sendToTableau', cardId);
    }

    function cancelPlay() {
        activeCardId.value = null;
        cardIdsToDiscard.value = [];
        activeResources.value.forEach((_, key) => activeResources.value.set(key, 0));
        console.log("Play cancelled. UI Reset.");
    }
</script>

<template>
  <div class="hand-container-wrapper">
    <Transition name="fade">
        <button 
            v-if="activeCardId !== null" 
            class="btn-cancel" 
            @click="cancelPlay"
        >
            ✕ CANCEL PLAY
        </button>
    </Transition>

    <div class="hand-container">
      <HandCard
        v-for="card in props.hand"
        :key="card.instanceId"
        :card="card"
        :mode="getCardMode(card.instanceId!)"
        :class="{
          'card-active-play': activeCardId === card.instanceId,
          'card-is-resource': activeCardId !== null && activeCardId !== card.instanceId,
          'card-selected-to-pay': cardIdsToDiscard.includes(card.instanceId!)
        }"
        @play="handlePlay"
        @resource="handleAllResourcesFromEvent"
      />
    </div>
  </div>
</template>

<style scoped>
    .hand-container-wrapper {
        position: relative;
        display: flex;
        justify-content: center;
    }

    .hand-container {
        display: flex;
        justify-content: center;
        gap: 10px;
    }

    .btn-cancel {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        background: #c0392b;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        z-index: 100;
    }

    .btn-cancel:hover {
        background: #e74c3c;
        transform: translateX(-50%) translateY(-2px);
    }

    .fade-enter-active, .fade-leave-active {
        transition: opacity 0.3s, transform 0.3s;
    }
    .fade-enter-from, .fade-leave-to {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
    }

    .card-active-play {
        transform: translateY(-20px) scale(1.1);
        filter: drop-shadow(0 0 15px #3498db);
        z-index: 10;
        transition: all 0.3s ease;
    }

    .card-is-resource {
        filter: grayscale(0.3) brightness(0.8);
        opacity: 0.9;
    }

    .card-selected-to-pay {
        opacity: 0.4;
        filter: grayscale(1) blur(1px);
        transform: translateY(10px);
        pointer-events: none;
    }

    .card-is-resource:hover:not(.card-selected-to-pay) {
        filter: brightness(1.2) drop-shadow(0 0 10px #f1c40f);
        cursor: pointer;
    }
</style>
