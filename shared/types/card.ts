import { type GamePhaseType } from "./phases";

export type IdentityStatus = "hero" | "alter-ego" | "dead";

export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource";

export type VillainCardType = "minion" | "treachery" | "side-scheme" | "attachment" | "obligation" | "environment";

export type Aspect = "neutral" | "hero" | "aggression" | "justice" | "protection" | "leadership";

export type Resource = "physical" | "mental" | "energy" | "wild" | "any";

export type AttachmentLocation = "tableau" | "ally" | "minion" | "villain" | "enemy";

export type CardActionKeywords = "action" | "response" | "interrupt" | "resource";

export type TimingWindow = GamePhaseType | "any" | "VILLAIN_ATTACK" | "VILLAIN_ATTACK_CONCLUDED" | "VILLAIN_TAKES_DAMAGE" | "ENEMY_ATTACK" | "afterPlay" | "takeIdentityDamage" | "attachedDefeated" | "attachedAttacks" | "paymentWindow" | "treacheryRevealed" | "minionEntered" | "roundEnd" | "allyDefeated" | "MAIN_SCHEME_THREAT" | "BASIC_ATTACK" | "ALLY_ATTACKS" | "FLIP_TO_HERO" | "FLIP_TO_AE" | "HERO_DEFENDS" | "ALLY_THWARTS" | "MINION_DEFEATED" | "MINION_ENTERED_PLAY" | "MINION_ATTACK" | "HERO_TOUGH_DISCARDED";

// ======================== EFFECT DSL ========================

export type EffectTarget =
  | 'identity'              // player hero
  | 'villain'               // main villain
  | 'attachedEnemy'         // the entity this card is attached to (context.attacker)
  | 'attacker'              // the attacking entity in event context
  | 'self'                  // the card that owns the logic (context.sourceCard)
  | 'chooseEnemy'           // player selects any enemy (guard minion blocks villain)
  | 'chooseEnemyIgnoreGuard' // player selects any enemy, ignoring guard (non-attack damage)
  | 'chooseMinion'          // player selects an engaged minion only
  | 'chooseScheme'          // player selects a scheme
  | 'payloadTarget'         // the entity referenced by context.targetId (e.g. attack target)
  | 'lastTarget'            // the last target resolved in this effect chain (context.lastResolvedTargetId)
  | 'chooseFriendly';      // player selects the hero or any ally

export type EffectCondition =
  | { type: 'identityStatus'; value: 'hero' | 'alter-ego' }
  | { type: 'targetHpFull'; target: EffectTarget }
  | { type: 'targetHasTough'; target: EffectTarget }
  | { type: 'damageWasDealt' }
  | { type: 'damageCanceled' }
  | { type: 'noDamageDealt' }
  | { type: 'wasDefended' }
  | { type: 'heroDefended' }
  | { type: 'selfIsAttacker' }
  | { type: 'targetWasDefeated' }
  | { type: 'targetIsMinion' }
  | { type: 'activeCardIsAspect'; aspect: Aspect }
  | { type: 'paidWithResource'; resource: Resource }
  | { type: 'paidWithResources'; resources: Resource[] }
  | { type: 'sideSchemeInPlay'; name: string }
  | { type: 'targetIsConfused'; target: EffectTarget }
  | { type: 'payloadTargetAlive' }
  | { type: 'noActiveSideSchemes' }
  | { type: 'selfHasCounters' }
  | { type: 'taggedMinionInPlay'; tag: string }
  | { type: 'minionAttacked' }
  | { type: 'identityNotExhausted' }
  | { type: 'canAffordResources'; resources: Resource[] }
  | { type: 'heroHasTough' }
  | { type: 'attachedToAttacker' };

export type EffectDef =
  | { op: 'dealDamage';       target: EffectTarget; amount: number }
  | { op: 'heal';             target: EffectTarget; amount: number }
  | { op: 'drawCards';        amount: number }
  | { op: 'stun';             target: EffectTarget }
  | { op: 'giveTough';        target: EffectTarget }
  | { op: 'removeThreat';     target: EffectTarget; amount: number }
  | { op: 'generateResource'; resourceType: Resource }
  | { op: 'villainAttack';    stunOnHit?: boolean }
  | { op: 'villainScheme' }
  | { op: 'allEnemiesAttack' }
  | { op: 'preventAttack' }
  | { op: 'cancelDamage' }
  | { op: 'reduceDamage';     amount: number }
  | { op: 'cancelEffect' }
  | { op: 'discardSelf' }
  | { op: 'discardTopDeck';   amount: number; addToHandIfHasResource?: Resource }
  | { op: 'decrementCounter'; discardIfEmpty?: boolean }
  | { op: 'exhaust' }
  | { op: 'surge' }
  | { op: 'confuse'; target: EffectTarget }
  | { op: 'chooseOne'; options: { label: string; effect: EffectDef; condition?: EffectCondition }[] }
  | { op: 'dealDamageBySideSchemeThreat'; schemeName: string; target: EffectTarget }
  | { op: 'discardTableauCard'; types: string[]; surgeIfNone?: boolean }
  | { op: 'addThreat'; amount: number }
  | { op: 'redirectDamage';   discardAt?: number }
  | { op: 'reduceCostNextPlay' }
  | { op: 'clearStatus'; target: EffectTarget }
  | { op: 'readyIdentity' }
  | { op: 'shuffleSelfIntoDeck' }
  | { op: 'preventThreat';       amount: number }
  | { op: 'dealDamageToAll';    amount: number; includeAllCharacters?: boolean }
  | { op: 'dynamicDamage';      target: EffectTarget; formula: string; max: number }
  | { op: 'returnAllyToHand' }
  | { op: 'flipForm' }
  | { op: 'drawToHandSize' }
  | { op: 'selfDamage';         amount: number }
  | { op: 'discardHandForThreat'; max: number }
  | { op: 'addDefBonus';          amount: number }
  | { op: 'if';       condition: EffectCondition; then: EffectDef | EffectDef[]; else?: EffectDef | EffectDef[] }
  | { op: 'sequence'; effects: EffectDef[] }
  | { op: 'fetchAndRevealVillainCard'; storageId: number }
  | { op: 'shuffleVillainDeck' }
  | { op: 'exhaustIdentity' }
  | { op: 'addThreatToEachSideScheme'; amount: number }
  | { op: 'revealSideSchemeFromDeck' }
  | { op: 'revealTopEncounterCard' }
  | { op: 'dealDamageOverkill';   target: EffectTarget; amount: number }
  | { op: 'discardTopDeckBranch'; effects: Partial<Record<Resource, EffectDef[]>> }
  | { op: 'readyAlly' }
  | { op: 'modifyAllyStat'; target: EffectTarget; stat: 'atk' | 'thw'; amount: number }
  | { op: 'boostAllCharacters'; stat: 'atk' | 'thw' | 'both'; amount: number }
  | { op: 'putAllyFromDiscardIntoPlay' }
  | { op: 'redirectThreatAsDamage' }
  | { op: 'addBoostCard' }
  | { op: 'putBoostCardIntoPlay' }
  | { op: 'discardRandomFromHand' }
  | { op: 'discardUntilMinionIntoPlay' }
  | { op: 'addVillainHp'; amount: number }
  | { op: 'exhaustAllCharacters' }
  | { op: 'payResources'; resources: Resource[] }
  | { op: 'exhaustAllAllies' }
  | { op: 'allTaggedMinionsAttack'; tag: string }
  | { op: 'discardUntilTaggedMinionIntoPlay'; tag: string }
  | { op: 'searchForTaggedMinionIntoPlay'; tag: string }
  | { op: 'revealNemesisSet' }
  | { op: 'selfMinionAttack' }
  | { op: 'storeRandomHandCardOnScheme' }
  | { op: 'returnHeldCardsToHand' }
  | { op: 'discardRandomAndThreatPerResourceType' }
  | { op: 'taggedMinionAttacks'; tag: string }
  | { op: 'healTaggedMinionFully'; tag: string }
  | { op: 'removeFromGame' }
  | { op: 'addAccelerationToken'; amount: number }
  | { op: 'searchAndAddToHand'; storageId: number; cardName?: string }
  | { op: 'readyUpgradeByStorageId'; storageId: number; cardName?: string }
  | { op: 'exhaustUpgradeByStorageId'; storageId: number; cardName?: string }
  | { op: 'confuseAndDamage'; normalAmount: number; alreadyConfusedAmount: number }
  | { op: 'removeThreatIgnoreCrisis'; amount: number }
  | { op: 'dealDamagePiercing'; target: EffectTarget; amount: number }
  | { op: 'payAnyResource' }
  | { op: 'attachArrowFromTopDeck' }
  | { op: 'discardTableauCardByStorageId'; storageId: number; cardName?: string }
  | { op: 'searchAndAttachAllyToScheme'; storageId: number; cardName?: string }
  | { op: 'makeAttackPiercing' }
  | { op: 'dealDamageToVillainAndEngaged'; amount: number }
  | { op: 'stunAndDamage'; normalAmount: number; alreadyStunnedAmount: number }
  | { op: 'addPursuitCounters'; amount: number }
  | { op: 'villainSchemesIfPursuitCounters' }
  | { op: 'gainSurgeIfPursuitCounters' }
  | { op: 'villainAttacksIfPursuitCounters' }
  | { op: 'activateNemesisMinionsOrAddCounters' }
  | { op: 'discardUpgradeOrSupportIfPursuitCounters' }
  | { op: 'shuffleTaggedCardFromDiscardIntoDeck'; tag: string }
  | { op: 'discardTopDeckUntilTag'; tag: string }
  | { op: 'discardToughFromHero' }
  | { op: 'addBonusDamageToCurrentAttack'; amount: number }
  | { op: 'makeCurrentAttackOverkill' }
  | { op: 'makeCurrentAttackPiercing' }
  | { op: 'discardAllFriendlyTough'; surgePerMissing?: boolean }
  | { op: 'discardAllFriendlyToughAndAddThreat'; threatPerCard: number }
  | { op: 'revealBoostCardAsEncounterCard' };

// ======================== CARD INTERFACES ========================

export interface CardBase {
    name: string;
    side: "player" | "villain";
    imgPath: string;
    tags: string[];
    flavorText: string;
}

export interface IdentityCard extends CardBase {
    heroImgPath: string;
    hitPoints: number;
    healing: number;
    thw: number;
    atk: number;
    def: number;
    handsizeAe: number;
    handSizeHero: number;
    heroTags: string[];
    aeLogic: CardLogic;
    heroLogic: CardLogic;
    aeAbilityExhausts: boolean;
    heroAbilityExhausts: boolean;
    storageId?: number;
    maxToughCounters?: number;
    setupEffects?: EffectDef[];
}

export interface IdentityCardInstance extends IdentityCard {
    instanceId: number;
    hitPointsRemaining: number;
    exhausted: boolean;
    identityStatus: IdentityStatus;
    stunned: boolean;
    confused: boolean;
    tough: boolean;
    toughCounters: number;
}

export interface PlayerCard extends CardBase {
    side: "player";
    type: PlayerCardType;
    cost: number;
    aspect: Aspect;
    imgPath: string;
    resources: Resource[];
    logic?: CardLogic;
    storageId?: number,
    thw?: number;
    thwPain?: number;
    atk?: number;
    atkPain?: number;
    health?: number;
    attachmentLocation?: AttachmentLocation;
    abilityExhausts?: boolean;
    counters?: number;
    maxCopies?: number;
    uniqueInPlay?: boolean;
    defMod?: number;
    atkMod?: number;
    thwMod?: number;
    rangedForArrowEvents?: boolean;
    dynamicThwBonus?: string;
    logics?: CardLogic[];
    allyLimitBonus?: number;
    returnPaymentOnSuccess?: boolean;
    ignoresGuard?: boolean;
    ignoresCrisis?: boolean;
}

export interface PlayerCardInstance extends PlayerCard {
    instanceId?: number;
}

export interface Ally extends PlayerCardInstance {
    exhausted: boolean;
    thw: number;
    thwPain: number;
    atk: number;
    atkPain: number;
    hitPointsRemaining: number;
    stunned: boolean;
    confused: boolean;
    tough: boolean;
}

export interface Event extends PlayerCardInstance {

}

export interface Upgrade extends PlayerCardInstance {
    exhausted: boolean;
    counters: number;
    attachmentLocation: AttachmentLocation;
}

export interface Support extends PlayerCardInstance {
    exhausted: boolean;
}

export interface VillainIdentityCard extends CardBase {
    phase: number;
    hitPointsPerPlayer: number;
    sch: number;
    atk: number;
    logic?: CardLogic;
    storageId?: number;
    nextPhaseId?: number;
    whenFlipped?: EffectDef[];
    toughOnEntry?: boolean;
}

export interface VillainIdentityCardInstance extends VillainIdentityCard {
    instanceId: number;
    attachments: (Upgrade | Attachment)[];
    hitPointsRemaining?: number;
    stunned?: boolean;
    confused?: boolean;
    tough?: boolean;
    type: "villain";
}

export interface VillainCard extends CardBase {
    side: "villain";
    type: VillainCardType;
    boostIcons: number;
    storageId?: number;
    startingThreat?: number;
    startingThreatIsPerPlayer?: boolean;
    hitPoints?: number;
    sch?: number;
    atk?: number;
    schMod?: number;
    atkMod?: number;
    logic?: CardLogic;
    guard?: boolean;
    toughOnEntry?: boolean;
    overkill?: boolean;
    removal?: { cost: number; resourceType?: Resource; formRequired?: 'hero' | 'alter-ego' };
    removalCost?: Resource[];
    retaliate?: number;
    boostEffect?: EffectDef[];
    whenRevealedThreat?: number;
    whenRevealedThreatIsPerPlayer?: boolean;
    crisis?: boolean;
    hazard?: boolean;
    acceleration?: boolean;
    surgeKeyword?: number;
    whenRevealedEffects?: EffectDef[];
    whenDefeatedEffects?: EffectDef[];
    boostResponseEffect?: EffectDef[];
    dynamicAtk?: 'hitPointsRemaining';
    attachmentTarget?: 'highestHpMinion' | 'highestAtkEnemy';
    stalwart?: boolean;
    amplify?: boolean;
    logics?: CardLogic[];
    hpMod?: number;
    piercing?: boolean;
    attachmentTag?: string;
}

export interface VillainCardInstance extends VillainCard {
    instanceId: number;
    hitPointsRemaining?: number;
}

export interface Minion extends VillainCardInstance {
    hitPointsRemaining: number;
    hitPoints: number;
    attachments: (Upgrade | Attachment)[];
    sch: number;
    atk: number;
    dynamicAtk?: 'hitPointsRemaining';
    stunned: boolean;
    confused: boolean;
    tough: boolean;
    guard: boolean;
}

export interface Treachery extends VillainCardInstance {

}

export interface Obligation extends VillainCardInstance {

}

export interface Attachment extends VillainCardInstance {
    atkMod?: number;
    schMod?: number;
    thwMod?: number;
    logic?: CardLogic;
    damageAccumulated?: number;
    overkill?: boolean;
    removal?: { cost: number; resourceType?: Resource; formRequired?: 'hero' | 'alter-ego' };
}

export interface SideScheme extends VillainCardInstance {
    threatRemaining: number;
    type: "side-scheme";
    crisis: boolean;
    hazard: boolean;
    acceleration: boolean;
    amplify: boolean;
    heldCards?: number[];
}

export interface MainScheme extends CardBase {
    threatThreshold: number;
    threatThresholdIsPerPlayer: boolean;
    startingThreat: number;
    startingThreatIsPerPlayer: boolean;
    threatIncrement: number;
    threatIncrementIsPerPlayer: boolean;
    nextMainSchemeId: number | null;
    whenRevealedEffects?: EffectDef[];
}

export interface MainSchemeInstance extends MainScheme {
    instanceId: number;
    threatRemaining: number;
    type: "main-scheme"
}

export interface CardLogic {
    type: CardActionKeywords;
    forced: boolean;
    formRequired: "hero" | "alter-ego" | "any";
    timing: TimingWindow;
    actionType?: "attack" | "thwart" | "defense";
    limit?: { uses: number; resetOn: 'round' | 'turn' | 'phase' | string };
    resourceCost?: Resource[];
    effects: EffectDef[];
}
