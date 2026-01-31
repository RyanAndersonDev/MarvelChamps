<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../../stores/gameStore';
import BaseCard from './BaseCard.vue';
import type { VillainIdentityCardInstance } from '../../types/card';

const props = defineProps<{ cardInstance: VillainIdentityCardInstance }>();
const store = useGameStore();

const isTargetable = computed(() => {
    return store.targeting.isActive && 
           (store.targeting.targetType === 'villain' || store.targeting.targetType === "enemy");
});

function handleClick() {
    if (isTargetable.value) {
        store.selectTarget(props.cardInstance.instanceId);
    }
}
</script>

<template>
    <div 
        class="id-card-wrapper"
        :class="{ 
            'is-targetable': isTargetable,
            'not-targetable': store.targeting.isActive && !isTargetable 
        }"
        @click="handleClick"
    >
        <BaseCard 
            :img-path="props.cardInstance.imgPath"
            :orientation="'vertical'"
            :zoom-direction="'down'"
            class="id-card"
        />
        <div v-if="isTargetable" class="target-badge">SELECT TARGET</div>
        <h2>HP: {{ props.cardInstance.hitPointsRemaining }}</h2>
    </div>
</template>

<style scoped>
    .id-card-wrapper {
        position: relative;
        transition: all 0.3s ease;
        display: inline-block;
    }

    .is-targetable {
        cursor: crosshair;
        filter: drop-shadow(0 0 20px #ff4444);
        transform: scale(1.02);
        z-index: 10;
    }

    .is-targetable:hover {
        filter: drop-shadow(0 0 30px #ff0000);
        transform: scale(1.05);
    }

    .not-targetable {
        opacity: 0.5;
        filter: grayscale(0.5);
        pointer-events: none;
    }

    .target-badge {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 5px 15px;
        border-radius: 5px;
        font-weight: bold;
        pointer-events: none;
        white-space: nowrap;
        border: 2px solid white;
    }

    h2 {
        text-align: center;
        margin-top: 10px;
        color: white;
        text-shadow: 2px 2px 4px black;
    }
</style>