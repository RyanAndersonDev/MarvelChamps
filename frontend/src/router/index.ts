import { createRouter, createWebHashHistory } from 'vue-router';
import SetupFlow from '../components/setup/SetupFlow.vue';
import GameBoard from '../components/GameBoard.vue';

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/',       redirect: '/setup' },
        { path: '/setup',  component: SetupFlow },
        { path: '/game',   component: GameBoard },
    ],
});

export default router;
