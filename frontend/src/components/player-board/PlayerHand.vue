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
            cardIdsToDiscard.value.push(currentCard.storageId!);
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

        cardIdsToDiscard.value.push(storageId);

        if (resolvePlay()) {
            const card = props.hand.find(c => c.instanceId === activeCardId.value!);

            if (card?.type === "event") {
                if (!cardIdsToDiscard.value.includes(card?.storageId!)) {
                    cardIdsToDiscard.value.push(card?.storageId!);
                }
            }
            else if (card?.type === "upgrade") {
                if (card.attachmentLocation === "minion") {
                    try {
                        const targetId = await store.requestTarget(card, 'minion');
                        store.attachToMinion(card as Upgrade, targetId);                        
                        emit('destroyHandCard', card.instanceId!);
                    } catch (error) {
                        console.log("Targeting was cancelled or failed");
                        return;
                    }
                }

                if (card.attachmentLocation === "villain") {
                    try {
                        const targetId = await store.requestTarget(card, "villain");
                    } catch (error) {
                        console.log("Targeting on villain was cancelled or failed");
                        return;
                    }
                }
            }
            else {
                sendToTableau(card?.storageId!);
                emit('destroyHandCard', card?.instanceId!);
            }

            emit('discard', [...cardIdsToDiscard.value]);

            cardIdsToDiscard.value = [];
            activeResources.value.clear();
            activeCardId.value = null;

            resolveCardEffect();
            console.log("we did it!");
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
</script>

<template>
    <div class="hand-container-wrapper">
        <div class="hand-container">
            <HandCard
                v-for="card in props.hand"
                :key="card.instanceId"
                :card="card"
                :mode="getCardMode(card.instanceId!)"
                @play="handlePlay"
                @resource="handleAllResourcesFromEvent"
            />
        </div>
    </div>
</template>

<style scoped>
    
</style>
