<script setup lang="ts">
    import BaseCard from '../cards/BaseCard.vue';
    import type { Attachment, Upgrade } from '../../types/card';

    defineProps<{
        attachments: (Attachment | Upgrade)[];
    }>();
</script>

<template>
  <div class="attachment-pile-container" v-if="attachments.length > 0">
    <div class="pile-header">
      <span class="pulse-dot"></span>
        MODIFIERS ({{ attachments.length }})
    </div>
    
    <div class="scroll-area">
      <div 
        v-for="card in attachments" 
        :key="card.instanceId" 
        class="attachment-item"
      >
        <BaseCard 
          :img-path="card.imgPath" 
          :orientation="'vertical'"
          :size="'small'"
          :zoom-direction="'out'"
          class="mini-card"
        />
      </div>
    </div>
    
    <div class="pile-footer">
      <i class="arrow-down"></i>
    </div>
  </div>
</template>

<style scoped>
.attachment-pile-container {
  display: flex;
  flex-direction: column;
  width: 170px;
  align-self: stretch;
  background: rgba(15, 5, 5, 0.9);
  border: 2px solid #ff4444;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
  position: relative;
  overflow: hidden;
  z-index: 5;
}

.pile-header {
  background: #ff4444;
  color: white;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 10px;
  text-align: center;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.scroll-area {
  flex: 1; 
  padding: 15px 10px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  overflow-x: hidden;
  
  scrollbar-width: thin;
  scrollbar-color: #ff4444 transparent;
}

.scroll-area::-webkit-scrollbar {
  width: 4px;
}

.scroll-area::-webkit-scrollbar-thumb {
  background: #ff4444;
  border-radius: 10px;
}

.attachment-item {
  width: 100%;
  display: flex;
  justify-content: center;
  transition: transform 0.2s ease;
  cursor: pointer;
}

.attachment-item:hover {
  transform: scale(1.08);
  filter: brightness(1.1);
}

.mini-card {
  width: 130px;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
}

.pile-footer {
  height: 6px;
  background: rgba(255, 68, 68, 0.2);
  flex-shrink: 0;
}

.pulse-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: #fff;
  border-radius: 50%;
  margin-right: 8px;
  box-shadow: 0 0 8px #fff;
  animation: blink 2s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
