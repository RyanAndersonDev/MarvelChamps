<script setup lang="ts">
defineProps<{
    stunned?: boolean;
    confused?: boolean;
    tough?: boolean;
}>();
</script>

<template>
    <TransitionGroup name="pip" tag="div" class="status-pips">
        <span v-if="stunned"  key="stun"  class="pip stun">STUN</span>
        <span v-if="confused" key="conf"  class="pip conf">CONF</span>
        <span v-if="tough"    key="tough" class="pip tough">TOUGH</span>
    </TransitionGroup>
</template>

<style scoped>
.status-pips {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    justify-content: center;
    min-height: 0;
}

.pip {
    font-size: 0.55rem;
    font-weight: 900;
    padding: 2px 5px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.6);
    display: inline-block;
}

.stun  { background: #e6ac00; }
.conf  { background: #7b5ea7; }
.tough { background: #e6ac00; }

.pip-enter-active {
    animation: pip-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.pip-leave-active {
    animation: pip-pop 0.2s cubic-bezier(0.55, 0, 1, 0.45) reverse;
}

@keyframes pip-pop {
    from { transform: scale(0); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
}
</style>
