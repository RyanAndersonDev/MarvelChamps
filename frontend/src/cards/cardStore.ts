import type { PlayerCardInstance } from "../types/card";

export const cardMap: Map<number, PlayerCardInstance> = new Map<number, PlayerCardInstance>([
    [1, { name: "Black Cat", side: "player", type: "ally", cost: 2, aspect: "hero", imgPath: "/cards/heroes/BlackCat-Ally.png", tags: ["hero for hire"], resources: ["energy"], 
        thw: 1, thwPain: 1, atk: 1, atkPain: 0, health: 2 }],
    [2, { name: "Backflip", side: "player", type: "event", cost: 0, aspect: "hero", imgPath: "/cards/heroes/Backflip-Event.png", tags: ["defense", "skill"], resources: ["physical"] }],
    [3, { name: "Enhanced Spider-Sense", side: "player", type: "event", cost: 1, aspect: "hero", imgPath: "/cards/heroes/EnhancedSpiderSense-Event.png", tags: ["superpower"], resources: ["mental"] }],
    [4, { name: "Swinging Web Kick", side: "player", type: "event", cost: 0, aspect: "hero", imgPath: "/cards/heroes/SwingingWebKick-Event.png", tags: ["aerial", "attack", "superpower"], resources: ["mental"] }],
    [5, { name: "Aunt May", side: "player", type: "support", cost: 1, aspect: "hero", imgPath: "/cards/heroes/AuntMay-Support.png", tags: ["persona"], resources: ["energy"], }],
    [6, { name: "Spider-Tracer", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/SpiderTracer-Upgrade.png", tags: ["item", "tech"], resources: ["energy"] }],
    [7, { name: "Web-Shooter", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/WebShooter-Upgrade.png", tags: ["item", "tech"], resources: ["physical"],
        counters: 3
     }],
    [8, { name: "Webbed Up", side: "player", type: "upgrade", cost: 4, aspect: "hero", imgPath: "/cards/heroes/WebbedUp-Upgrade.png", tags: ["aerial", "attack", "superpower"], resources: ["physical"] }]
])

export function getCardImgPathById(cardId : number) : string {
    let mapEntry = cardMap.get(cardId) as PlayerCardInstance | undefined;

    if (mapEntry != null) {
        return mapEntry.imgPath;
    }

    return "";
}
