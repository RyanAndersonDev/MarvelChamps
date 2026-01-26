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
    .base-card.vertical {
        width: 200px;
        height: 300px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        margin: 0 auto;
        /* overflow: hidden; */
    }

    .base-card.horizontal {
        width: 300px;
        height: 200px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        margin: 0 auto;
    }

    .base-card img {
        width: 100%;
        height: 100%;
        /* object-fit: cover; */
    }

    .base-card img {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .base-card img.up:hover {
        transform: scale(1.5);
        transform-origin: bottom;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        position: relative;
    }

    .base-card img.down:hover {
        transform: scale(1.5);
        transform-origin: top;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        position: relative;
    }
</style>
