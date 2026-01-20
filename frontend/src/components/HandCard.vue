<script setup lang="ts">
    import type { Ally, Event, Upgrade, Support } from '../types/card';
    defineProps<{ card: Ally | Event | Upgrade | Support }>();
</script>

<template>
    <div class="card">
    <img :src="card.imgPath" />
    <p>{{ card.name }}</p>
    <p v-if="'health' in card">Health: {{ card.health }}</p>
    <p v-if="'counters' in card">Counters: {{ card.counters }}</p>
  </div>
</template>

<style scoped>

</style>
