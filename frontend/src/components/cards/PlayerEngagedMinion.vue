<script setup lang="ts">
    import { ref } from "vue";
    import type { Minion } from '../../types/card';
    import BaseCard from './BaseCard.vue';

    const props = defineProps<{ card: Minion }>();
    const isHovered = ref(false);
</script>

<template>
    <div class="minion-unit"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
    >
        <BaseCard
            :img-path="card.imgPath"
            :orientation="'vertical'"
            :zoom-direction="'out'"
            :size="'small'"
            :class="{ 'zoomed': isHovered }"
        />

        <div v-if="isHovered && card.attachments.length" class="fixed-attachment-bar">
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
    </div>
</template>

<style scoped>
    .minion-unit {
    position: relative;
    cursor: pointer;
    }

    /* This bar ignores all your game board's grid and overflow issues */
    .fixed-attachment-bar {
        position: fixed;
        bottom: 20px;   /* Pins it to the bottom of the screen */
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
        z-index: 9999; /* Higher than EVERYTHING */
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
</style>
