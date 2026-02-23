import type { IdentityCard, PlayerCard, VillainIdentityCard, MainScheme, VillainCard } from "../types/card";

export const idCardMap: Map<number, IdentityCard> = new Map<number, IdentityCard>([
    [1, {name: "Peter Parker/Spiderman", side: "player", imgPath: "/cards/heroes/spider-man/PeterParker-AE.png", heroImgPath: "/cards/heroes/spider-man/PeterParker-Hero.png", flavorText: "",
        hitPoints: 10, healing: 3, thw: 1, atk: 2, def: 3, handsizeAe: 6, handSizeHero: 5, tags: ["genius"], heroTags: ["avenger"],
        aeLogic: {
            type: "resource",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            limit: { uses: 1, resetOn: 'round' },
            effects: [{ op: 'generateResource', resourceType: 'mental' }]
        },
        aeAbilityExhausts: false,
        heroLogic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "VILLAIN_ATTACK",
            effects: [{ op: 'drawCards', amount: 1 }]
        },
        heroAbilityExhausts: false
    }]
]);

export const cardMap: Map<number, PlayerCard> = new Map<number, PlayerCard>([
    [1, { name: "Black Cat", side: "player", type: "ally", cost: 2, aspect: "hero", imgPath: "/cards/heroes/spider-man/BlackCat-Ally.png", tags: ["hero for hire"], resources: ["energy"], flavorText: "", abilityExhausts: false, thw: 1, atk: 1, thwPain: 1, atkPain: 0, health: 2,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "afterPlay",
            effects: [{ op: 'discardTopDeck', amount: 2, addToHandIfHasResource: 'mental' }]
        }
    }],
    [2, { name: "Backflip", side: "player", type: "event", cost: 0, aspect: "hero", imgPath: "/cards/heroes/spider-man/Backflip-Event.png", tags: ["defense", "skill"], resources: ["physical"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "takeIdentityDamage",
            actionType: "defense",
            effects: [{ op: 'cancelDamage' }]
        }
    }],
    [3, { name: "Enhanced Spider-Sense", side: "player", type: "event", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/EnhancedSpiderSense-Event.png", tags: ["superpower"], resources: ["mental"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "treacheryRevealed",
            effects: [{ op: 'cancelEffect' }]
        }
    }],
    [4, { name: "Swinging Web Kick", side: "player", type: "event", cost: 3, aspect: "hero", imgPath: "/cards/heroes/spider-man/SwingingWebKick-Event.png", tags: ["aerial", "attack", "superpower"], resources: ["mental"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [{ op: 'dealDamage', target: 'chooseEnemy', amount: 8 }]
        }
    }],
    [5, { name: "Aunt May", side: "player", type: "support", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/AuntMay-Support.png", tags: ["persona"], resources: ["energy"], flavorText: "", abilityExhausts: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            effects: [{ op: 'if', condition: { type: 'targetHpFull', target: 'identity' }, then: [], else: [{ op: 'heal', target: 'identity', amount: 4 }, { op: 'exhaust' }] }]
        }
    }],
    [6, { name: "Spider-Tracer", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/SpiderTracer-Upgrade.png", tags: ["item", "tech"], resources: ["energy"], flavorText: "",
        attachmentLocation: "minion",
        logic: {
            type: "interrupt",
            forced: true,
            formRequired: "any",
            timing: "attachedDefeated",
            effects: [{ op: 'removeThreat', target: 'chooseScheme', amount: 3 }]
        }
    }],
    [7, { name: "Web-Shooter", side: "player", type: "upgrade", cost: 1, aspect: "hero", imgPath: "/cards/heroes/spider-man/WebShooter-Upgrade.png", tags: ["item", "tech"], resources: ["physical"], flavorText: "",
        attachmentLocation: "tableau", abilityExhausts: true, counters: 3,
        logic: {
            type: "resource",
            forced: false,
            formRequired: "hero",
            timing: "paymentWindow",
            effects: [{
                op: 'sequence', effects: [
                    { op: 'decrementCounter', discardIfEmpty: true },
                    { op: 'generateResource', resourceType: 'wild' },
                    { op: 'exhaust' }
                ]
            }]
        }
    }],
    [8, { name: "Webbed Up", side: "player", type: "upgrade", cost: 4, aspect: "hero", imgPath: "/cards/heroes/spider-man/WebbedUp-Upgrade.png", tags: ["aerial", "attack", "superpower"], resources: ["physical"], flavorText: "",
        attachmentLocation: "enemy",
        logic: {
            type: "interrupt",
            forced: true,
            formRequired: "hero",
            timing: "attachedAttacks",
            effects: [{
                op: 'sequence', effects: [
                    { op: 'preventAttack' },
                    { op: 'discardSelf' },
                    { op: 'stun', target: 'attachedEnemy' }
                ]
            }]
        }
    }],

    // ── Neutral allies ──
    [9, { name: "Mockingbird", side: "player", type: "ally", cost: 3, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/Mockingbird-Ally.png",
        tags: ["S.H.I.E.L.D.", "spy"], resources: ["physical"], flavorText: "",
        thw: 1, thwPain: 1, atk: 1, atkPain: 1, health: 3, abilityExhausts: false,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "afterPlay",
            effects: [{ op: 'stun', target: 'chooseEnemy' }]
        }
    }],
    [10, { name: "Nick Fury", side: "player", type: "ally", cost: 4, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/NickFury-Ally.png",
        tags: ["S.H.I.E.L.D.", "spy"], resources: ["mental"], flavorText: "",
        thw: 2, thwPain: 1, atk: 2, atkPain: 1, health: 3, abilityExhausts: false,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "afterPlay",
            effects: [{ op: 'chooseOne', options: [
                { label: "Remove 2 threat from a scheme", effect: { op: 'removeThreat', target: 'chooseScheme', amount: 2 } },
                { label: "Draw 3 cards",                  effect: { op: 'drawCards', amount: 3 } },
                { label: "Deal 4 damage to an enemy",     effect: { op: 'dealDamage', target: 'chooseEnemy', amount: 4 } },
            ]}]
        },
        logics: [{
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "roundEnd",
            effects: [{ op: 'discardSelf' }]
        }]
    }],

    // ── Neutral supports (unique in play) ──
    [11, { name: "Avengers Mansion", side: "player", type: "support", cost: 4, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/AvengersMansion-Support.png",
        tags: ["avenger", "location"], resources: ["mental"], flavorText: `"Did you remember to turn off the stove?" - Janet Van Dyne`,
        abilityExhausts: true, uniqueInPlay: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'drawCards', amount: 1 }, { op: 'exhaust' }]
        }
    }],
    [12, { name: "Helicarrier", side: "player", type: "support", cost: 3, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/Helicarrier-Support.png",
        tags: ["location", "S.H.I.E.L.D."], resources: ["physical"], flavorText: `"A flying aircraft carrier? You're kidding, right?" - Jennifer Walters`,
        abilityExhausts: true, uniqueInPlay: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'reduceCostNextPlay' }, { op: 'exhaust' }]
        }
    }],

    // ── Neutral resource cards (max 1 per deck) ──
    [13, { name: "Strength", side: "player", type: "resource", cost: 0, aspect: "neutral", imgPath: "/cards/player-cards/neutral/Strength-Resource.png", tags: [], resources: ["physical", "physical"], flavorText: "", maxCopies: 1,
        logic: { type: "resource", forced: false, formRequired: "any", timing: "paymentWindow",
            effects: [{ op: 'sequence', effects: [{ op: 'generateResource', resourceType: 'physical' }, { op: 'generateResource', resourceType: 'physical' }] }] } }],
    [14, { name: "Energy", side: "player", type: "resource", cost: 0, aspect: "neutral", imgPath: "/cards/player-cards/neutral/Energy-Resource.png", tags: [], resources: ["energy", "energy"], flavorText: "", maxCopies: 1,
        logic: { type: "resource", forced: false, formRequired: "any", timing: "paymentWindow",
            effects: [{ op: 'sequence', effects: [{ op: 'generateResource', resourceType: 'energy' }, { op: 'generateResource', resourceType: 'energy' }] }] } }],
    [15, { name: "Genius", side: "player", type: "resource", cost: 0, aspect: "neutral", imgPath: "/cards/player-cards/neutral/Genius-Resource.png", tags: [], resources: ["mental", "mental"], flavorText: "", maxCopies: 1,
        logic: { type: "resource", forced: false, formRequired: "any", timing: "paymentWindow",
            effects: [{ op: 'sequence', effects: [{ op: 'generateResource', resourceType: 'mental' }, { op: 'generateResource', resourceType: 'mental' }] }] } }],
]);

export const villainIdCardMap: Map<number, VillainIdentityCard> = new Map<number, VillainIdentityCard>([
    [1, { name: "Rhino", side: "villain", imgPath: "/cards/villains/rhino/Rhino-Phase1.png", tags: ["brute", "criminal"], phase: 1, hitPointsPerPlayer: 14, sch: 1, atk: 2,
        nextPhaseId: 2, flavorText: `"I'm Rhino. I knock things down. That's what I do. That's who I am."` }],
    [2, { name: "Rhino", side: "villain", imgPath: "/cards/villains/rhino/Rhino-Phase2.png", tags: ["brute", "criminal"], phase: 2, hitPointsPerPlayer: 15, sch: 2, atk: 3,
        flavorText: `"You're going to need a bigger wall."` }],
]);

export const villainMainSchemeMap: Map<number, MainScheme> = new Map<number, MainScheme>([
    [1, { name: "The Break-In!", side: "villain", imgPath: "/cards/villains/rhino/TheBreakIn-MainScheme1.png", tags: [], flavorText: "Rhino is trying to smash through the facility wall and steal a shipment of vibranium. You must stop him!",
        threatThreshold: 7, threatThresholdIsPerPlayer: true, startingThreat: 0, startingThreatIsPerPlayer: false, threatIncrement: 1, threatIncrementIsPerPlayer: true, nextMainSchemeId: null }]
]);

export const villainCardMap: Map<number, VillainCard> = new Map<number, VillainCard>([
    [1, { name: "Armored Rhino Suit", side: "villain", imgPath: "/cards/villains/rhino/ArmoredRhinoSuit-Attachment.png", tags: ["armor"], flavorText: "",
        type: "attachment", boostIcons: 0,
        logic: {
            type: "interrupt", forced: true, formRequired: "any", timing: "VILLAIN_TAKES_DAMAGE",
            effects: [{ op: 'redirectDamage', discardAt: 5 }]
        }
    }],
    [2, { name: "Charge", side: "villain", imgPath: "/cards/villains/rhino/Charge-Attachment.png", tags: [], flavorText: "",
        type: "attachment", boostIcons: 2, atkMod: 3, overkill: true,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "VILLAIN_ATTACK_CONCLUDED",
            effects: [{ op: 'discardSelf' }]
        }
    }],
    [3, { name: "Enhanced Ivory Horn", side: "villain", imgPath: "/cards/villains/rhino/EnhancedIvoryHorn-Attachment.png", tags: ["weapon"], flavorText: "",
        type: "attachment", boostIcons: 2, atkMod: 1, removal: { cost: 3, resourceType: 'physical' } }],
    [4, { name: "Hydra Mercenary", side: "villain", imgPath: "/cards/villains/rhino/HydraMercenary-Minion.png", tags: ["hydra"], flavorText: `"What is Hydra doing here?" - Carol Danvers`,
        type: "minion", boostIcons: 1, sch: 0, atk: 1, hitPoints: 3, guard: true }],
    [5, { name: "Sandman", side: "villain", imgPath: "/cards/villains/rhino/Sandman-Minion.png", tags: ["criminal", "elite"], flavorText: `"I just wanna get paid!"`,
        type: "minion", boostIcons: 2, sch: 2, atk: 3, hitPoints: 4, toughOnEntry: true }],
    [6, { name: "Shocker", side: "villain", imgPath: "/cards/villains/rhino/Shocker-Minion.png", tags: ["criminal"], flavorText: `"I bet you're shocked to see me."`,
        type: "minion", boostIcons: 2, sch: 1, atk: 2, hitPoints: 3,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "minionEntered",
            effects: [{ op: 'if', condition: { type: 'identityStatus', value: 'hero' }, then: [{ op: 'dealDamage', target: 'identity', amount: 1 }] }]
        }
    }],
    [7, { name: "Hard To Keep Down", side: "villain", imgPath: "/cards/villains/rhino/HardToKeepDown-Treachery.png", tags: [], flavorText: `"You think you can stop me? What a joke" - Rhino`,
        type: "treachery", boostIcons: 0,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{
                op: 'if',
                condition: { type: 'targetHpFull', target: 'villain' },
                then: { op: 'surge' },
                else: { op: 'heal', target: 'villain', amount: 4 }
            }]
        }
    }],
    [8, { name: `"I'm Tough!"`, side: "villain", imgPath: "/cards/villains/rhino/ImTough!-Treachery.png", tags: [], flavorText: `"Bring it!" - Rhino`,
        type: "treachery", boostIcons: 0,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{
                op: 'if',
                condition: { type: 'targetHasTough', target: 'villain' },
                then: { op: 'surge' },
                else: { op: 'giveTough', target: 'villain' }
            }]
        }
    }],
    [9, { name: "Stampede", side: "villain", imgPath: "/cards/villains/rhino/Stampede-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 1,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{
                op: 'if',
                condition: { type: 'identityStatus', value: 'alter-ego' },
                then: { op: 'surge' },
                else: { op: 'villainAttack', stunOnHit: true }
            }]
        }
    }],
    [10, { name: `Breakin' & Takin'`, side: "villain", imgPath: "/cards/villains/rhino/Breakin'&Takin'-SideScheme.png", tags: [], flavorText: "Rhino is breaking things and taking them.",
        type: "side-scheme", boostIcons: 2, startingThreat: 2, startingThreatIsPerPlayer: false, hazard: true, whenRevealedThreat: 1 }],
    [11, { name: "Crowd Control", side: "villain", imgPath: "/cards/villains/rhino/CrowdControl-SideScheme.png", tags: [], flavorText: "Panicked civilians crowd the area. It is difficult to confront Rhino without putting them at risk. Get the people to safety!",
        type: "side-scheme", boostIcons: 2, startingThreat: 2, startingThreatIsPerPlayer: true, crisis: true }],

    // ── Standard I encounter set ──
    [12, { name: "Advance", side: "villain", imgPath: "/cards/villains/standard/Advance-Treachery.png", tags: [], flavorText: '"The world will be mine!" - Red Skull',
        type: "treachery", boostIcons: 0,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'addThreat', amount: 2 }] } }],
    [13, { name: "Assault", side: "villain", imgPath: "/cards/villains/standard/Assault-Treachery.png", tags: [], flavorText: '"Die!" - Venom',
        type: "treachery", boostIcons: 0,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'if', condition: { type: 'identityStatus', value: 'alter-ego' }, then: { op: 'surge' }, else: { op: 'villainAttack' } }] } }],
    [14, { name: "Caught Off Guard", side: "villain", imgPath: "/cards/villains/standard/CaughtOffGuard-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'discardTableauCard', types: ['upgrade', 'support'], surgeIfNone: true }] } }],
    [15, { name: "Gang-Up", side: "villain", imgPath: "/cards/villains/standard/GangUp-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'if', condition: { type: 'identityStatus', value: 'alter-ego' }, then: { op: 'surge' }, else: { op: 'allEnemiesAttack' } }] } }],
    [16, { name: "Shadow of the Past", side: "villain", imgPath: "/cards/villains/standard/ShadowOfThePast-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'surge' }] } }],

    // ── Bomb Scare modular encounter set ──
    [17, { name: "Bomb Scare", side: "villain", imgPath: "/cards/modular/bomb-scare/BombScare-SideScheme.png", tags: [], flavorText: "",
        type: "side-scheme", boostIcons: 2, startingThreat: 2, startingThreatIsPerPlayer: false,
        whenRevealedThreat: 1, whenRevealedThreatIsPerPlayer: true, acceleration: true }],
    [18, { name: "Hydra Bomber", side: "villain", imgPath: "/cards/modular/bomb-scare/HydraBomber-Minion.png", tags: ["hydra"], flavorText: "",
        type: "minion", boostIcons: 2, sch: 1, atk: 1, hitPoints: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "minionEntered",
            effects: [{ op: 'chooseOne', options: [
                { label: "Take 2 damage",              effect: { op: 'dealDamage', target: 'identity', amount: 2 } },
                { label: "Place 1 threat on main scheme", effect: { op: 'addThreat', amount: 1 } },
            ]}] } }],
    [19, { name: "Explosion", side: "villain", imgPath: "/cards/modular/bomb-scare/Explosion-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'if', condition: { type: 'sideSchemeInPlay', name: 'Bomb Scare' },
                then: { op: 'dealDamageBySideSchemeThreat', schemeName: 'Bomb Scare', target: 'identity' },
                else: { op: 'surge' } }] } }],
    [20, { name: "False Alarm", side: "villain", imgPath: "/cards/modular/bomb-scare/FalseAlarm-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'if', condition: { type: 'targetIsConfused', target: 'identity' },
                then: { op: 'surge' },
                else: { op: 'confuse', target: 'identity' } }] } }],
]);

export function getCardImgPathById(cardId: number): string {
    return cardMap.get(cardId)?.imgPath ?? "";
}

export function getVillainCardImgPathById(cardId: number): string {
    return villainCardMap.get(cardId)?.imgPath ?? "";
}

// ── Setup libraries ──

export const rhinoVillainCardIds  = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const standardICardIds     = [12, 13, 14, 15, 16];
export const bombScareCardIds     = [17, 18, 18, 19, 20, 20];

export const heroLibrary = [
    {
        id: 1,
        name: "Spider-Man",
        imgPath: "/cards/heroes/spider-man/PeterParker-Hero.png",
        heroDeckIds: [1, 2, 2, 3, 3, 4, 4, 4, 5, 6, 6, 7, 7, 8, 8],
    },
];

export const villainLibrary = [
    {
        id: 1,
        name: "Rhino",
        imgPath: "/cards/villains/rhino/Rhino-Phase1.png",
        mainSchemeId: 1,
        villainDeckIds: rhinoVillainCardIds,
    },
];

export const encounterLibrary = [
    {
        id: 1,
        name: "Bomb Scare",
        imgPath: "/cards/misc/villain-card-back.png",
        description: "A bomb has been planted. Stop it before it goes off!",
        cardIds: bombScareCardIds,
    },
];
