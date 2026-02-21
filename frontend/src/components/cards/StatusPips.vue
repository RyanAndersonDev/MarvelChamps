<script setup lang="ts">
defineProps<{
    stunned?: boolean;
    confused?: boolean;
    tough?: boolean;
}>();
</script>

<template>
    <div v-if="stunned || confused || tough" class="status-pips">
        <span v-if="stunned"  class="pip stun">STUN</span>
        <span v-if="confused" class="pip conf">CONF</span>
        <span v-if="tough"    class="pip tough">TOUGH</span>
    </div>
</template>

<style scoped>
.status-pips {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    justify-content: center;
}

.pip {
    font-size: 0.55rem;
    font-weight: 900;
    padding: 2px 5px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}

.stun  { background: #e6ac00; }
.conf  { background: #7b5ea7; }
.tough { background: #e6ac00; }
</style>
