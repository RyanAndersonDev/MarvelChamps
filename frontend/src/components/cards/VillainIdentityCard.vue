<script setup lang="ts">
    import BaseCard from './BaseCard.vue';
    import type { VillainIdentityCardInstance } from '../../types/card';

    const props = defineProps<{ cardInstance: VillainIdentityCardInstance }>();
</script>

<template>
    <div class="id-card-wrapper">
        <h2>HP: {{ props.cardInstance.hitPointsRemaining }}</h2>
        <BaseCard 
            :img-path="props.cardInstance.imgPath" 
            class="id-card"
        />
    </div>
</template>

<style scoped>

</style>
