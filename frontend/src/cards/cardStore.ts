import type { IdentityCardInstance, PlayerCardInstance } from "../types/card";

export const idCardMap: Map<number, IdentityCardInstance> = new Map<number, IdentityCardInstance>([
    [1, {name: "Peter Parker/Spiderman", side: "player", imgPath: "/cards/heroes/spider-man/PeterParker-AE.png", heroImgPath: "/cards/heroes/spider-man/PeterParker-Hero.png", 
        hitPoints: 10, healing: 3, thw: 1, atk: 2, def: 3, handsizeAe: 6, handSizeHero: 5, tags: ["genius"], heroTags: ["avenger"]}]
]);

export const cardMap: Map<number, PlayerCardInstance> = new Map<number, PlayerCardInstance>([
    [1, { name: "Black Cat", side: "player", type: "ally", cost: 2, aspect: "hero", imgPath: "/cards/heroes/spider-man/BlackCat-Ally.png", tags: ["hero for hire"], resources: ["energy"], 
        thw: 1, thwPain: 1, atk: 1, atkPain: 0, health: 2 }],
    [2, { name: "Backflip", side: "player", type: "event", cost: 0, aspect: "hero", imgPath: "/cards/heroes/spider-man/Backflip-Event.png", tags: ["defense", "skill"], resources: ["physical"] }],
    [3, { name: "Enhanced Spider-Sense", side: "player", type: "event", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/EnhancedSpiderSense-Event.png", tags: ["superpower"], resources: ["mental"] }],
    [4, { name: "Swinging Web Kick", side: "player", type: "event", cost: 3, aspect: "hero", imgPath: "/cards/heroes/spider-man/SwingingWebKick-Event.png", tags: ["aerial", "attack", "superpower"], resources: ["mental"] }],
    [5, { name: "Aunt May", side: "player", type: "support", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/AuntMay-Support.png", tags: ["persona"], resources: ["energy"], }],
    [6, { name: "Spider-Tracer", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/SpiderTracer-Upgrade.png", tags: ["item", "tech"], resources: ["energy"] }],
    [7, { name: "Web-Shooter", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/WebShooter-Upgrade.png", tags: ["item", "tech"], resources: ["physical"],
        counters: 3
     }],
    [8, { name: "Webbed Up", side: "player", type: "upgrade", cost: 4, aspect: "hero", imgPath: "/cards/heroes/spider-man/WebbedUp-Upgrade.png", tags: ["aerial", "attack", "superpower"], resources: ["physical"] }]
]);

export function getCardImgPathById(cardId : number) : string {
    let imgPath = cardMap.get(cardId)?.imgPath;

    if (imgPath != null) {
        return imgPath;
    }

    return "";
};
