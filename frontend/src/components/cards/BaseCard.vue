<script setup lang="ts">
    defineProps<{
        imgPath: string;
        alt?: string;
    }>();
</script>

<template>
  <div class="base-card">
    <img :src="imgPath" :alt="alt ?? 'Card'" class="hover-zoom"/>
  </div>
</template>

<style scoped>
    .base-card {
        width: 200px;
        height: 300px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        margin: 0 auto;
        /* overflow: hidden; */
    }

    .base-card img {
        width: 100%;
        height: 100%;
        /* object-fit: cover; */
    }

    .hover-zoom {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .hover-zoom:hover {
        transform: scale(1.5);
        transform-origin: bottom;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        position: relative;
    }
</style>
