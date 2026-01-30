<script setup lang="ts">
import type { SideScheme } from '../../types/card';
import BaseCard from './BaseCard.vue';

    const props = defineProps<{ card: SideScheme }>();
</script>

<template>
    <div class="side-scheme-card-wrapper">
        <BaseCard
            :img-path="card.imgPath"
            :orientation="'horizontal'"
            :zoom-direction="'down'"
            :size="'small'"
        />
    </div>
</template>

<style scoped>

</style>
