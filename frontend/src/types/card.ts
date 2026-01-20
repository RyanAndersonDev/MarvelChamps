export type IdentityStatus = "hero" | "alter-ego";

export type CardStatus = "ready" | "exhausted";

export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource";

export type VillainCardType = "minion" | "treachery" | "side-scheme" | "attachment";

export type Aspect = "neutral" | "hero" | "aggression" | "justice" | "protection" | "leadership";

export interface CardBase {
    name: string;
    side: "player" | "villain";
    imgPath: string;
}

export interface IdentityCard extends CardBase {
    name: string;
    identityStatus: IdentityStatus;
    status: CardStatus;
    hitPoints: number;
    healing: number;
    atk: number;
    def: number;
    handSizeHero: number;
    handsizeAe: number;
}

export interface PlayerCard extends CardBase {
    name: string;
    side: "player";
    type: PlayerCardType;
    cost: number;
    aspect: Aspect;
    imgPath: string;
}

export interface PlayerCardInstance extends PlayerCard {
    id?: number;
    health?: number;
    counters?: number;
    tags?: string[];
}

export interface Ally extends PlayerCardInstance {
    exhausted: boolean;
    health: number;
}

export interface Event extends PlayerCardInstance {
    tags: string[];
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
