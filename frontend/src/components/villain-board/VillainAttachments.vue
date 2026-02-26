<script setup lang="ts">
    import { ref } from 'vue';
    import type { Attachment, Upgrade } from '../../types/card';
    import { useGameStore } from '../../stores/gameStore';

    const store = useGameStore();

    const props = defineProps<{ attachments: (Attachment | Upgrade)[]; hostId: number }>();

    const hoverCard = ref<{ imgPath: string; name: string } | null>(null);
    const popupStyle = ref({});

    function showPreview(e: MouseEvent, card: any) {
        hoverCard.value = card;
        positionPopup(e);
    }

    function positionPopup(e: MouseEvent) {
        const x = e.clientX + 12;
        const y = e.clientY - 80;
        popupStyle.value = {
            left: `${Math.min(x, window.innerWidth - 170)}px`,
            top: `${Math.max(y, 8)}px`
        };
    }

    function hidePreview() {
        hoverCard.value = null;
    }
</script>

<template>
    <div v-if="attachments.length > 0" class="attachment-strip">
        <div
            v-for="card in attachments"
            :key="card.instanceId"
            class="attachment-chip"
            @mouseenter="(e) => showPreview(e, card)"
            @mousemove="positionPopup"
            @mouseleave="hidePreview"
        >
            <span class="chip-dot"></span>
            {{ card.name }}
            <button
                v-if="(card as any).removal && store.currentPhase === 'PLAYER_TURN' && (!(card as any).removal.formRequired || (card as any).removal.formRequired === store.hero.identityStatus)"
                class="remove-btn"
                @click.stop="store.startAttachmentRemoval(card, props.hostId)"
            >REMOVE ({{ (card as any).removal.cost }}{{ (card as any).removal.resourceType ? ' ' + (card as any).removal.resourceType[0].toUpperCase() : '' }})</button>
        </div>

        <Teleport to="body">
            <div v-if="hoverCard" class="attachment-popup" :style="popupStyle">
                <img :src="hoverCard.imgPath" :alt="hoverCard.name" />
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.attachment-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
    max-width: 160px;
}

.attachment-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(180, 30, 30, 0.85);
    border: 1px solid #ff4444;
    border-radius: 10px;
    padding: 2px 7px;
    font-size: 0.6rem;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.03em;
    cursor: default;
    white-space: nowrap;
    user-select: none;
}

.attachment-chip:hover {
    background: rgba(220, 50, 50, 0.95);
    border-color: #ff8888;
}

.remove-btn {
    margin-left: 4px;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 6px;
    color: #ffcccc;
    font-size: 0.55rem;
    font-weight: 900;
    padding: 1px 4px;
    cursor: pointer;
    line-height: 1;
}

.remove-btn:hover {
    background: #c0392b;
    border-color: white;
    color: white;
}

.chip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ffaaaa;
    flex-shrink: 0;
}

.attachment-popup {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    width: 155px;
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
    overflow: hidden;
}

.attachment-popup img {
    width: 100%;
    display: block;
    border-radius: 6px;
}
</style>
