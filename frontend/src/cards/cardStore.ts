import type { IdentityCardInstance, PlayerCard, VillainIdentityCard, MainScheme, VillainCard } from "../types/card";

export const idCardMap: Map<number, IdentityCardInstance> = new Map<number, IdentityCardInstance>([
    [1, {name: "Peter Parker/Spiderman", side: "player", imgPath: "/cards/heroes/spider-man/PeterParker-AE.png", heroImgPath: "/cards/heroes/spider-man/PeterParker-Hero.png", flavorText: "",
        hitPoints: 10, healing: 3, thw: 1, atk: 2, def: 3, handsizeAe: 6, handSizeHero: 5, tags: ["genius"], heroTags: ["avenger"]}]
]);

export const cardMap: Map<number, PlayerCard> = new Map<number, PlayerCard>([
    [1, { name: "Black Cat", side: "player", type: "ally", cost: 2, aspect: "hero", imgPath: "/cards/heroes/spider-man/BlackCat-Ally.png", tags: ["hero for hire"], resources: ["energy"], flavorText: "",
        thw: 1, thwPain: 1, atk: 1, atkPain: 0, health: 2, 
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "afterPlay",
            effectName: "blackCatDiscard"
        }
    }],
    [2, { name: "Backflip", side: "player", type: "event", cost: 0, aspect: "hero", imgPath: "/cards/heroes/spider-man/Backflip-Event.png", tags: ["defense", "skill"], resources: ["physical"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "takeIdentityDamage",
            actionType: "defense",
            effectName: "preventDamage",
            effectValue: 100
        }
     }],
    [3, { name: "Enhanced Spider-Sense", side: "player", type: "event", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/EnhancedSpiderSense-Event.png", tags: ["superpower"], resources: ["mental"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "treacheryRevealed",
            effectName: "cancelWhenRevealed"
        }
     }],
    [4, { name: "Swinging Web Kick", side: "player", type: "event", cost: 3, aspect: "hero", imgPath: "/cards/heroes/spider-man/SwingingWebKick-Event.png", tags: ["aerial", "attack", "superpower"], resources: ["mental"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effectName: "dealDamage",
            effectValue: 8,
            targetType: "enemy"
        }
     }],
    [5, { name: "Aunt May", side: "player", type: "support", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/AuntMay-Support.png", tags: ["persona"], resources: ["energy"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            effectName: "healIdentity",
            effectValue: 4
        }
     }],
    [6, { name: "Spider-Tracer", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/SpiderTracer-Upgrade.png", tags: ["item", "tech"], resources: ["energy"], flavorText: "",
        attachmentLocation: "minion",
        logic: {
            type: "interrupt",
            forced: true,
            formRequired: "any",
            timing: "attachedDefeated",
            effectName: "removeThreat",
            effectValue: 3,
            targetType: "scheme"
        }
     }],
    [7, { name: "Web-Shooter", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/WebShooter-Upgrade.png", tags: ["item", "tech"], resources: ["physical"], flavorText: "",
        "attachmentLocation": "tableau",
        logic: {
            type: "resource",
            forced: false,
            formRequired: "hero",
            timing: "paymentWindow",
            effectName: "generateWildResource",
            effectValue: 1
        }
     }],
    [8, { name: "Webbed Up", side: "player", type: "upgrade", cost: 4, aspect: "hero", imgPath: "/cards/heroes/spider-man/WebbedUp-Upgrade.png", tags: ["aerial", "attack", "superpower"], resources: ["physical"], flavorText: "",
        "attachmentLocation": "enemy",
        logic: {
            type: "interrupt",
            forced: true,
            formRequired: "hero",
            timing: "attachedAttacks",
            effectName: "preventAttackThenStun"
        }
     }]
]);

export const villainIdCardMap: Map<number, VillainIdentityCard> = new Map<number, VillainIdentityCard>([
    [1, { name: "Rhino", side: "villain", imgPath: "/cards/villains/rhino/Rhino-Phase1.png", tags: ["brute", "criminal"], phase: 1, hitPointsPerPlayer: 14, sch: 1, atk: 2, 
        flavorText: `"I'm Rhino. I knock things down. That's what I do. That's who I am."` }]
]);

export const villainMainSchemeMap: Map<number, MainScheme> = new Map<number, MainScheme>([
    [1, { name: "The Break-In!", side: "villain", imgPath: "/cards/villains/rhino/TheBreakIn-MainScheme1.png", tags: [], flavorText: "Rhino is trying to smash through the facility wall and steal a shipment of vibranium. You must stop him!",
        threatThreshold: 7, threatThresholdIsPerPlayer: true, startingThreat: 0, startingThreatIsPerPlayer: false, threatIncrement: 1, threatIncrementIsPerPlayer: true, nextMainSchemeId: null }]
]);

export const villainCardMap: Map<number, VillainCard> = new Map<number, VillainCard>([
    [1, { name: "Armored Rhino Suit", side: "villain", imgPath: "/cards/villains/rhino/ArmoredRhinoSuit-Attachment.png", tags: ["armor"], flavorText: "",
        type: "attachment", boostIcons: 0 }],
    [2, { name: "Charge", side: "villain", imgPath: "/cards/villains/rhino/Charge-Attachment.png", tags: [], flavorText: "",
        type: "attachment", boostIcons: 2, atkMod: 3 }],
    [3, { name: "Enhanced Ivory Horn", side: "villain", imgPath: "/cards/villains/rhino/EnhancedIvoryHorn-Attachment.png", tags: ["weapon"], flavorText: "",
        type: "attachment", boostIcons: 2, atkMod: 1 }],
    [4, { name: "Hydra Mercenary", side: "villain", imgPath: "/cards/villains/rhino/HydraMercenary-Minion.png", tags: ["hydra"], flavorText: `"What is Hydra doing here?" - Carol Danvers`,
        type: "minion", boostIcons: 1, sch: 0, atk: 1, hitPoints: 3 }],
    [5, { name: "Sandman", side: "villain", imgPath: "/cards/villains/rhino/Sandman-Minion.png", tags: ["criminal", "elite"], flavorText: `"I just wanna get paid!"`,
        type: "minion", boostIcons: 2, sch: 2, atk: 3, hitPoints: 4 }],
    [6, { name: "Shocker", side: "villain", imgPath: "/cards/villains/rhino/Shocker-Minion.png", tags: ["criminal"], flavorText: `"I bet you're shocked to see me."`,
        type: "minion", boostIcons: 2, sch: 1, atk: 2, hitPoints: 3 }],
    [7, { name: "Hard To Keep Down", side: "villain", imgPath: "/cards/villains/rhino/HardToKeepDown-Treachery.png", tags: [], flavorText: `"You think you can stop me? What a joke" - Rhino`,
        type: "treachery", boostIcons: 0 }],
    [8, { name: `"I'm Tough!"`, side: "villain", imgPath: "/cards/villains/rhino/ImTough!-Treachery.png", tags: [], flavorText: `"Bring it!" - Rhino`,
        type: "treachery", boostIcons: 0 }],
    [9, { name: "Stampede", side: "villain", imgPath: "/cards/villains/rhino/Stampede-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 1 }],
    [10, { name: `Breakin' & Takin'`, side: "villain", imgPath: "/cards/villains/rhino/Breakin'&Takin'-SideScheme.png", tags: [], flavorText: "Rhino is breaking things and taking them.",
        type: "side-scheme", boostIcons: 2, startingThreat: 2, startingThreatIsPerPlayer: false }],
    [11, { name: "Crowd Control", side: "villain", imgPath: "/cards/villains/rhino/CrowdControl-SideScheme.png", tags: [], flavorText: "Panicked civilians crowd the area. It is difficult to confront Rhino without putting them at risk. Get the people to safety!",
        type: "side-scheme", boostIcons: 2, startingThreat: 2, startingThreatIsPerPlayer: true }]
])

export function getCardImgPathById(cardId : number) : string {
    let imgPath = cardMap.get(cardId)?.imgPath;

    if (imgPath != null) {
        return imgPath;
    }

    return "";
};

export function getVillainCardImgPathById(cardId : number) : string {
    let imgPath = villainCardMap.get(cardId)?.imgPath;

    if (imgPath != null) {
        return imgPath;
    }

    return "";
};
