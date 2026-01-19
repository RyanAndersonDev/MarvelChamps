export type IdentityStatus = "hero" | "alter-ego";

export type CardStatus = "ready" | "exhausted";

export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource";

export type VillainCardType = "minion" | "treachery" | "side-scheme" | "attachment";

export type Aspect = "neutral" | "hero" | "aggression" | "justice" | "protection" | "leadership";

export interface CardBase {
    id: string;
    code: string;
    name: string;
    side: "player" | "villain";
}

export interface IdentityCard extends CardBase {
  id: string;
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
    side: "player";
    type: PlayerCardType;
    cost: number;
    aspect: Aspect;
}

export interface VillainCard extends CardBase {
    side: "villain";
    type: VillainCardType;
    boostIcons: number;
}

export type Card = IdentityCard | PlayerCard | VillainCard;
