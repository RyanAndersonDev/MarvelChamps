<script setup lang="ts">
    import { ref, computed } from "vue";
    import type { Minion } from '../../types/card';
    import BaseCard from './BaseCard.vue';
    import { useGameStore } from "../../stores/gameStore";

    const props = defineProps<{ card: Minion }>();
    const store = useGameStore();
    const isHovered = ref(false);

    const isTargetable = computed(() => {
        return store.targeting.isActive
            && (store.targeting.targetType === "minion" || store.targeting.targetType === "enemy");
    });

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
            'hover-disabled': store.targeting.isActive && !isTargetable 
        }"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
        @click="handleClick"
    >
        <BaseCard
            :img-path="card.imgPath"
            :orientation="'vertical'"
            :zoom-direction="'out'"
            :size="'small'"
            :class="{ 'zoomed': isHovered && !store.targeting.isActive }"
        />

        <div v-if="isHovered && card.attachments.length && !store.targeting.isActive" class="fixed-attachment-bar">
            <div class="attachment-label">ATTACHMENTS</div>
            <div class="attachment-list">
                <BaseCard
                    v-for="(attach, index) in card.attachments"
                    :key="index"
                    :img-path="attach.imgPath"
                    :orientation="'vertical'"
                    :zoom-direction="'out'"
                    :size="'normal'"
                />
            </div>
        </div>

        <div v-if="isTargetable" class="target-overlay">
            <span class="target-text">SELECT</span>
        </div>
    </div>
</template>

<style scoped>
    .minion-unit {
        position: relative;
        cursor: pointer;
        transition: transform 0.2s, filter 0.2s;
    }

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
    }

    .target-text {
        background: rgba(0, 255, 204, 0.9);
        color: black;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 0.75rem;
    }

    @keyframes pulse-target {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
</style>
