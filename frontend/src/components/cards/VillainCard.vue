<script setup lang="ts">
    import { computed } from "vue";
    import type { Minion, Treachery, Attachment, SideScheme } from '../../types/card';
    import BaseCard from './BaseCard.vue';

    const props = defineProps<{ card: Minion | Treachery | Attachment | SideScheme }>();

    const emit = defineEmits<{
        (e: 'resolve', currentInstanceId: number): void;
    }>();

    const cardOrientation = computed(() => 
        props.card.type === "side-scheme" ? "horizontal" : "vertical"
    )

    function resolveEncounterCard() {
        emit('resolve', props.card.instanceId);
    }
</script>

<template>
    <div class="encounter-card-wrapper">
        <BaseCard
        :img-path="card.imgPath"
        :orientation="cardOrientation"
        :zoom-direction="'down'"
        />

        <div class="button-row">
            <button @click="resolveEncounterCard">Resolve</button>
        </div>
    </div>
</template>

<style scoped>
    .encounter-card-wrapper {

    }
</style>
