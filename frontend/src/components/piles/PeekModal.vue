<script setup lang="ts">
    defineProps<{
        title: string;
        imgPaths: string[];
    }>();

    const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
    <Teleport to="body">
        <div class="peek-backdrop" @click.self="emit('close')">
            <div class="peek-panel">
                <div class="peek-header">
                    <span>{{ title }} <span class="peek-count">({{ imgPaths.length }})</span></span>
                    <button class="peek-close" @click="emit('close')">✕</button>
                </div>

                <div class="peek-grid">
                    <template v-for="(path, i) in imgPaths" :key="i">
                        <div v-if="path.includes('-SideScheme')" class="peek-card-wrapper">
                            <img :src="path" class="peek-card-inner" />
                        </div>
                        <img v-else :src="path" class="peek-card" />
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.peek-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.peek-panel {
    background: #1a1a2e;
    border: 1px solid #444;
    border-radius: 10px;
    width: min(95vw, 1200px);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
}

.peek-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #111;
    border-bottom: 1px solid #333;
    font-size: 0.8rem;
    font-weight: 800;
    color: #ccc;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex-shrink: 0;
}

.peek-count {
    color: #666;
    font-weight: 400;
}

.peek-close {
    background: none;
    border: none;
    color: #888;
    font-size: 1rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
}

.peek-close:hover { color: white; }

.peek-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #444 transparent;
}

.peek-card {
    width: 180px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    transition: transform 0.15s ease;
    cursor: default;
}

.peek-card:hover {
    transform: scale(1.5);
    z-index: 10;
    position: relative;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
}

.peek-card-wrapper {
    width: 180px;
    aspect-ratio: 2 / 3;
    overflow: hidden;
    position: relative;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
    cursor: default;
    transition: transform 0.15s ease;
}

.peek-card-wrapper:hover {
    transform: scale(1.5);
    z-index: 10;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
}

.peek-card-inner {
    position: absolute;
    width: 150%;
    height: 66.67%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-90deg);
}
</style>
