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
        <div class="stat-badges">
            <div class="stat-badge blue">{{ props.cardInstance.sch }}</div>
            <div class="stat-badge red">{{ props.cardInstance.atk }}</div>
            <div class="stat-badge orange">{{ props.cardInstance.hitPointsRemaining }}</div>
        </div>

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

    .stat-badges {
        position: absolute;
        top: 10px;
        right: -12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 15;
        pointer-events: none;
    }

    .stat-badge {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 0.9rem;
        color: white;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        border: 2px solid white;
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
        font-family: sans-serif;
    }

    .stat-badge.blue { background-color: #2196F3; }
    .stat-badge.red { background-color: #f44336; }
    .stat-badge.orange { background-color: #FF9800; }

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
        z-index: 20;
    }

    h2 {
        text-align: center;
        margin-top: 10px;
        color: white;
        text-shadow: 2px 2px 4px black;
    }
</style>