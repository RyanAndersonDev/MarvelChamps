<script setup lang="ts">
    import BaseCard from './BaseCard.vue';
    import type { VillainIdentityCardInstance } from '../../types/card';

    const props = defineProps<{ cardInstance: VillainIdentityCardInstance }>();
</script>

<template>
    <div class="id-card-wrapper">
        <BaseCard 
            :img-path="props.cardInstance.imgPath"
            :orientation="'vertical'"
            :zoom-direction="'down'"
            class="id-card"
        />
        <h2>HP: {{ props.cardInstance.hitPointsRemaining }}</h2>
    </div>
</template>

<style scoped>

</style>
