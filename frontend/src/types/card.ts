export type IdentityStatus = "hero" | "alter-ego" | "dead";

export type CardStatus = "ready" | "exhausted";

export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource";

export type VillainCardType = "minion" | "treachery" | "side-scheme" | "attachment";

export type Aspect = "neutral" | "hero" | "aggression" | "justice" | "protection" | "leadership";

export interface CardBase {
    name: string;
    side: "player" | "villain";
    imgPath: string;
    tags: string[];
}

export interface IdentityCard extends CardBase {
    name: string;
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
    name: string;
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

export interface VillainCard extends CardBase {
    side: "villain";
    type: VillainCardType;
    boostIcons: number;
}

export type Card = IdentityCard | PlayerCard | VillainCard;

export type Resource = "physical" | "mental" | "energy" | "wild";
