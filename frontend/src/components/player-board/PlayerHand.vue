<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import type { Ally, Event, Upgrade, Support } from '../../types/card';
    import HandCard from '../cards/HandCard.vue';
    import { createHandCard } from '../../cards/cardFactory';
    import type { Resource } from '../../types/card';

    const props = defineProps<{ newCardId: number | null }>();
    const emit = defineEmits<{
        (e: 'discard', cardIds: number[]): void;
    }>();
    
    const hand = ref<(Ally | Event | Upgrade | Support)[]>([]);
    const activeCardId = ref<number | null>(null);
    const cardIdsToDiscard = ref<number[]>([]);

    const rscReqAmt = computed(() => {
        if (activeCardId.value === null)
            return;

        const activeCard = hand.value.find(card => card.id === activeCardId.value);
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

    watch(() => props.newCardId, (id) => {
        if (id !== null) {
            hand.value.push(createHandCard(id, hand.value.length));
        }
    })

    function handlePlay(cardId: number) : void {
        activeCardId.value = cardId;
    }

    function handleAllResourcesFromEvent(payload: { cardId: number, resources: Resource[] }) {
        handleAllResources(payload.resources, payload.cardId);
    }

    function handleAllResources(rscArr: Resource[], cardId: number) {
        rscArr.forEach(r => {
            const map = activeResources.value;
            if (!map) return;

            const current = map.get(r) ?? 0;
            map.set(r, current + 1);
        });

        if (resolvePlay()) {
            const card = hand.value.find(c => c.id === cardId);

            if (card?.type === "event") {
                if (!cardIdsToDiscard.value.includes(cardId)) {
                    cardIdsToDiscard.value.push(cardId);
                }
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
</script>

<template>
    <div class="hand-container-wrapper">
        <div class="hand-container">
            <HandCard
                v-for="card in hand"
                :key="card.id"
                :card="card"
                :mode="getCardMode(card.id!)"
                @play="handlePlay"
                @resource="handleAllResourcesFromEvent"
            />
        </div>
    </div>
</template>

<style scoped>
    
</style>
