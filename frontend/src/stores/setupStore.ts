import { defineStore } from 'pinia';
import { socket } from '../socket';
import { useGameStore } from './gameStore';
import router from '../router';

export interface HeroCatalogEntry {
    id: number;
    name: string;
    heroDeckIds: number[];
    primaryColor: string;
    secondaryColor: string;
    imgPath: string;
    heroImgPath: string;
}

export interface VillainCatalogEntry {
    id: number;
    name: string;
    imgPath: string;
    expertImgPath?: string;
    mainSchemeId: number;
    villainDeckIds: number[];
    standardPhaseChain: number[];
    expertPhaseChain: number[];
    color: string;
}

export interface EncounterCatalogEntry {
    id: number;
    name: string;
    imgPath: string;
    description: string;
    cardIds: number[];
    cardNames: Record<number, string>;
}

export const useSetupStore = defineStore('setup', {
    state: () => ({
        currentStep: 1 as 1 | 2 | 3 | 4,

        selectedHeroId:        null as number | null,
        selectedAspect:        null as string | null,
        playerDeckIds:         [] as number[],

        selectedVillainId:      null as number | null,
        selectedEncounterSetId: null as number | null,
        expertMode:             false,

        catalog: {
            heroes:    [] as HeroCatalogEntry[],
            villains:  [] as VillainCatalogEntry[],
            encounters: [] as EncounterCatalogEntry[],
        },
    }),

    getters: {
        canAdvance(state): boolean {
            if (state.currentStep === 1) return state.selectedHeroId !== null;
            if (state.currentStep === 2) return state.playerDeckIds.length > 0;
            if (state.currentStep === 3) return state.selectedVillainId !== null;
            if (state.currentStep === 4) return state.selectedEncounterSetId !== null;
            return false;
        },

        selectedHero(state) {
            return state.catalog.heroes.find(h => h.id === state.selectedHeroId) ?? null;
        },

        selectedVillain(state) {
            return state.catalog.villains.find(v => v.id === state.selectedVillainId) ?? null;
        },

        selectedEncounterSet(state) {
            return state.catalog.encounters.find(e => e.id === state.selectedEncounterSetId) ?? null;
        },
    },

    actions: {
        async fetchCatalog() {
            if (this.catalog.heroes.length > 0) return; // already loaded
            try {
                const data = await fetch('http://localhost:3000/api/cards/catalog').then(r => r.json());
                this.catalog.heroes    = data.heroes    ?? [];
                this.catalog.villains  = data.villains  ?? [];
                this.catalog.encounters = data.encounters ?? [];
            } catch { /* non-fatal */ }
        },

        selectHero(heroId: number) {
            this.selectedHeroId = heroId;
            const hero = this.catalog.heroes.find(h => h.id === heroId);
            if (hero) this.playerDeckIds = [...hero.heroDeckIds];
        },

        selectAspect(aspect: string) {
            this.selectedAspect = aspect;
        },

        setPlayerDeckIds(ids: number[]) {
            this.playerDeckIds = ids;
        },

        selectVillain(villainId: number) {
            this.selectedVillainId = villainId;
        },

        setExpertMode(expert: boolean) {
            this.expertMode = expert;
        },

        selectEncounterSet(id: number) {
            this.selectedEncounterSetId = id;
        },

        nextStep() {
            if (this.currentStep < 4) this.currentStep = (this.currentStep + 1) as any;
        },

        prevStep() {
            if (this.currentStep > 1) this.currentStep = (this.currentStep - 1) as any;
        },

        async launchGame() {
            const hero = this.catalog.heroes.find(h => h.id === this.selectedHeroId)!;

            const gameStore = useGameStore();

            // 1. Create lobby room
            const createResult = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
                socket.emit('lobby:create', resolve as any);
            });
            if (!createResult.ok) throw new Error((createResult as any).error ?? 'lobby:create failed');

            // 2. Configure villain/encounter/difficulty (host only, no ack)
            socket.emit('lobby:configure', {
                villainId:      this.selectedVillainId!,
                encounterSetId: this.selectedEncounterSetId!,
                expertMode:     this.expertMode,
            });

            // 3. Select hero + deck
            socket.emit('lobby:selectHero', {
                heroId:  this.selectedHeroId!,
                aspect:  this.selectedAspect ?? 'hero',
                deckIds: this.playerDeckIds.length > 0 ? this.playerDeckIds : [...hero.heroDeckIds],
            });

            // 4. Mark ready
            socket.emit('lobby:setReady', { ready: true });

            // 5. Register stateUpdate listener BEFORE starting — server may emit it
            //    before the lobby:start ack arrives (race condition otherwise)
            const statePromise = new Promise<void>((resolve) => {
                socket.once('game:stateUpdate', (view) => {
                    gameStore.applyServerState(view);
                    resolve();
                });
            });

            // 6. Start the game
            const startResult = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
                socket.emit('lobby:start', resolve as any);
            });
            if (!startResult.ok) {
                socket.off('game:stateUpdate');
                throw new Error((startResult as any).error ?? 'lobby:start failed');
            }

            await statePromise;
            router.push('/game');
        },
    },
});
