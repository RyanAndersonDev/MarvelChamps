import { createRouter, createWebHistory } from 'vue-router';
import LandingView from './views/LandingView.vue';
import LobbyView from './views/LobbyView.vue';
import SetupFlow from './components/setup/SetupFlow.vue';
import GameBoard from './components/GameBoard.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/',      component: LandingView },
        { path: '/setup', component: SetupFlow },
        { path: '/lobby', component: LobbyView },
        { path: '/game',  component: GameBoard },
    ],
});

export default router;
