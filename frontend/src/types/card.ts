import { type GamePhaseType } from "./phases"; 

export type IdentityStatus = "hero" | "alter-ego" | "dead";

export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource";

export type VillainCardType = "minion" | "treachery" | "side-scheme" | "attachment";

export type Aspect = "neutral" | "hero" | "aggression" | "justice" | "protection" | "leadership";

export type Resource = "physical" | "mental" | "energy" | "wild";

export type AttachmentLocation = "tableau" | "ally" | "minion" | "villain" | "enemy";

export type CardActionKeywords = "action" | "response" | "interrupt" | "resource";

export type TimingWindow = GamePhaseType | "any" | "VILLAIN_ATTACK" | "VILLAIN_ATTACK_CONCLUDED" | "VILLAIN_TAKES_DAMAGE" | "ENEMY_ATTACK" | "afterPlay" | "takeIdentityDamage" | "attachedDefeated" | "attachedAttacks" | "paymentWindow" | "treacheryRevealed";

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
    whenRevealedEffect?: string;
    whenRevealedThreat?: number;
    crisis?: boolean;
    hazard?: boolean;
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
    logic?: CardLogic;
    damageAccumulated?: number;
    overkill?: boolean;
}

export interface SideScheme extends VillainCardInstance {
    threatRemaining: number;
    type: "side-scheme";
    crisis: boolean;
    hazard: boolean;
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
    effectName: string;
    effectValue?: number;
    targetType?: "enemy" | "minion" | "villain" | "scheme" | "identity" | "none";
}
