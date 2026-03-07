<script setup lang="ts">
    import { ref, computed } from "vue";
    import type { Minion } from '@shared/types/card';
    import BaseCard from './BaseCard.vue';
    import StatusPips from './StatusPips.vue';
    import { useGameStore } from "../../stores/gameStore";

    const props = defineProps<{ card: Minion }>();
    const store = useGameStore();
    const isHovered = ref(false);

    const isTargetable = computed(() => {
        return store.targeting.isActive
            && store.targeting.validTargetIds.includes(props.card.instanceId);
    });

    const effectiveAtk = computed(() => {
        const baseAtk = (props.card as any).dynamicAtk === 'hitPointsRemaining'
            ? (props.card.hitPointsRemaining ?? props.card.atk)
            : props.card.atk;
        return baseAtk + (props.card.attachments ?? [])
            .reduce((sum, att) => sum + ((att as any).atkMod ?? 0), 0);
    });

    const effectiveSch = computed(() =>
        props.card.sch + (props.card.attachments ?? [])
            .reduce((sum, att) => sum + ((att as any).schMod ?? 0), 0)
    );

    function handleClick() {
        if (isTargetable.value) {
            store.selectTarget(props.card.instanceId);
        }
    }
</script>

<template>
    <div 
        class="minion-unit"
        :class="{
            'is-targetable': isTargetable,
            'hover-disabled': store.targeting.isActive && !isTargetable,
            'hl-activating': store.highlights[String(card.instanceId)] === 'activating',
            'hl-targeted': store.highlights[String(card.instanceId)] === 'targeted',
        }"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
        @click="handleClick"
    >
        <div class="stat-badges">
            <div class="stat-badge blue">{{ effectiveSch }}</div>
            <div class="stat-badge red">{{ effectiveAtk }}</div>
            <div class="stat-badge orange">{{ card.hitPointsRemaining }}</div>
        </div>

        <BaseCard
            :img-path="card.imgPath"
            :orientation="'vertical'"
            :zoom-direction="'out'"
            :size="'small'"
            :no-zoom="store.targeting.isActive"
            :class="{ 'zoomed': isHovered && !store.targeting.isActive }"
        />

        <StatusPips :stunned="card.stunned" :confused="card.confused" :tough="card.tough" />

        <div v-if="card.attachments?.length" class="attachment-badge">
            ⚙ {{ card.attachments.length }}
            <div class="attachment-tooltip">
                <div v-for="att in card.attachments" :key="(att as any).instanceId" class="tooltip-entry">
                    <img :src="(att as any).imgPath" class="tooltip-img" />
                    <span>{{ (att as any).name }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .minion-unit {
        position: relative;
        cursor: pointer;
        transition: transform 0.2s, filter 0.2s;
        display: inline-block;
        overflow: visible;
    }

    .stat-badges {
        position: absolute;
        top: 5px;
        right: -8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 10;
        pointer-events: none;
    }

    .stat-badge {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 0.8rem;
        color: white;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        font-family: sans-serif;
    }

    .stat-badge.blue { background-color: #2196F3; }
    .stat-badge.red { background-color: #f44336; }
    .stat-badge.orange { background-color: #FF9800; }

    .fixed-attachment-bar {
        position: fixed;
        bottom: 20px;   
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        padding: 20px;
        border-radius: 15px;
        border: 2px solid #ffd700;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        z-index: 9999;
        box-shadow: 0 0 30px rgba(0,0,0,1);
    }

    .attachment-list {
        display: flex;
        gap: 15px;
    }

    .attachment-label {
        color: #ffd700;
        font-weight: bold;
        font-family: sans-serif;
        letter-spacing: 2px;
    }

    .is-targetable {
        cursor: crosshair;
        z-index: 1000; 
        filter: drop-shadow(0 0 20px #00ffcc);
        animation: pulse-target 1.5s infinite;
    }

    .is-targetable .stat-badge {
        opacity: 0.8;
        border-color: #00ffcc;
    }

    .is-targetable:hover {
        transform: scale(1.05);
        filter: drop-shadow(0 0 30px #00ffcc) brightness(1.2);
    }

    .hover-disabled {
        opacity: 0.3;
        pointer-events: none;
        filter: grayscale(1);
    }

    .target-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 20;
    }

    .target-text {
        background: rgba(0, 255, 204, 0.9);
        color: black;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 0.75rem;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    }

    @keyframes pulse-target {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }

    .attachment-badge {
        position: absolute;
        bottom: 4px;
        left: 4px;
        background: #e67e22;
        color: white;
        font-size: 0.65rem;
        font-weight: 900;
        padding: 3px 6px;
        border-radius: 4px;
        border: 1.5px solid #fff;
        z-index: 9999;
        cursor: default;
    }

    .attachment-tooltip {
        display: none;
        position: absolute;
        bottom: calc(100% + 8px);
        left: 0;
        background: rgba(10, 10, 20, 0.97);
        border: 1px solid #e67e22;
        border-radius: 8px;
        padding: 16px;
        z-index: 9999;
        flex-direction: row;
        gap: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.9);
        white-space: nowrap;
    }

    .attachment-badge:hover .attachment-tooltip {
        display: flex;
    }

    .tooltip-entry {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #eee;
        font-size: 0.85rem;
        font-weight: 700;
        text-align: center;
    }

    .tooltip-img {
        width: 240px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.7);
        flex-shrink: 0;
    }
</style>
