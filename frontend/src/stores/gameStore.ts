import { defineStore } from "pinia";
import { socket } from '../socket';
import type {
    Ally, Event, Upgrade, Support, IdentityCardInstance, VillainIdentityCardInstance,
    MainSchemeInstance, Treachery, Attachment, Minion, SideScheme, Resource,
} from '@shared/types/card';
import type { LogEntry, LogType } from '../types/log';
import type { GamePhaseType } from '@shared/types/phases';
import type { ActivePrompt, PlayerGameView, PublicPlayerState, PromptResponse } from '../../../backend/types/game';

// Module-level timer — holds the boost card visible on the frontend for a
// minimum duration regardless of when the server clears it.
let _boostCardTimer: ReturnType<typeof setTimeout> | null = null;

export const useGameStore = defineStore('game', {
  state: () => ({
    // ── Identity ──
    myUserId: '' as string,

    // ── Multiplayer turn tracking ──
    activePlayerId: '' as string,
    villainPhaseTargetId: null as string | null,
    otherPlayers: [] as PublicPlayerState[],

    // ── Phase ──
    currentPhase: 'PLAYER_TURN' as GamePhaseType,

    // ── End-of-turn hand management ──
    endOfTurnPhase: null as null | 'discard' | 'mulligan',
    endOfTurnSelectedIds: [] as number[],   // local UI selection only

    // ── Game outcome ──
    gameOver: null as null | 'win' | 'lose',

    // ── Villain side ──
    accelerationTokens: 0,
    villainCard: null as VillainIdentityCardInstance | null,
    mainScheme: null as MainSchemeInstance | null,
    villainPhaseChain: [] as number[],
    villainDeckIds: [] as number[],
    villainDiscardIds: [] as number[],
    activeSideSchemes: [] as SideScheme[],
    engagedMinions: [] as Minion[],

    // ── Encounter zone ──
    encounterPileIds: [] as number[],
    revealedEncounterCard: null as (Treachery | Attachment | Minion | SideScheme) | null,

    // ── Player side ──
    playerIdentity: null as IdentityCardInstance | null,
    idCardHasFlippedThisTurn: false,
    abilityUseCounts: {} as Record<string, number>,
    abilityResetOn: {} as Record<string, string>,
    hand: [] as (Ally | Event | Upgrade | Support)[],
    deckIds: [] as number[],
    playerDiscardIds: [] as number[],
    tableauCards: [] as (Ally | Upgrade | Support)[],

    // ── Static assets ──
    playerCardBackImg: "/cards/misc/player-card-back.png",
    villainCardBackImg: "/cards/misc/villain-card-back.png",

    // ── Card registry (storageId → imgPath, populated from /api/cards) ──
    playerCardRegistry: {} as Record<number, string>,
    villainCardRegistry: {} as Record<number, { imgPath: string; name: string }>,

    // ── Active prompt (interrupt / defense / choice window) ──
    activePrompt: null as ActivePrompt | null,

    // ── Targeting (local UI state) ──
    targeting: {
        isActive: false,
        action: null as 'player-attack' | 'player-thwart' | 'engine' | null,
        validTargetIds: [] as number[],
    },

    // ── Payment ──
    activeCardId: null as number | null,
    paymentBufferIds: [] as number[],
    generatedResources: [] as Resource[],
    pendingCostReduction: 0,

    // ── Attachment removal ──
    pendingRemoval: null as { attachmentInstanceId: number; hostId: number; cost: number; resourceType?: string; name: string } | null,

    // ── Pending hand discard (e.g. Legal Practice) ──
    pendingHandDiscard: null as { maxCount: number; title: string; hint: string; resourceFilter?: string[] } | null,

    // ── Pending yes/no prompt (e.g. obligation flip offer) ──
    pendingYesNo: null as { question: string } | null,

    // ── Resume offer (shown on landing page when a saved game is found) ──
    resumeOffer: null as {
        roomCode: string;
        roundNumber: number;
        villainName: string;
        heroName: string;
        playerNames: string[];
    } | null,

    // ── Boost card ──
    boostCard: null as { storageId: number; boostIcons: number; imgPath: string; name: string } | null,

    // ── Log ──
    roundNumber: 1,
    logIdCounter: 0,
    gameLog: [] as LogEntry[],
  }),

  // ── Getters ────────────────────────────────────────────────────────────────
  getters: {
    hero(state): IdentityCardInstance {
        if (!state.playerIdentity) {
            throw new Error("Attempted to access Player Identity before it was initialized.");
        }
        return state.playerIdentity;
    },

    currentHandSizeLimit(state): number {
        if (!state.playerIdentity) return 6;
        return state.playerIdentity.identityStatus === 'alter-ego'
            ? state.playerIdentity.handsizeAe
            : state.playerIdentity.handSizeHero;
    },

    effectiveThw(state): number {
        if (!state.playerIdentity) return 0;
        const base = state.playerIdentity.thw ?? 0;
        const mods = state.tableauCards.reduce((sum, c) => sum + ((c as any).thwMod ?? 0), 0);
        const temp = (state.playerIdentity as any).tempThwMod ?? 0;
        return base + mods + temp;
    },

    effectiveAtk(state): number {
        if (!state.playerIdentity) return 0;
        const base = state.playerIdentity.atk ?? 0;
        const mods = state.tableauCards.reduce((sum, c) => sum + ((c as any).atkMod ?? 0), 0);
        const temp = (state.playerIdentity as any).tempAtkMod ?? 0;
        return base + mods + temp;
    },

    effectiveDef(state): number {
        if (!state.playerIdentity) return 0;
        const base = state.playerIdentity.def ?? 0;
        const mods = state.tableauCards.reduce((sum, c) => sum + ((c as any).defMod ?? 0), 0);
        return base + mods;
    },

    endOfTurnDiscardCount(state): number {
        if (!state.playerIdentity) return 0;
        const limit = state.playerIdentity.identityStatus === 'alter-ego'
            ? state.playerIdentity.handsizeAe
            : state.playerIdentity.handSizeHero;
        return Math.max(0, state.hand.length - limit);
    },

    activeCard(state): any {
        if (state.activeCardId === -1 && state.pendingRemoval)
            return { cost: state.pendingRemoval.cost, name: state.pendingRemoval.name, instanceId: -1 };
        return state.hand.find(c => c.instanceId === state.activeCardId);
    },

    committedResources(state): Record<string, number> {
        const counts: Record<string, number> = { physical: 0, mental: 0, energy: 0, wild: 0 };

        state.paymentBufferIds.forEach(id => {
            const card = state.hand.find(c => c.instanceId === id);
            card?.resources?.forEach((r: string) => { counts[r]!++; });
        });

        state.generatedResources.forEach((r: string) => { counts[r]!++; });

        return counts;
    },

    isCostMet(): boolean {
        if (!this.activeCard) return false;
        if (this.pendingRemoval?.resourceType) {
            const typed = this.committedResources[this.pendingRemoval.resourceType] ?? 0;
            const wild = this.committedResources['wild'] ?? 0;
            return (typed + wild) >= this.pendingRemoval.cost;
        }
        const totalSpent = Object.values(this.committedResources).reduce((a, b) => a + b, 0);
        const effectiveCost = Math.max(0, (this.activeCard.cost || 0) - this.pendingCostReduction);
        return totalSpent >= effectiveCost;
    },

    canAnyoneDefend(): boolean {
        const heroCanDefend = !this.hero.exhausted;
        const alliesCanDefend = this.tableauCards.some(c => c.type === 'ally' && !c.exhausted);
        return heroCanDefend || alliesCanDefend;
    },

    hasGuardMinion(): boolean {
        if (this.engagedMinions.some(m => m.guard)) return true;
        return this.otherPlayers.some(p => p.engagedMinions.some(m => m.guard));
    },

    hasCrisisScheme(): boolean {
        return this.activeSideSchemes.some(ss => ss.crisis);
    },

    isMyTurn(): boolean {
        return this.activePlayerId === this.myUserId;
    },

    isVillainTargetingMe(): boolean {
        return this.villainPhaseTargetId === this.myUserId;
    },

    tableauDefBonus(): number {
        return this.tableauCards.reduce((sum: number, c: any) => sum + (c.defMod ?? 0), 0);
    },

    isHandCardPlayable: (state) => (card: any): boolean => {
        if (card.type !== 'event') {
            if (state.currentPhase !== 'PLAYER_TURN') return false;
            if (card.uniqueInPlay && state.tableauCards.some((c: any) => c.storageId === card.storageId)) return false;
            if (card.attachmentLocation === 'minion') return state.engagedMinions.length > 0;
            if (card.attachmentLocation === 'enemy') return state.engagedMinions.length > 0 || !!state.villainCard;
            return true;
        }

        if (!card?.logic) return false;

        const form = card.logic.formRequired;
        const identityStatus = state.playerIdentity?.identityStatus;
        if (form && form !== 'any' && form !== identityStatus) return false;

        if (card.logic.type === 'action') return state.currentPhase === 'PLAYER_TURN';

        return false;
    },
  },

  // ── Actions ────────────────────────────────────────────────────────────────
  actions: {
    // ── Resume offer ─────────────────────────────────────────────────────────

    acceptResume() {
        socket.emit('game:resumeAccept');
        this.resumeOffer = null;
    },

    declineResume() {
        socket.emit('game:resumeDecline');
        this.resumeOffer = null;
    },

    // ── Apply server state snapshot ──────────────────────────────────────────

    applyServerState(view: PlayerGameView) {
        this.myUserId             = view.myUserId;
        this.activePlayerId       = view.activePlayerId;
        this.villainPhaseTargetId = view.villainPhaseTargetId;
        this.otherPlayers         = view.otherPlayers;
        this.currentPhase         = view.currentPhase;
        this.roundNumber          = view.roundNumber;
        this.gameOver             = view.gameOver;

        // Board
        this.villainCard          = view.board.villain;
        this.mainScheme           = view.board.mainScheme;
        this.activeSideSchemes    = view.board.activeSideSchemes;
        this.villainDeckIds       = view.board.villainDeckIds ?? [];
        this.villainDiscardIds    = view.board.villainDiscardIds;
        this.accelerationTokens   = view.board.accelerationTokens;

        // Only update boostCard from the server when it is being set (non-null).
        // Clearing is handled by a local timer so the card stays visible for the
        // full display window even if a subsequent state update arrives early.
        if (view.board.boostCard) {
            this.boostCard = view.board.boostCard;
            if (_boostCardTimer) clearTimeout(_boostCardTimer);
            _boostCardTimer = setTimeout(() => {
                this.boostCard = null;
                _boostCardTimer = null;
            }, 2500);
        }

        // My state
        this.playerIdentity          = view.myState.identity;
        this.idCardHasFlippedThisTurn = view.myState.idCardHasFlippedThisTurn;
        this.hand                    = view.myState.hand;
        this.deckIds                 = view.myState.deckIds;
        this.playerDiscardIds        = view.myState.playerDiscardIds;
        this.tableauCards            = view.myState.tableau;
        this.engagedMinions          = view.myState.engagedMinions;
        this.encounterPileIds        = view.myState.encounterPileIds;
        this.revealedEncounterCard   = view.myState.revealedEncounterCard;
        this.abilityUseCounts        = view.myState.abilityUseCounts;
        this.abilityResetOn          = view.myState.abilityResetOn;

        // Payment
        this.activeCardId         = view.activeCardId;
        this.paymentBufferIds     = view.paymentBufferIds;
        this.generatedResources   = view.generatedResources;
        this.pendingCostReduction = view.pendingCostReduction;
        this.pendingRemoval       = view.pendingRemoval;

        // Villain phase chain (for color theming)
        this.villainPhaseChain    = view.villainPhaseChain;

        // EOT + hand discard
        this.endOfTurnPhase       = view.endOfTurnPhase;
        this.pendingHandDiscard   = view.pendingHandDiscard;

        // Yes/no prompt
        this.pendingYesNo         = view.pendingYesNo;

        // Prompt
        this.activePrompt         = view.activePrompt;

        // Log
        this.gameLog              = view.gameLog;
    },

    // ── Identity actions ─────────────────────────────────────────────────────

    flipIdentity() {
        socket.emit('action:flipIdentity');
    },

    healIdentity() {
        socket.emit('action:healIdentity');
    },

    triggerIdentityCardAbility() {
        socket.emit('action:useIdentityAbility');
    },

    // ── Targeting ────────────────────────────────────────────────────────────

    startPlayerTargeting(action: 'player-attack' | 'player-thwart') {
        const validTargetIds: number[] = [];
        if (action === 'player-attack') {
            if (this.villainCard && !this.hasGuardMinion) validTargetIds.push(this.villainCard.instanceId);
            this.engagedMinions.forEach(m => validTargetIds.push(m.instanceId));
            // Include minions engaged with teammates
            this.otherPlayers.forEach(p => p.engagedMinions.forEach(m => validTargetIds.push(m.instanceId)));
        } else {
            if (this.mainScheme) validTargetIds.push(this.mainScheme.instanceId);
            this.activeSideSchemes.forEach(s => validTargetIds.push(s.instanceId));
        }
        this.targeting = { isActive: true, action, validTargetIds };
    },

    selectTarget(instanceId: number) {
        const { action } = this.targeting;
        this.targeting = { isActive: false, action: null, validTargetIds: [] };

        if (action === 'player-attack') {
            const targetType = this.villainCard?.instanceId === instanceId ? 'villain' : 'minion';
            socket.emit('action:attackWithIdentity', { targetId: instanceId, targetType });
        } else if (action === 'player-thwart') {
            socket.emit('action:thwartWithIdentity', { targetId: instanceId });
        } else {
            // Engine-initiated targeting
            socket.emit('action:selectTarget', { instanceId });
        }
    },

    cancelTargeting() {
        this.targeting = { isActive: false, action: null, validTargetIds: [] };
    },

    // ── Card play / payment ───────────────────────────────────────────────────

    startPayment(instanceId: number) {
        socket.emit('action:playCard', { instanceId });
    },

    addResourceToPayment(instanceId: number) {
        socket.emit('action:addResourceToPayment', { instanceId });
    },

    resetPayment() {
        socket.emit('action:abortPlay');
    },

    // ── Attachment removal ────────────────────────────────────────────────────

    startAttachmentRemoval(card: any, hostId: number) {
        socket.emit('action:removeAttachment', { attachmentInstanceId: card.instanceId, hostId });
    },

    // ── Ally actions ─────────────────────────────────────────────────────────

    thwartWithAlly(allyInstanceId: number) {
        socket.emit('action:useAllyAbility', { allyInstanceId, abilityType: 'thwart' });
    },

    attackWithAlly(allyInstanceId: number) {
        socket.emit('action:useAllyAbility', { allyInstanceId, abilityType: 'attack' });
    },

    useAllyAbility(data: { allyInstanceId: number; abilityType: 'attack' | 'thwart'; targetId?: number; targetType?: 'villain' | 'minion' | 'scheme' }) {
        socket.emit('action:useAllyAbility', data);
    },

    // ── Tableau card abilities ────────────────────────────────────────────────

    activateTableauCard(instanceId: number) {
        socket.emit('action:activateTableauCard', { instanceId });
    },

    // Keep legacy names so existing component calls still work
    useResourceAbility(instanceId: number) {
        socket.emit('action:activateTableauCard', { instanceId });
    },

    activateCardAbility(instanceId: number) {
        socket.emit('action:activateTableauCard', { instanceId });
    },

    playFromQuiver(cardInstanceId: number) {
        socket.emit('action:playFromQuiver', { cardInstanceId });
    },

    // ── Turn flow ────────────────────────────────────────────────────────────

    advanceGame() {
        socket.emit('action:endTurn');
    },

    drawCardFromDeck() {
        socket.emit('action:drawCard');
    },

    // ── End-of-turn selection (local UI only) ─────────────────────────────────

    toggleEndOfTurnCard(instanceId: number) {
        const idx = this.endOfTurnSelectedIds.indexOf(instanceId);
        if (idx >= 0) {
            this.endOfTurnSelectedIds.splice(idx, 1);
        } else {
            this.endOfTurnSelectedIds.push(instanceId);
        }
    },

    confirmEndOfTurnDiscard() {
        socket.emit('action:confirmDiscardSelection', { instanceIds: this.endOfTurnSelectedIds });
        this.endOfTurnSelectedIds = [];
    },

    confirmMulligan() {
        socket.emit('action:confirmDiscardSelection', { instanceIds: this.endOfTurnSelectedIds });
        this.endOfTurnSelectedIds = [];
    },

    // ── Encounter resolution ──────────────────────────────────────────────────

    resolveCurrentEncounterCard() {
        socket.emit('action:resolveEncounterCard');
    },

    // ── Prompts ───────────────────────────────────────────────────────────────

    passInterrupt() {
        this.respondToPrompt({ type: 'pass' });
    },

    selectInterruptCard(option: any) {
        this.respondToPrompt({ type: 'play_card', cardInstanceId: option.id });
    },

    respondToPrompt(response: PromptResponse) {
        if (!this.activePrompt) return;
        socket.emit('action:respondToPrompt', { promptId: this.activePrompt.id, response });
    },

    // ── Pending hand discard (e.g. Legal Practice) ───────────────────────────

    confirmHandDiscard(instanceIds: number[]) {
        socket.emit('action:confirmDiscardSelection', { instanceIds });
    },

    cancelHandDiscard() {
        socket.emit('action:confirmDiscardSelection', { instanceIds: [] });
    },

    respondYesNo(accepted: boolean) {
        socket.emit('action:yesNoResponse', { accepted });
    },

    // ── Card registry ─────────────────────────────────────────────────────────

    async loadCardRegistry() {
        if (Object.keys(this.playerCardRegistry).length > 0) return; // already loaded
        try {
            const [playerCards, villainCards]: [any[], any[]] = await Promise.all([
                fetch('http://localhost:3000/api/cards').then(r => r.json()),
                fetch('http://localhost:3000/api/villain-cards').then(r => r.json()),
            ]);
            const reg: Record<number, string> = {};
            for (const card of playerCards) reg[card.storageId] = card.imgPath;
            this.playerCardRegistry = reg;
            const vReg: Record<number, { imgPath: string; name: string }> = {};
            for (const card of villainCards) vReg[card.storageId] = { imgPath: card.imgPath, name: card.name };
            this.villainCardRegistry = vReg;
        } catch { /* non-fatal — images fall back to placeholder */ }
    },

    // ── Log (local append for optimistic display) ─────────────────────────────

    addLog(message: string, type: LogType = 'system') {
        this.gameLog.push({ id: ++this.logIdCounter, round: this.roundNumber, type, message });
    },
  },
});
