import { createRouter, createWebHistory } from 'vue-router';
import SetupFlow from './components/setup/SetupFlow.vue';
import GameBoard from './components/GameBoard.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: SetupFlow },
        { path: '/game', component: GameBoard },
    ],
});

export default router;
