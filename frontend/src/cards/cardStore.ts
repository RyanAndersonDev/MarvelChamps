import type { PlayerCardInstance } from "../types/card";

export const cardMap: Map<number, PlayerCardInstance> = new Map<number, PlayerCardInstance>([
    [1, { name: "Black Cat", side: "player", type: "ally", cost: 2, aspect: "hero", imgPath: "/cards/heroes/BlackCat-Ally.png", health: 2, tags: ["hero for hire"] }],
    [2, { name: "Backflip", side: "player", type: "event", cost: 0, aspect: "hero", imgPath: "/cards/heroes/Backflip-Event.png", tags: ["defense", "skill"] }]
])
