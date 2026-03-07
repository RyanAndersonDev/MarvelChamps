import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './assets/styles/global.css'
import App from './App.vue'
import router from './router'
import { socket } from './socket'
import { useGameStore } from './stores/gameStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')

// ── Wire Socket.IO listeners ───────────────────────────────────────────────
const gameStore = useGameStore()

socket.on('game:resumeAvailable', (offer) => {
    gameStore.resumeOffer = offer
})

socket.on('game:stateUpdate', (view) => {
    gameStore.resumeOffer = null   // clear any pending offer once a real game loads
    gameStore.applyServerState(view)
    if (router.currentRoute.value.path !== '/game') {
        router.push('/game')
    }
})

socket.on('game:targetingRequired', (data) => {
    gameStore.targeting = {
        isActive: true,
        action: 'engine',
        validTargetIds: data.validTargetIds,
    }
})

socket.on('game:promptClose', () => {
    gameStore.activePrompt = null
})

socket.on('game:highlight', (data) => {
    if (data.entityId === '*') {
        gameStore.highlights = {}
    } else if (data.type === 'clear') {
        delete gameStore.highlights[data.entityId]
    } else {
        gameStore.highlights[data.entityId] = data.type
    }
})
