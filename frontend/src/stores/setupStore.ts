import { defineStore } from 'pinia';
import { heroLibrary, villainLibrary, encounterLibrary, standardICardIds } from '../cards/cardStore';
import { useGameStore } from './gameStore';
import router from '../router';

export const useSetupStore = defineStore('setup', {
    state: () => ({
        currentStep: 1 as 1 | 2 | 3 | 4,

        selectedHeroId:        null as number | null,
        selectedAspect:        null as string | null,
        playerDeckIds:         [] as number[],

        selectedVillainId:     null as number | null,
        selectedEncounterSetId: null as number | null,
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
            return heroLibrary.find(h => h.id === state.selectedHeroId) ?? null;
        },

        selectedVillain(state) {
            return villainLibrary.find(v => v.id === state.selectedVillainId) ?? null;
        },

        selectedEncounterSet(state) {
            return encounterLibrary.find(e => e.id === state.selectedEncounterSetId) ?? null;
        },
    },

    actions: {
        selectHero(heroId: number) {
            this.selectedHeroId = heroId;
            // Pre-populate deck with hero's default cards
            const hero = heroLibrary.find(h => h.id === heroId);
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

        selectEncounterSet(id: number) {
            this.selectedEncounterSetId = id;
        },

        nextStep() {
            if (this.currentStep < 4) this.currentStep = (this.currentStep + 1) as any;
        },

        prevStep() {
            if (this.currentStep > 1) this.currentStep = (this.currentStep - 1) as any;
        },

        launchGame() {
            const villain  = villainLibrary.find(v => v.id === this.selectedVillainId)!;
            const encounter = encounterLibrary.find(e => e.id === this.selectedEncounterSetId)!;

            const villainDeckIds = [
                ...villain.villainDeckIds,
                ...encounter.cardIds,
                ...standardICardIds,
            ];

            const gameStore = useGameStore();
            gameStore.initializeGame({
                heroId:        this.selectedHeroId!,
                playerDeckIds: this.playerDeckIds,
                villainId:     this.selectedVillainId!,
                mainSchemeId:  villain.mainSchemeId,
                villainDeckIds,
            });

            router.push('/game');
        },
    },
});
