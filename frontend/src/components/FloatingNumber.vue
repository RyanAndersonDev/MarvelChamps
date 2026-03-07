<script setup lang="ts">
    import { computed } from 'vue';
    import { useGameStore } from '../stores/gameStore';

    const props = defineProps<{ target: 'villain' | 'scheme' | 'hero' }>();
    const store = useGameStore();

    const items = computed(() => store.floatingEvents.filter(e => e.target === props.target));
</script>

<template>
    <TransitionGroup name="float-up" tag="div" class="float-host">
        <div
            v-for="item in items"
            :key="item.id"
            class="floating-num"
            :style="{ color: item.color }"
        >{{ item.text }}</div>
    </TransitionGroup>
</template>

<style scoped>
    .float-host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .floating-num {
        position: absolute;
        font-size: 2.4rem;
        font-weight: 900;
        font-family: sans-serif;
        text-shadow: 2px 2px 6px black, 0 0 14px currentColor;
        letter-spacing: -1px;
        white-space: nowrap;
        top: 35%;
    }

    /* Enter: float up and fade — animation owns the lifetime */
    .float-up-enter-active {
        animation: float-up 1.5s ease-out forwards;
    }
    /* Instant removal — the animation already faded it to opacity 0 */
    .float-up-leave-active {
        display: none;
    }

    @keyframes float-up {
        0%   { opacity: 1;   transform: translateY(0)     scale(1.4); }
        12%  { opacity: 1;   transform: translateY(-8px)  scale(1.6); }
        65%  { opacity: 0.9; transform: translateY(-55px) scale(1.1); }
        100% { opacity: 0;   transform: translateY(-85px) scale(0.9); }
    }
</style>
