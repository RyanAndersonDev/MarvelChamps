import { type GamePhaseType } from "./phases";

export type IdentityStatus = "hero" | "alter-ego" | "dead";

export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource";

export type VillainCardType = "minion" | "treachery" | "side-scheme" | "attachment";

export type Aspect = "neutral" | "hero" | "aggression" | "justice" | "protection" | "leadership";

export type Resource = "physical" | "mental" | "energy" | "wild";

export type AttachmentLocation = "tableau" | "ally" | "minion" | "villain" | "enemy";

export type CardActionKeywords = "action" | "response" | "interrupt" | "resource";

export type TimingWindow = GamePhaseType | "any" | "VILLAIN_ATTACK" | "VILLAIN_ATTACK_CONCLUDED" | "VILLAIN_TAKES_DAMAGE" | "ENEMY_ATTACK" | "afterPlay" | "takeIdentityDamage" | "attachedDefeated" | "attachedAttacks" | "paymentWindow" | "treacheryRevealed" | "minionEntered";

// ======================== EFFECT DSL ========================

export type EffectTarget =
  | 'identity'       // player hero
  | 'villain'        // main villain
  | 'attachedEnemy'  // the entity this card is attached to (context.attacker)
  | 'attacker'       // the attacking entity in event context
  | 'chooseEnemy'    // player selects any enemy
  | 'chooseScheme';  // player selects a scheme

export type EffectCondition =
  | { type: 'identityStatus'; value: 'hero' | 'alter-ego' }
  | { type: 'targetHpFull'; target: EffectTarget }
  | { type: 'targetHasTough'; target: EffectTarget }
  | { type: 'damageWasDealt' }
  | { type: 'sideSchemeInPlay'; name: string }
  | { type: 'targetIsConfused'; target: EffectTarget };

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
  | { op: 'chooseOne'; options: { label: string; effect: EffectDef }[] }
  | { op: 'dealDamageBySideSchemeThreat'; schemeName: string; target: EffectTarget }
  | { op: 'discardTableauCard'; types: string[]; surgeIfNone?: boolean }
  | { op: 'addThreat'; amount: number }
  | { op: 'redirectDamage';   discardAt?: number }
  | { op: 'if';       condition: EffectCondition; then: EffectDef | EffectDef[]; else?: EffectDef | EffectDef[] }
  | { op: 'sequence'; effects: EffectDef[] };

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
}

export interface IdentityCardInstance extends IdentityCard {
    instanceId: number;
    hitPointsRemaining: number;
    exhausted: boolean;
    identityStatus: IdentityStatus;
    stunned: boolean;
    confused: boolean;
    tough: boolean;
}

export interface PlayerCard extends CardBase {
    side: "player";
    type: PlayerCardType;
    cost: number;
    aspect: Aspect;
    imgPath: string;
    resources: Resource[];
    logic: CardLogic;
    storageId?: number,
    thw?: number;
    thwPain?: number;
    atk?: number;
    atkPain?: number;
    health?: number;
    attachmentLocation?: AttachmentLocation;
    abilityExhausts?: boolean;
    counters?: number;
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
    removal?: { cost: number; resourceType?: Resource };
    whenRevealedThreat?: number;
    whenRevealedThreatIsPerPlayer?: boolean;
    crisis?: boolean;
    hazard?: boolean;
    acceleration?: boolean;
}

export interface VillainCardInstance extends VillainCard {
    instanceId: number;
    hitPointsRemaining?: number;
}

export interface Minion extends VillainCardInstance {
    hitPointsRemaining: number;
    attachments: (Upgrade | Attachment)[];
    sch: number;
    atk: number;
    stunned: boolean;
    confused: boolean;
    tough: boolean;
    guard: boolean;
}

export interface Treachery extends VillainCardInstance {

}

export interface Attachment extends VillainCardInstance {
    atkMod?: number;
    schMod?: number;
    thwMod?: number;
    logic?: CardLogic;
    damageAccumulated?: number;
    overkill?: boolean;
    removal?: { cost: number; resourceType?: Resource };
}

export interface SideScheme extends VillainCardInstance {
    threatRemaining: number;
    type: "side-scheme";
    crisis: boolean;
    hazard: boolean;
    acceleration: boolean;
}

export interface MainScheme extends CardBase {
    threatThreshold: number;
    threatThresholdIsPerPlayer: boolean;
    startingThreat: number;
    startingThreatIsPerPlayer: boolean;
    threatIncrement: number;
    threatIncrementIsPerPlayer: boolean;
    nextMainSchemeId: number | null;
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
    effects: EffectDef[];
}
