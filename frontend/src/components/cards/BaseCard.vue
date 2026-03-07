<script setup lang="ts">
    import { ref } from 'vue';

    const props = defineProps<{
        imgPath: string;
        alt?: string;
        orientation: "vertical" | "horizontal";
        zoomDirection: "up" | "down" | "out";
        size?: "normal" | "small";
        noZoom?: boolean;
    }>();

    const cardEl = ref<HTMLElement | null>(null);
    const mouseInTopZone = ref(false);

    function onMouseMove(e: MouseEvent) {
        if (!cardEl.value) return;
        const rect = cardEl.value.getBoundingClientRect();
        mouseInTopZone.value = (e.clientY - rect.top) / rect.height < 0.75;
    }

    function onMouseLeave() {
        mouseInTopZone.value = false;
    }
</script>

<template>
  <div
    class="base-card"
    :class="[props.orientation ?? 'vertical', props.size ?? 'normal']"
    ref="cardEl"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <img
      :src="props.imgPath"
      :alt="props.alt ?? 'Card'"
      :class="[props.zoomDirection, { 'no-zoom': props.noZoom || !mouseInTopZone }]"
    />
  </div>
</template>

<style scoped>
    .base-card {
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        margin: 0 auto;
        flex-shrink: 0;
        overflow: visible;
        position: relative;
    }

    .base-card.vertical.normal {
        width: 100%;
        max-width: 200px;
        aspect-ratio: 2 / 3;
    }

    .base-card.vertical.small {
        width: 100%;
        max-width: 200px;
        aspect-ratio: 2 / 3;
    }

    .base-card.horizontal.normal {
        width: 100%;
        max-width: 300px;
        aspect-ratio: 3 / 2;
    }

    .base-card.horizontal.small {
        width: 100%;
        max-width: 225px;
        aspect-ratio: 3 / 2;
    }

    .base-card img {
        width: 100%;
        height: 100%;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .base-card:hover img.up {
        transform: scale(1.5);
        transform-origin: bottom;
        box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        position: relative;
    }

    .base-card:hover img.down {
        transform: scale(1.5);
        transform-origin: top;
        box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        position: relative;
    }

    .base-card:hover img.out {
        transform: scale(1.5);
        transform-origin: center;
        box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        position: relative;
    }

    .base-card:hover img.no-zoom {
        transform: none;
        box-shadow: none;
    }
</style>
