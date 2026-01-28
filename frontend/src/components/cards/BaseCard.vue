<script setup lang="ts">
    defineProps<{
        imgPath: string;
        alt?: string;
        orientation: "vertical" | "horizontal";
        zoomDirection: "up" | "down";
    }>();
</script>

<template>
  <div class="base-card" :class="orientation ?? 'vertical'">
    <img :src="imgPath" 
    :alt="alt ?? 'Card'" 
    :class="zoomDirection"/>
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

    .base-card.vertical {
        width: 100%;
        max-width: 200px;
        aspect-ratio: 2 / 3;
    }

    .base-card.horizontal {
        width: 100%;
        max-width: 300px;
        aspect-ratio: 3 / 2;
    }

    .base-card img {
        width: 100%;
        height: 100%;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .base-card img.up:hover {
        transform: scale(1.5);
        transform-origin: bottom;
        box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        position: relative;
    }

    .base-card img.down:hover {
        transform: scale(1.5);
        transform-origin: top;
        box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        position: relative;
    }
</style>
