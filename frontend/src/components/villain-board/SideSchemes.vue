<script setup lang="ts">
    import type { SideScheme } from '../../types/card';
import SideSchemeCard from '../cards/SideSchemeCard.vue';

    const props = defineProps<{ sideSchemes: SideScheme[] }>();
</script>>

<template>
    <div class="side-scheme-container-wrapper">
        <div class="side-scheme-container">
            <SideSchemeCard
                v-for="card in sideSchemes"
                :key="card.instanceId"
                :card="card"
            />
        </div>
    </div>
</template>

<style scoped>

</style>
