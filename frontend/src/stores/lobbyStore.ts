import { defineStore } from 'pinia';
import { socket } from '../socket';
import type { LobbyRoom } from '../../../backend/types/game';

function computeMyUserId(): string {
    const devUser = localStorage.getItem('devUser') ?? 'Player1';
    return `dev-${devUser.toLowerCase().replace(/\s+/g, '-')}`;
}

export const useLobbyStore = defineStore('lobby', {
    state: () => ({
        room: null as LobbyRoom | null,
        myUserId: computeMyUserId(),
        error: '',
    }),

    getters: {
        isHost(state): boolean {
            return !!state.room && state.room.hostUserId === state.myUserId;
        },
        myLobbyPlayer(state) {
            return state.room?.players.find(p => p.user.id === state.myUserId) ?? null;
        },
        amReady(state): boolean {
            return state.room?.players.find(p => p.user.id === state.myUserId)?.isReady ?? false;
        },
    },

    actions: {
        async createRoom(): Promise<string> {
            return new Promise((resolve, reject) => {
                socket.emit('lobby:create', (result: any) => {
                    if (result.ok) {
                        this.room = result.room;
                        resolve(result.room.code);
                    } else {
                        reject(new Error(result.error ?? 'Failed to create room'));
                    }
                });
            });
        },

        async joinRoom(code: string): Promise<void> {
            return new Promise((resolve, reject) => {
                socket.emit('lobby:join', { code: code.toUpperCase() }, (result: any) => {
                    if (result.ok) {
                        resolve();
                    } else {
                        reject(new Error(result.error ?? 'Failed to join room'));
                    }
                });
            });
        },

        selectHero(heroId: number, aspect: string, deckIds: number[]) {
            socket.emit('lobby:selectHero', { heroId, aspect, deckIds });
        },

        setReady(ready: boolean) {
            socket.emit('lobby:setReady', { ready });
        },

        configure(villainId: number, encounterSetId: number, expertMode: boolean) {
            socket.emit('lobby:configure', { villainId, encounterSetId, expertMode });
        },

        async startGame(): Promise<void> {
            return new Promise((resolve, reject) => {
                socket.emit('lobby:start', (result: any) => {
                    if (result.ok) resolve();
                    else reject(new Error(result.error ?? 'Failed to start'));
                });
            });
        },

        listenForUpdates() {
            socket.off('lobby:update');
            socket.on('lobby:update', (room) => {
                this.room = room;
            });
        },

        reset() {
            this.room = null;
            this.error = '';
            socket.off('lobby:update');
        },
    },
});
