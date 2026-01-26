<script setup lang="ts">
    import type { MainSchemeInstance } from '../../types/card';
import BaseCard from '../cards/BaseCard.vue';

    const props = defineProps<{ schemeInstance: MainSchemeInstance }>();
</script>

<template>
    <div class="id-card-wrapper">
        <BaseCard
            :img-path="props.schemeInstance.imgPath"
            :orientation="'horizontal'"
            :zoom-direction="'down'"
        />
        <h2>Threat: {{ schemeInstance.currentThreat }}</h2>
        <h2>Threshold: {{ schemeInstance.threatThreshold }}</h2>
    </div>
</template>

<style scoped>

</style>
