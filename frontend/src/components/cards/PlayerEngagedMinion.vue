<script setup lang="ts">
    import type { Minion } from '../../types/card';
    import BaseCard from './BaseCard.vue';

    const props = defineProps<{ card: Minion }>();
</script>

<template>
    <div class="engaged-minion-card-wrapper">
        <BaseCard
            :img-path="card.imgPath"
            :orientation="'vertical'"
            :zoom-direction="'out'"
        />
    </div>
</template>

<style scoped>
    .engaged-minion-card-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
</style>
