export type IdentityStatus = "hero" | "alter-ego" | "dead";

export type CardStatus = "ready" | "exhausted";

export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource";

export type VillainCardType = "minion" | "treachery" | "side-scheme" | "attachment";

export type Aspect = "neutral" | "hero" | "aggression" | "justice" | "protection" | "leadership";

export type Resource = "physical" | "mental" | "energy" | "wild";

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
}

export interface IdentityCardInstance extends IdentityCard {
    hitPointsRemaining?: number;
    exhausted?: boolean;
    identityStatus?: IdentityStatus;
    status?: CardStatus;
    stunned?: boolean;
    confused?: boolean;
    tough?: boolean;
}

export interface PlayerCard extends CardBase {
    side: "player";
    type: PlayerCardType;
    cost: number;
    aspect: Aspect;
    imgPath: string;
    resources: Resource[];
    storageId?: number,
    thw?: number;
    thwPain?: number;
    atk?: number;
    atkPain?: number;
    health?: number;
    // TODO: Configure: attackDesination?: prop for upgrades (ie spider tracer, webbed up)
}

export interface PlayerCardInstance extends PlayerCard {
    instanceId?: number;
    counters?: number;
}

export interface Ally extends PlayerCardInstance {
    exhausted: boolean;
    health: number;
    thw: number;
    thwPain: number;
    atk: number;
    atkPain: number;
    hpLeft: number;
    stunned: boolean;
    confused: boolean;
    tough: boolean;
}

export interface Event extends PlayerCardInstance {
    
}

export interface Upgrade extends PlayerCardInstance {
    exhausted: boolean;
    counters: number;
}

export interface Support extends PlayerCardInstance {
    exhausted: boolean;
}

export interface VillainIdentityCard extends CardBase {
    phase: number;
    hitPointsPerPlayer: number;
    sch: number;
    atk: number;
}

export interface VillainIdentityCardInstance extends VillainIdentityCard {
    hitPointsRemaining?: number;
    stunned?: boolean;
    confused?: boolean;
    tough?: boolean;
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
    // TODO: How to store discard conditions for attachments?
}

export interface VillainCardInstance extends VillainCard {
    instanceId: number;
}

export interface Minion extends VillainCardInstance {
    healthRemaining: number;
}

export interface Treachery extends VillainCardInstance {

}

export interface Attachment extends VillainCardInstance {

}

export interface SideScheme extends VillainCardInstance {
    threatRemaining: number;
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
    currentThreat: number;
}
