<script setup lang="ts">
    import IdentityCard from "../cards/PlayerIdentityCard.vue";

    const props = defineProps<{ idCardId: number }>();
</script>

<template>
    <IdentityCard :cardId="props.idCardId" />
</template>

<style scoped>
    
</style>
