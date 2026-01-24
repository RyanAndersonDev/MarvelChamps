<script setup lang="ts">
    import IdentityCard from "../cards/IdentityCard.vue";

    const props = defineProps<{ idCardId: number }>();
</script>

<template>
    <IdentityCard :cardId="props.idCardId" />
</template>

<style scoped>
    
</style>
