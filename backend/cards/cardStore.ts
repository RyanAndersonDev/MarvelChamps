import type { IdentityCard, PlayerCard, VillainIdentityCard, MainScheme, VillainCard } from "../../shared/types/card";

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
    }],
    [2, {
        name: "Jennifer Walters/She-Hulk", side: "player",
        imgPath: "/cards/heroes/she-hulk/JenniferWalters-AE.png",
        heroImgPath: "/cards/heroes/she-hulk/JenniferWalters-Hero.png",
        flavorText: "",
        hitPoints: 15, healing: 5, thw: 1, atk: 3, def: 2,
        handsizeAe: 6, handSizeHero: 4,
        tags: ["attorney", "gamma"], heroTags: ["avenger", "gamma"],
        aeLogic: {
            type: "interrupt",
            forced: false,
            formRequired: "alter-ego",
            timing: "MAIN_SCHEME_THREAT",
            limit: { uses: 1, resetOn: 'round' },
            effects: [{ op: 'preventThreat', amount: 1 }]
        },
        aeAbilityExhausts: false,
        heroLogic: {
            type: "response",
            forced: true,
            formRequired: "hero",
            timing: "FLIP_TO_HERO",
            effects: [{ op: 'dealDamage', target: 'chooseEnemyIgnoreGuard', amount: 2 }]
        },
        heroAbilityExhausts: false,
    }],
    [4, {
        name: "Piotr Rasputin/Colossus", side: "player",
        imgPath: "/cards/heroes/colossus/PiotrRasputin-AE.png",
        heroImgPath: "/cards/heroes/colossus/Colossus-Hero.png",
        flavorText: "",
        hitPoints: 14, healing: 4, thw: 1, atk: 2, def: 2,
        handsizeAe: 6, handSizeHero: 4,
        tags: ["mutant", "x-men"], heroTags: ["x-men"],
        maxToughCounters: 2,
        setupEffects: [{ op: 'searchAndAddToHand', storageId: 89, cardName: "Organic Steel" }],
        aeLogic: {
            type: "response",
            forced: true,
            formRequired: "alter-ego",
            timing: "FLIP_TO_AE",
            effects: [{ op: 'shuffleTaggedCardFromDiscardIntoDeck', tag: 'colossus' }]
        },
        aeAbilityExhausts: false,
        heroLogic: {
            type: "response",
            forced: true,
            formRequired: "hero",
            timing: "FLIP_TO_HERO",
            effects: [{ op: 'giveTough', target: 'identity' }]
        },
        heroAbilityExhausts: false,
    }],
    [3, {
        name: "Clint Barton/Hawkeye", side: "player",
        imgPath: "/cards/heroes/hawkeye/ClintBarton-AE.png",
        heroImgPath: "/cards/heroes/hawkeye/ClintBarton-Hero.png",
        flavorText: "",
        hitPoints: 9, healing: 3, thw: 1, atk: 2, def: 1,
        handsizeAe: 6, handSizeHero: 5,
        tags: ["s.h.i.e.l.d."], heroTags: ["avenger"],
        aeLogic: {
            type: "action",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            limit: { uses: 1, resetOn: 'round' },
            resourceCost: ["any"],
            effects: [{ op: 'searchAndAddToHand', storageId: 66, cardName: "Hawkeye's Bow" }]
        },
        aeAbilityExhausts: false,
        heroLogic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            effects: [{ op: 'readyUpgradeByStorageId', storageId: 66, cardName: "Hawkeye's Bow" }]
        },
        heroAbilityExhausts: true,
    }]
]);

export const cardMap: Map<number, PlayerCard> = new Map<number, PlayerCard>([
    [1, { name: "Black Cat", side: "player", type: "ally", cost: 2, aspect: "hero", imgPath: "/cards/heroes/spider-man/BlackCat-Ally.png", tags: ["hero for hire"], resources: ["energy"], flavorText: "", abilityExhausts: false, thw: 1, atk: 1, thwPain: 1, atkPain: 0, health: 2, maxCopies: 1,
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
        thw: 1, thwPain: 1, atk: 1, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "afterPlay",
            effects: [{ op: 'stun', target: 'chooseEnemyIgnoreGuard' }]
        }
    }],
    [10, { name: "Nick Fury", side: "player", type: "ally", cost: 4, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/NickFury-Ally.png",
        tags: ["S.H.I.E.L.D.", "spy"], resources: ["mental"], flavorText: "",
        thw: 2, thwPain: 1, atk: 2, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1,
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
            type: "resource",
            forced: false,
            formRequired: "any",
            timing: "paymentWindow",
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

    // ── Protection aspect ──
    [16, { name: "Armored Vest", side: "player", type: "upgrade", cost: 1, aspect: "protection",
        imgPath: "/cards/player-cards/protection/ArmoredVest-Upgrade.png",
        tags: ["armor"], resources: ["mental"], flavorText: `"Life-saving and stylish."`,
        attachmentLocation: "tableau", uniqueInPlay: true, defMod: 1,
    }],
    [17, { name: "Clea", side: "player", type: "ally", cost: 2, aspect: "protection",
        imgPath: "/cards/player-cards/protection/Clea-Ally.png",
        tags: ["mystic"], resources: ["physical"], flavorText: "",
        thw: 1, thwPain: 1, atk: 1, atkPain: 1, health: 2, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "interrupt",
            forced: true,
            formRequired: "any",
            timing: "allyDefeated",
            effects: [{ op: 'shuffleSelfIntoDeck' }]
        }
    }],
    [18, { name: "Desperate Defense", side: "player", type: "event", cost: 1, aspect: "protection",
        imgPath: "/cards/player-cards/protection/DesperateDefense-Event.png",
        tags: ["defense"], resources: ["energy"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "HERO_DEFENDS",
            actionType: "defense",
            effects: [{ op: 'addDefBonus', amount: 2 }]
        }
    }],
    [19, { name: "Indomitable", side: "player", type: "upgrade", cost: 1, aspect: "protection",
        imgPath: "/cards/player-cards/protection/Indomitable-Upgrade.png",
        tags: ["condition"], resources: ["energy"], flavorText: "",
        attachmentLocation: "tableau", abilityExhausts: false,
        logic: {
            type: "response",
            forced: false,
            formRequired: "any",
            timing: "VILLAIN_ATTACK_CONCLUDED",
            effects: [{
                op: 'if', condition: { type: 'heroDefended' },
                then: [{ op: 'discardSelf' }, { op: 'readyIdentity' }]
            }]
        }
    }],
    [20, { name: "The Night Nurse", side: "player", type: "support", cost: 1, aspect: "protection",
        imgPath: "/cards/player-cards/protection/TheNightNurse-Support.png",
        tags: ["persona"], resources: ["mental"], flavorText: "",
        abilityExhausts: true, counters: 3, maxCopies: 1,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [
                { op: 'decrementCounter', discardIfEmpty: true },
                { op: 'heal', target: 'identity', amount: 1 },
                { op: 'clearStatus', target: 'identity' },
                { op: 'exhaust' }
            ]
        }
    }],
    [21, { name: "Unflappable", side: "player", type: "upgrade", cost: 1, aspect: "protection",
        imgPath: "/cards/player-cards/protection/Unflappable-Upgrade.png",
        tags: ["condition"], resources: ["mental"], flavorText: "",
        attachmentLocation: "tableau", uniqueInPlay: true, abilityExhausts: true,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "VILLAIN_ATTACK_CONCLUDED",
            effects: [{
                op: 'if', condition: { type: 'wasDefended' },
                then: [{
                    op: 'if', condition: { type: 'noDamageDealt' },
                    then: [{ op: 'drawCards', amount: 1 }, { op: 'exhaust' }]
                }]
            }]
        }
    }],

    // ── She-Hulk hero cards ──
    [22, { name: "Hellcat", side: "player", type: "ally", cost: 3, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/Hellcat-Ally.png",
        tags: ["avenger"], resources: ["wild"], flavorText: "",
        thw: 2, thwPain: 2, atk: 1, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'returnAllyToHand' }]
        }
    }],
    [23, { name: "Gamma Slam", side: "player", type: "event", cost: 4, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/GammaSlam-Event.png",
        tags: ["attack", "superpower"], resources: ["mental"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [{ op: 'dynamicDamage', target: 'chooseEnemy', formula: 'damageSustained', max: 15 }]
        }
    }],
    [24, { name: "Ground Stomp", side: "player", type: "event", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/GroundStomp-Event.png",
        tags: ["superpower"], resources: ["mental"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [{ op: 'dealDamageToAll', amount: 1 }]
        }
    }],
    [25, { name: "Legal Practice", side: "player", type: "event", cost: 0, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/LegalPractice-Event.png",
        tags: ["skill", "thwart"], resources: ["physical"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            actionType: "thwart",
            effects: [{ op: 'discardHandForThreat', max: 5 }]
        }
    }],
    [26, { name: "One-Two Punch", side: "player", type: "event", cost: 1, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/OneTwoPunch-Event.png",
        tags: ["skill"], resources: ["physical"], flavorText: "",
        logic: {
            type: "response",
            forced: false,
            formRequired: "hero",
            timing: "BASIC_ATTACK",
            effects: [{ op: 'readyIdentity' }]
        }
    }],
    [27, { name: "Split Personality", side: "player", type: "event", cost: 3, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/SplitPersonality-Event.png",
        tags: [], resources: ["energy"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'sequence', effects: [{ op: 'flipForm' }, { op: 'drawToHandSize' }] }]
        }
    }],
    [28, { name: "Superhuman Law Division", side: "player", type: "support", cost: 1, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/SuperhumanLawDivision-Support.png",
        tags: ["location"], resources: ["physical"], flavorText: "",
        abilityExhausts: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            resourceCost: ["mental"],
            effects: [{ op: 'removeThreat', target: 'chooseScheme', amount: 2 }, { op: 'exhaust' }]
        }
    }],
    [29, { name: "Focused Rage", side: "player", type: "upgrade", cost: 3, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/FocusedRage-Upgrade.png",
        tags: ["skill"], resources: ["energy"], flavorText: "",
        attachmentLocation: "tableau", abilityExhausts: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            effects: [{ op: 'sequence', effects: [
                { op: 'selfDamage', amount: 1 },
                { op: 'drawCards', amount: 1 },
                { op: 'exhaust' }
            ]}]
        }
    }],
    [30, { name: "Superhuman Strength", side: "player", type: "upgrade", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/she-hulk/SuperhumanStrength-Upgrade.png",
        tags: ["superpower"], resources: ["mental"], flavorText: "",
        attachmentLocation: "tableau", atkMod: 2,
        logic: {
            type: "response",
            forced: true,
            formRequired: "hero",
            timing: "BASIC_ATTACK",
            effects: [{ op: 'if', condition: { type: 'payloadTargetAlive' }, then: [
                { op: 'discardSelf' },
                { op: 'stun', target: 'payloadTarget' }
            ]}]
        }
    }],

    // ── Aggression aspect ──
    [31, { name: "Hulk", side: "player", type: "ally", cost: 2, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/Hulk-Ally.png",
        tags: ["avenger", "gamma"], resources: ["energy"], flavorText: "",
        thw: 0, thwPain: 0, atk: 3, atkPain: 1, health: 5, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "ALLY_ATTACKS",
            effects: [{
                op: 'if', condition: { type: 'selfIsAttacker' },
                then: [{ op: 'discardTopDeckBranch', effects: {
                    physical: [{ op: 'dealDamage', target: 'chooseEnemyIgnoreGuard', amount: 2 }],
                    energy:   [{ op: 'dealDamageToAll', amount: 1, includeAllCharacters: true }],
                    mental:   [{ op: 'discardSelf' }],
                }}]
            }]
        }
    }],
    [32, { name: "Tigra", side: "player", type: "ally", cost: 3, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/Tigra-Ally.png",
        tags: ["avenger"], resources: ["mental"], flavorText: "",
        thw: 1, thwPain: 1, atk: 2, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "ALLY_ATTACKS",
            effects: [{
                op: 'if', condition: { type: 'selfIsAttacker' },
                then: [{
                    op: 'if', condition: { type: 'targetWasDefeated' },
                    then: [{
                        op: 'if', condition: { type: 'targetIsMinion' },
                        then: [{ op: 'heal', target: 'self', amount: 1 }]
                    }]
                }]
            }]
        }
    }],
    [33, { name: "Chase Them Down", side: "player", type: "event", cost: 0, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/ChaseThemDown-Event.png",
        tags: ["thwart"], resources: ["mental"], flavorText: "",
        logic: {
            type: "response",
            forced: false,
            formRequired: "hero",
            timing: "BASIC_ATTACK",
            effects: [{
                op: 'if', condition: { type: 'targetWasDefeated' },
                then: [{ op: 'removeThreat', target: 'chooseScheme', amount: 2 }]
            }]
        }
    }],
    [34, { name: "Relentless Assault", side: "player", type: "event", cost: 2, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/RelentlessAssault-Event.png",
        tags: ["attack"], resources: ["energy"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [{
                op: 'if', condition: { type: 'paidWithResource', resource: 'physical' },
                then: [{ op: 'dealDamageOverkill', target: 'chooseMinion', amount: 5 }],
                else: [{ op: 'dealDamage', target: 'chooseMinion', amount: 5 }]
            }]
        }
    }],
    [35, { name: "Uppercut", side: "player", type: "event", cost: 3, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/Uppercut-Event.png",
        tags: ["attack"], resources: ["physical"], flavorText: "SMACK!",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [{ op: 'dealDamage', target: 'chooseEnemy', amount: 5 }]
        }
    }],
    [36, { name: "The Power of Aggression", side: "player", type: "resource", cost: 0, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/ThePowerOfAggression-Resource.png",
        tags: [], resources: [], flavorText: "", maxCopies: 2,
        logic: {
            type: "resource",
            forced: false,
            formRequired: "any",
            timing: "paymentWindow",
            effects: [{
                op: 'if', condition: { type: 'activeCardIsAspect', aspect: 'aggression' },
                then: [{ op: 'generateResource', resourceType: 'wild' }, { op: 'generateResource', resourceType: 'wild' }],
                else: [{ op: 'generateResource', resourceType: 'wild' }]
            }]
        }
    }],
    [37, { name: "Tac Team", side: "player", type: "support", cost: 3, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/TacTeam-Support.png",
        tags: ["s.h.i.e.l.d."], resources: ["energy"], flavorText: "",
        abilityExhausts: true, counters: 3,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [
                { op: 'decrementCounter', discardIfEmpty: true },
                { op: 'dealDamage', target: 'chooseEnemy', amount: 2 },
                { op: 'exhaust' }
            ]
        }
    }],
    [38, { name: "Combat Training", side: "player", type: "upgrade", cost: 2, aspect: "aggression",
        imgPath: "/cards/player-cards/aggression/CombatTraining-Upgrade.png",
        tags: ["skill"], resources: ["physical"], flavorText: "",
        attachmentLocation: "tableau", atkMod: 1, uniqueInPlay: true,
    }],

    // ── Leadership aspect ──
    [39, { name: "Hawkeye", side: "player", type: "ally", cost: 3, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/Hawkeye-Ally.png",
        tags: ["avenger"], resources: ["energy"], flavorText: "",
        thw: 1, thwPain: 1, atk: 1, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1, counters: 4,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "MINION_ENTERED_PLAY",
            effects: [{
                op: 'if', condition: { type: 'selfHasCounters' },
                then: [{ op: 'decrementCounter' }, { op: 'dealDamage', target: 'payloadTarget', amount: 2 }]
            }]
        }
    }],
    [40, { name: "Maria Hill", side: "player", type: "ally", cost: 2, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/MariaHill-Ally.png",
        tags: ["S.H.I.E.L.D."], resources: ["mental"], flavorText: "",
        thw: 2, thwPain: 1, atk: 1, atkPain: 1, health: 2, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "afterPlay",
            effects: [{ op: 'drawCards', amount: 1 }]
        }
    }],
    [41, { name: "Vision", side: "player", type: "ally", cost: 4, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/Vision-Ally.png",
        tags: ["android", "avenger"], resources: ["physical"], flavorText: "",
        thw: 1, thwPain: 1, atk: 2, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            resourceCost: ["energy"],
            limit: { uses: 1, resetOn: 'round' },
            effects: [{ op: 'chooseOne', options: [
                { label: "Vision gets +2 ATK", effect: { op: 'modifyAllyStat', target: 'self', stat: 'atk', amount: 2 } },
                { label: "Vision gets +2 THW", effect: { op: 'modifyAllyStat', target: 'self', stat: 'thw', amount: 2 } }
            ]}]
        }
    }],
    [42, { name: "Get Ready", side: "player", type: "event", cost: 0, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/GetReady-Event.png",
        tags: [], resources: ["physical"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'readyAlly' }]
        }
    }],
    [43, { name: "Lead From The Front", side: "player", type: "event", cost: 2, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/LeadFromTheFront-Event.png",
        tags: ["tactic"], resources: ["energy"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'boostAllCharacters', stat: 'both', amount: 1 }]
        }
    }],
    [44, { name: "Make The Call", side: "player", type: "event", cost: 0, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/MakeTheCall-Event.png",
        tags: [], resources: ["mental"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'putAllyFromDiscardIntoPlay' }]
        }
    }],
    [45, { name: "The Power of Leadership", side: "player", type: "resource", cost: 0, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/ThePowerOfLeadership-Resource.png",
        tags: [], resources: [], flavorText: "", maxCopies: 2,
        logic: {
            type: "resource",
            forced: false,
            formRequired: "any",
            timing: "paymentWindow",
            effects: [{
                op: 'if', condition: { type: 'activeCardIsAspect', aspect: 'leadership' },
                then: [{ op: 'generateResource', resourceType: 'wild' }, { op: 'generateResource', resourceType: 'wild' }],
                else: [{ op: 'generateResource', resourceType: 'wild' }]
            }]
        }
    }],
    [46, { name: "The Triskelion", side: "player", type: "support", cost: 1, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/TheTriskelion-Support.png",
        tags: ["location", "S.H.I.E.L.D."], resources: ["energy"], flavorText: "",
        uniqueInPlay: true,
        allyLimitBonus: 1,
    }],
    [47, { name: "Inspired", side: "player", type: "upgrade", cost: 1, aspect: "leadership",
        imgPath: "/cards/player-cards/leadership/Inspired-Upgrade.png",
        tags: ["condition"], resources: ["physical"], flavorText: "",
        attachmentLocation: "ally", atkMod: 1, thwMod: 1,
    }],

    // ── Protection aspect ──
    [48, { name: "Black Widow", side: "player", type: "ally", cost: 3, aspect: "protection",
        imgPath: "/cards/player-cards/protection/BlackWidow-Ally.png",
        tags: ["S.H.I.E.L.D.", "spy"], resources: ["physical"], flavorText: "",
        thw: 2, thwPain: 1, atk: 1, atkPain: 1, health: 2, abilityExhausts: true, maxCopies: 1,
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "any",
            timing: "treacheryRevealed",
            resourceCost: ["mental"],
            effects: [{ op: 'sequence', effects: [{ op: 'cancelEffect' }, { op: 'surge' }] }]
        }
    }],
    [49, { name: "Luke Cage", side: "player", type: "ally", cost: 4, aspect: "protection",
        imgPath: "/cards/player-cards/protection/LukeCage-Ally.png",
        tags: ["avenger", "hero for hire"], resources: ["energy"], flavorText: "",
        thw: 1, thwPain: 1, atk: 2, atkPain: 1, health: 5, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "afterPlay",
            effects: [{ op: 'giveTough', target: 'self' }]
        }
    }],
    [50, { name: "Counter-Punch", side: "player", type: "event", cost: 0, aspect: "protection",
        imgPath: "/cards/player-cards/protection/CounterPunch-Event.png",
        tags: ["attack"], resources: ["physical"], flavorText: "",
        logic: {
            type: "response",
            forced: false,
            formRequired: "hero",
            timing: "HERO_DEFENDS",
            actionType: "defense",
            effects: [{ op: 'dynamicDamage', target: 'villain', formula: 'heroAtk', max: 99 }]
        }
    }],
    [51, { name: "Get Behind Me!", side: "player", type: "event", cost: 1, aspect: "protection",
        imgPath: "/cards/player-cards/protection/GetBehindMe-Event.png",
        tags: [], resources: ["mental"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "treacheryRevealed",
            effects: [{ op: 'sequence', effects: [{ op: 'cancelEffect' }, { op: 'villainAttack' }] }]
        }
    }],
    [52, { name: "The Power of Protection", side: "player", type: "resource", cost: 0, aspect: "protection",
        imgPath: "/cards/player-cards/protection/ThePowerOfProtection-Resource.png",
        tags: [], resources: [], flavorText: "", maxCopies: 2,
        logic: {
            type: "resource",
            forced: false,
            formRequired: "any",
            timing: "paymentWindow",
            effects: [{
                op: 'if', condition: { type: 'activeCardIsAspect', aspect: 'protection' },
                then: [{ op: 'generateResource', resourceType: 'wild' }, { op: 'generateResource', resourceType: 'wild' }],
                else: [{ op: 'generateResource', resourceType: 'wild' }]
            }]
        }
    }],
    [53, { name: "Med Team", side: "player", type: "support", cost: 3, aspect: "protection",
        imgPath: "/cards/player-cards/protection/MedTeam-Support.png",
        tags: ["S.H.I.E.L.D."], resources: ["energy"], flavorText: "",
        abilityExhausts: true, counters: 3,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [
                { op: 'decrementCounter', discardIfEmpty: true },
                { op: 'heal', target: 'chooseFriendly', amount: 2 },
                { op: 'exhaust' }
            ]
        }
    }],

    // ── Justice aspect ──
    [54, { name: "Daredevil", side: "player", type: "ally", cost: 4, aspect: "justice",
        imgPath: "/cards/player-cards/justice/Daredevil-Ally.png",
        tags: ["defender"], resources: ["physical"], flavorText: `"Sometimes, I think I accomplish more with my fists than with my law firm."`,
        thw: 2, thwPain: 1, atk: 2, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "ALLY_THWARTS",
            effects: [{
                op: 'if', condition: { type: 'selfIsAttacker' },
                then: [{ op: 'dealDamage', target: 'chooseEnemy', amount: 1 }]
            }]
        }
    }],
    [55, { name: "Jessica Jones", side: "player", type: "ally", cost: 3, aspect: "justice",
        imgPath: "/cards/player-cards/justice/JessicaJones-Ally.png",
        tags: ["defender"], resources: ["energy"], flavorText: "",
        thw: 1, thwPain: 1, atk: 2, atkPain: 1, health: 3, abilityExhausts: false, maxCopies: 1,
        dynamicThwBonus: "sideSchemeCount",
    }],
    [56, { name: "For Justice!", side: "player", type: "event", cost: 2, aspect: "justice",
        imgPath: "/cards/player-cards/justice/ForJustice-Event.png",
        tags: ["thwart"], resources: ["energy"], flavorText: `"You lose. And you're going to answer for what you've done" - Captain America`,
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "thwart",
            effects: [{
                op: 'if', condition: { type: 'paidWithResource', resource: 'mental' },
                then: [{ op: 'removeThreat', target: 'chooseScheme', amount: 4 }],
                else: [{ op: 'removeThreat', target: 'chooseScheme', amount: 3 }]
            }]
        }
    }],
    [57, { name: "Great Responsibility", side: "player", type: "event", cost: 0, aspect: "justice",
        imgPath: "/cards/player-cards/justice/GreatResponsibility-Event.png",
        tags: [], resources: ["mental"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "MAIN_SCHEME_THREAT",
            effects: [{ op: 'redirectThreatAsDamage' }]
        }
    }],
    [58, { name: "The Power of Justice", side: "player", type: "resource", cost: 0, aspect: "justice",
        imgPath: "/cards/player-cards/justice/ThePowerOfJustice.png",
        tags: [], resources: [], flavorText: "", maxCopies: 2,
        logic: {
            type: "resource",
            forced: false,
            formRequired: "any",
            timing: "paymentWindow",
            effects: [{
                op: 'if', condition: { type: 'activeCardIsAspect', aspect: 'justice' },
                then: [{ op: 'generateResource', resourceType: 'wild' }, { op: 'generateResource', resourceType: 'wild' }],
                else: [{ op: 'generateResource', resourceType: 'wild' }]
            }]
        }
    }],
    [59, { name: "Interrogation Room", side: "player", type: "support", cost: 1, aspect: "justice",
        imgPath: "/cards/player-cards/justice/InterrogationRoom-Support.png",
        tags: ["location"], resources: ["energy"], flavorText: `"Oh, she's sorry! Let me get the keys and call you a car service." - Misty Knight`,
        abilityExhausts: true,
        logic: {
            type: "response",
            forced: false,
            formRequired: "any",
            timing: "MINION_DEFEATED",
            effects: [{ op: 'removeThreat', target: 'chooseScheme', amount: 1 }]
        }
    }],
    [60, { name: "Surveillance Team", side: "player", type: "support", cost: 2, aspect: "justice",
        imgPath: "/cards/player-cards/justice/SurveillanceTeam-Support.png",
        tags: ["S.H.I.E.L.D."], resources: ["mental"], flavorText: "",
        abilityExhausts: true, counters: 3,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [
                { op: 'decrementCounter', discardIfEmpty: true },
                { op: 'removeThreat', target: 'chooseScheme', amount: 1 },
                { op: 'exhaust' }
            ]
        }
    }],
    [61, { name: "Heroic Intuition", side: "player", type: "upgrade", cost: 2, aspect: "justice",
        imgPath: "/cards/player-cards/justice/HeroicIntuition-Upgrade.png",
        tags: ["condition"], resources: ["energy"], flavorText: "",
        attachmentLocation: "tableau", uniqueInPlay: true, thwMod: 1,
    }],

    // ── Additional neutral cards ──
    [62, { name: "Emergency", side: "player", type: "event", cost: 0, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/Emergency-Event.png",
        tags: ["thwart"], resources: ["energy"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "any",
            timing: "MAIN_SCHEME_THREAT",
            effects: [{ op: 'preventThreat', amount: 1 }]
        }
    }],
    [63, { name: "First Aid", side: "player", type: "event", cost: 1, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/FirstAid-Event.png",
        tags: [], resources: ["mental"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'heal', target: 'chooseFriendly', amount: 2 }]
        }
    }],
    [64, { name: "Haymaker", side: "player", type: "event", cost: 2, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/Haymaker-Event.png",
        tags: ["attack"], resources: ["energy"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [{ op: 'dealDamage', target: 'chooseEnemy', amount: 3 }]
        }
    }],
    [65, { name: "Tenacity", side: "player", type: "upgrade", cost: 2, aspect: "neutral",
        imgPath: "/cards/player-cards/neutral/Tenacity.png",
        tags: ["condition"], resources: ["energy"], flavorText: "",
        attachmentLocation: "tableau", abilityExhausts: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            resourceCost: ["physical"],
            effects: [{ op: 'discardSelf' }, { op: 'readyIdentity' }]
        }
    }],
    [66, {
        name: "Hawkeye's Bow", side: "player", type: "upgrade", cost: 0, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/HawkeyesBow-Upgrade.png",
        tags: ["weapon"], resources: ["wild"], flavorText: "",
        attachmentLocation: "tableau", atkMod: 1, rangedForArrowEvents: true,
    }],
    [67, {
        name: "Hawkeye's Quiver", side: "player", type: "upgrade", cost: 1, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/HawkeyesQuiver-Upgrade.png",
        tags: ["item"], resources: ["mental"], flavorText: "",
        attachmentLocation: "tableau", abilityExhausts: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            effects: [{ op: 'attachArrowFromTopDeck' }]
        }
    }],
    [68, {
        name: "Mockingbird", side: "player", type: "ally", cost: 3, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/Mockingbird-Ally.png",
        tags: ["avenger", "s.h.i.e.l.d."], resources: ["wild"],
        flavorText: `"Is that all you got?"`,
        thw: 2, atk: 2, thwPain: 1, atkPain: 1, health: 3, maxCopies: 1,
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "any",
            timing: "VILLAIN_ATTACK",
            effects: [
                    { op: 'payAnyResource' },
                    { op: 'returnAllyToHand' },
                    { op: 'preventAttack' }
                ]
        }
    }],
    [69, {
        name: "Sonic Arrow", side: "player", type: "event", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/SonicArrow-Event.png",
        tags: ["arrow", "attack"], resources: ["mental"], returnPaymentOnSuccess: true,
        flavorText: "EEEEEEEEEEEEEEEEEE!!!",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [
                { op: 'exhaustUpgradeByStorageId', storageId: 66, cardName: "Hawkeye's Bow" },
                { op: 'confuseAndDamage', normalAmount: 3, alreadyConfusedAmount: 5 }
            ]
        }
    }],
    [70, {
        name: "Cable Arrow", side: "player", type: "event", cost: 1, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/CableArrow-Event.png",
        tags: ["arrow", "thwart"], resources: ["physical"], returnPaymentOnSuccess: true,
        flavorText: `"It's a great way to get around." - Clint Barton`,
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "thwart",
            effects: [
                { op: 'exhaustUpgradeByStorageId', storageId: 66, cardName: "Hawkeye's Bow" },
                { op: 'removeThreatIgnoreCrisis', amount: 3 }
            ]
        }
    }],
    [71, {
        name: "Explosive Arrow", side: "player", type: "event", cost: 1, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/ExplosiveArrow-Event.png",
        tags: ["arrow", "attack"], resources: ["physical"], returnPaymentOnSuccess: true,
        flavorText: `"Anyone ever tell you how your eyes sparkle when you're angry?" - Clint Barton`,
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [
                { op: 'exhaustUpgradeByStorageId', storageId: 66, cardName: "Hawkeye's Bow" },
                { op: 'dealDamageToVillainAndEngaged', amount: 3 }
            ]
        }
    }],
    [72, {
        name: "Electric Arrow", side: "player", type: "event", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/ElectricArrow-Event.png",
        tags: ["arrow", "attack"], resources: ["energy"], returnPaymentOnSuccess: true,
        flavorText: `"H:ail Hawkeye!" - Clint Barton`,
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [
                { op: 'exhaustUpgradeByStorageId', storageId: 66, cardName: "Hawkeye's Bow" },
                { op: 'stunAndDamage', normalAmount: 3, alreadyStunnedAmount: 5 }
            ]
        }
    }],
    [73, {
        name: "Vibranium Arrow", side: "player", type: "event", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/VibraniumArrow-Event.png",
        tags: ["arrow", "attack"], resources: ["energy"], returnPaymentOnSuccess: true, flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [
                { op: 'exhaustUpgradeByStorageId', storageId: 66, cardName: "Hawkeye's Bow" },
                { op: 'dealDamagePiercing', target: 'chooseEnemy', amount: 6 }
            ]
        }
    }],
    [74, {
        name: "Expert Marksman", side: "player", type: "upgrade", cost: 1, aspect: "hero",
        imgPath: "/cards/heroes/hawkeye/ExpertMarksman-Upgrade.png",
        tags: ["skill"], resources: ["wild"],
        flavorText: `"When you fight alongside gods and monsters, it's not enough to be great; you have to be the best." - Clint Barton`,
        attachmentLocation: "tableau", abilityExhausts: true,
        logic: {
            type: "resource",
            forced: false,
            formRequired: "any",
            timing: "PLAYER_TURN",
            effects: [{ op: 'generateResource', resourceType: 'wild' }]
        }
    }],

    // ── Colossus hero cards ──────────────────────────────────────────────────
    [85, {
        name: "Shadowcat", side: "player", type: "ally", cost: 3, aspect: "hero",
        imgPath: "/cards/heroes/colossus/Shadowcat-Ally.png",
        tags: ["x-men", "colossus"], resources: ["energy"], flavorText: "",
        thw: 1, atk: 1, thwPain: 0, atkPain: 0, health: 3, maxCopies: 1,
        ignoresGuard: true, ignoresCrisis: true,
    }],
    [86, {
        name: "Piotr's Studio", side: "player", type: "support", cost: 3, aspect: "hero",
        imgPath: "/cards/heroes/colossus/PiotrsStudio-Support.png",
        tags: ["location", "colossus"], resources: ["physical"], flavorText: "",
        abilityExhausts: true,
        logic: {
            type: "action",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            effects: [{ op: 'discardTopDeckUntilTag', tag: 'colossus' }]
        }
    }],
    [87, {
        name: "Iron Will", side: "player", type: "upgrade", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/colossus/IronWill-Upgrade.png",
        tags: ["condition", "colossus"], resources: ["mental"], flavorText: "",
        attachmentLocation: "tableau", thwMod: 1,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "HERO_TOUGH_DISCARDED",
            effects: [{ op: 'drawCards', amount: 1 }]
        }
    }],
    [88, {
        name: "Titanium Muscles", side: "player", type: "upgrade", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/colossus/TitaniumMuscles-Upgrade.png",
        tags: ["superpower", "colossus"], resources: ["physical"], flavorText: "",
        attachmentLocation: "tableau", atkMod: 1, abilityExhausts: true,
        logic: {
            type: "resource",
            forced: false,
            formRequired: "any",
            timing: "paymentWindow",
            effects: [
                { op: 'generateResource', resourceType: 'physical' },
                { op: 'if', condition: { type: 'heroHasTough' },
                  then: [{ op: 'generateResource', resourceType: 'physical' }] }
            ]
        }
    }],
    [89, {
        name: "Organic Steel", side: "player", type: "upgrade", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/colossus/OrganicSteel-Upgrade.png",
        tags: ["superpower", "colossus"], resources: ["wild"], flavorText: "",
        attachmentLocation: "tableau", counters: 2,
        logic: {
            type: "response",
            forced: true,
            formRequired: "any",
            timing: "HERO_TOUGH_DISCARDED",
            effects: [
                { op: 'exhaust' },
                { op: 'decrementCounter', discardIfEmpty: true },
                { op: 'giveTough', target: 'identity' }
            ]
        }
    }],
    [90, {
        name: "Made of Rage", side: "player", type: "event", cost: 0, aspect: "hero",
        imgPath: "/cards/heroes/colossus/MadeOfRage-Event.png",
        tags: ["attack", "colossus"], resources: ["physical"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "hero",
            timing: "BASIC_ATTACK",
            effects: [
                { op: 'discardToughFromHero' },
                { op: 'addBonusDamageToCurrentAttack', amount: 6 },
                { op: 'makeCurrentAttackOverkill' }
            ]
        }
    }],
    [91, {
        name: "Steel Fist", side: "player", type: "event", cost: 2, aspect: "hero",
        imgPath: "/cards/heroes/colossus/SteelFist-Event.png",
        tags: ["attack", "colossus"], resources: ["physical"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "hero",
            timing: "PLAYER_TURN",
            actionType: "attack",
            effects: [
                { op: 'dealDamage', target: 'chooseEnemy', amount: 5 },
                { op: 'if', condition: { type: 'heroHasTough' },
                  then: [{ op: 'chooseOne', options: [
                      { label: 'Discard Tough → Stun + Confuse enemy',
                        effect: { op: 'sequence', effects: [
                            { op: 'discardToughFromHero' },
                            { op: 'stun', target: 'lastTarget' },
                            { op: 'confuse', target: 'lastTarget' }
                        ] } },
                      { label: 'No bonus effect',
                        effect: { op: 'sequence', effects: [] } }
                  ]}] }
            ]
        }
    }],
    [92, {
        name: "Bulletproof Protector", side: "player", type: "event", cost: 1, aspect: "protection",
        imgPath: "/cards/heroes/colossus/BulletproofProtector-Event.png",
        tags: ["defense", "colossus"], resources: ["physical"], flavorText: "",
        logic: {
            type: "interrupt",
            forced: false,
            formRequired: "any",
            timing: "VILLAIN_ATTACK",
            effects: [
                { op: 'if', condition: { type: 'heroHasTough' },
                  then: [{ op: 'chooseOne', options: [
                      { label: 'Discard Tough → Give Colossus 2 Tough',
                        effect: { op: 'sequence', effects: [
                            { op: 'discardToughFromHero' },
                            { op: 'giveTough', target: 'identity' },
                            { op: 'giveTough', target: 'identity' }
                        ] } },
                      { label: 'Discard Tough → Ready Colossus',
                        effect: { op: 'sequence', effects: [
                            { op: 'discardToughFromHero' },
                            { op: 'readyIdentity' }
                        ] } }
                  ]}] }
            ]
        }
    }],
    [93, {
        name: "Armor Up", side: "player", type: "event", cost: 0, aspect: "hero",
        imgPath: "/cards/heroes/colossus/ArmorUp-Event.png",
        tags: ["colossus"], resources: ["wild"], flavorText: "",
        logic: {
            type: "action",
            forced: false,
            formRequired: "alter-ego",
            timing: "PLAYER_TURN",
            effects: [{ op: 'flipForm' }]
        }
    }],
]);


export const villainIdCardMap: Map<number, VillainIdentityCard> = new Map<number, VillainIdentityCard>([
    [1, { name: "Rhino", side: "villain", imgPath: "/cards/villains/rhino/Rhino-Phase1.png", tags: ["brute", "criminal"], phase: 1, hitPointsPerPlayer: 14, sch: 1, atk: 2,
        flavorText: `"I'm Rhino. I knock things down. That's what I do. That's who I am."` }],
    [2, { name: "Rhino", side: "villain", imgPath: "/cards/villains/rhino/Rhino-Phase2.png", tags: ["brute", "criminal"], phase: 2, hitPointsPerPlayer: 15, sch: 1, atk: 3,
        flavorText: `"Out of my way!"`,
        whenFlipped: [
            { op: 'fetchAndRevealVillainCard', storageId: 10 },
            { op: 'shuffleVillainDeck' },
        ]
    }],
    [3, { name: "Rhino", side: "villain", imgPath: "/cards/villains/rhino/Rhino-Phase3.png", tags: ["brute", "criminal"], phase: 3, hitPointsPerPlayer: 16, sch: 1, atk: 4,
        flavorText: `"You brought this on yourself!"` }],
    [4, { name: "Klaw", side: "villain", imgPath: "/cards/villains/klaw/Klaw-Phase1.png", tags: ["masters of evil"], phase: 1, hitPointsPerPlayer: 14, sch: 2, atk: 0,
        flavorText: `"Come meet your doom!"`,
        logic: {
            type: "interrupt", forced: true, formRequired: "any", timing: "VILLAIN_ATTACK",
            effects: [{ op: 'addBoostCard' }]
        }
    }],
    [5, { name: "Klaw", side: "villain", imgPath: "/cards/villains/klaw/Klaw-Phase2.png", tags: ["masters of evil"], phase: 2, hitPointsPerPlayer: 16, sch: 2, atk: 1,
        flavorText: "",
        whenFlipped: [
            { op: 'fetchAndRevealVillainCard', storageId: 25 },
            { op: 'shuffleVillainDeck' },
        ],
        logic: {
            type: "interrupt", forced: true, formRequired: "any", timing: "VILLAIN_ATTACK",
            effects: [{ op: 'addBoostCard' }]
        }
    }],
    [6, { name: "Klaw", side: "villain", imgPath: "/cards/villains/klaw/Klaw-Phase3.png", tags: ["masters of evil"], phase: 3, hitPointsPerPlayer: 18, sch: 3, atk: 2,
        flavorText: "",
        toughOnEntry: true,
        logic: {
            type: "interrupt", forced: true, formRequired: "any", timing: "VILLAIN_ATTACK",
            effects: [{ op: 'addBoostCard' }]
        }
    }],
]);

export const villainMainSchemeMap: Map<number, MainScheme> = new Map<number, MainScheme>([
    [1, { name: "The Break-In!", side: "villain", imgPath: "/cards/villains/rhino/TheBreakIn-MainScheme1.png", tags: [], flavorText: "Rhino is trying to smash through the facility wall and steal a shipment of vibranium. You must stop him!",
        threatThreshold: 7, threatThresholdIsPerPlayer: true, startingThreat: 0, startingThreatIsPerPlayer: false, threatIncrement: 1, threatIncrementIsPerPlayer: true, nextMainSchemeId: null }],
    [2, { name: "Underground Distribution", side: "villain", imgPath: "/cards/villains/klaw/UndergroundDistribution-MainScheme.png", tags: [], flavorText: "",
        threatThreshold: 6, threatThresholdIsPerPlayer: true,
        startingThreat: 0, startingThreatIsPerPlayer: false,
        threatIncrement: 1, threatIncrementIsPerPlayer: true,
        nextMainSchemeId: 3,
        whenRevealedEffects: [
            { op: 'fetchAndRevealVillainCard', storageId: 24 },
            { op: 'shuffleVillainDeck' },
            { op: 'discardUntilMinionIntoPlay' },
        ]
    }],
    [3, { name: "Secret Rendezvous", side: "villain", imgPath: "/cards/villains/klaw/SecretRendezvous-MainScheme.png", tags: [], flavorText: "",
        threatThreshold: 8, threatThresholdIsPerPlayer: true,
        startingThreat: 0, startingThreatIsPerPlayer: false,
        threatIncrement: 1, threatIncrementIsPerPlayer: true,
        nextMainSchemeId: null,
        whenRevealedEffects: [
            { op: 'discardUntilMinionIntoPlay' },
        ]
    }],
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
        type: "attachment", boostIcons: 2, atkMod: 1, removal: { cost: 3, resourceType: 'physical', formRequired: 'hero' } }],
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
            effects: [{ op: 'villainScheme' }] } }],
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
            effects: [{ op: 'revealNemesisSet' }] } }],

    // ── Bomb Scare modular encounter set ──
    [17, { name: "Bomb Scare", side: "villain", imgPath: "/cards/modular/bomb-scare/BombScare-SideScheme.png", tags: [], flavorText: "",
        type: "side-scheme", boostIcons: 2, startingThreat: 2, startingThreatIsPerPlayer: false,
        whenRevealedThreat: 1, whenRevealedThreatIsPerPlayer: true, acceleration: true }],
    [18, { name: "Hydra Bomber", side: "villain", imgPath: "/cards/modular/bomb-scare/HydraBomber-Minion.png", tags: ["hydra"], flavorText: "",
        type: "minion", boostIcons: 1, sch: 1, atk: 1, hitPoints: 2,
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

    // ── Expert I encounter set ──
    [21, { name: "Exhaustion", side: "villain", imgPath: "/cards/villains/standard/Exhaustion-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 2, surgeKeyword: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'exhaustIdentity' }] } }],
    [22, { name: "Masterplan", side: "villain", imgPath: "/cards/villains/standard/Masterplan-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [
                { op: 'addThreatToEachSideScheme', amount: 4 },
                { op: 'if', condition: { type: 'noActiveSideSchemes' }, then: { op: 'revealSideSchemeFromDeck' } }
            ] } }],
    [23, { name: "Under Fire", side: "villain", imgPath: "/cards/villains/standard/UnderFire-Treachery.png", tags: [], flavorText: `"But wait, there's more!" - Klaw`,
        type: "treachery", boostIcons: 3, surgeKeyword: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'revealTopEncounterCard' }] } }],

    // ── Klaw villain cards ──
    [24, { name: "Defense Network", side: "villain", imgPath: "/cards/villains/klaw/DefenseNetwork-SideScheme.png", tags: [], flavorText: `Klaw's criminal enterprise is protected by a gang of hired thugs.`,
        type: "side-scheme", boostIcons: 2, startingThreat: 2, startingThreatIsPerPlayer: false, crisis: true,
        whenRevealedThreat: 1, whenRevealedThreatIsPerPlayer: true }],
    [25, { name: `The "Immortal" Klaw`, side: "villain", imgPath: "/cards/villains/klaw/TheImmortalKlaw-SideScheme.png", tags: [], flavorText: `"You cannot destroy me—I am sound itself!" - Klaw`,
        type: "side-scheme", boostIcons: 2, startingThreat: 3, startingThreatIsPerPlayer: true, acceleration: true,
        whenRevealedEffects: [{ op: 'addVillainHp', amount: 10 }],
        whenDefeatedEffects: [{ op: 'addVillainHp', amount: -10 }] }],
    [26, { name: "Sonic Converter", side: "villain", imgPath: "/cards/villains/klaw/SonicConverter-Attachment.png", tags: ["weapon"], flavorText: "",
        type: "attachment", boostIcons: 3, atkMod: 1, retaliate: 0,
        removalCost: ["energy", "mental", "physical"] as const,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "VILLAIN_ATTACK_CONCLUDED",
            effects: [{ op: 'if', condition: { type: 'damageWasDealt' }, then: [{ op: 'stun', target: 'payloadTarget' }] }]
        }
    }],
    [27, { name: "Solid-Sound Body", side: "villain", imgPath: "/cards/villains/klaw/SolidSoundBody-Attachment.png", tags: ["condition"], flavorText: "",
        type: "attachment", boostIcons: 3, retaliate: 1,
        removalCost: ["energy", "mental", "physical"] as const,
    }],
    [28, { name: "Armored Guard", side: "villain", imgPath: "/cards/villains/klaw/ArmoredGuard-Minion.png", tags: ["mercenary"], flavorText: "",
        type: "minion", boostIcons: 1, sch: 0, atk: 1, hitPoints: 3, guard: true, toughOnEntry: true }],
    [29, { name: "Weapons Runner", side: "villain", imgPath: "/cards/villains/klaw/WeaponsRunner-Minion.png", tags: ["mercenary"], flavorText: "",
        type: "minion", boostIcons: 0, sch: 1, atk: 1, hitPoints: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "minionEntered",
            effects: [{ op: 'surge' }] },
        boostEffect: [{ op: 'putBoostCardIntoPlay' }] }],
    [30, { name: "Klaw's Vengeance", side: "villain", imgPath: "/cards/villains/klaw/KlawsVengeance-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 1,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{
                op: 'if', condition: { type: 'identityStatus', value: 'alter-ego' },
                then: [{ op: 'discardRandomFromHand' }],
                else: [{ op: 'sequence', effects: [
                    { op: 'villainAttack' },
                    { op: 'if', condition: { type: 'damageWasDealt' }, then: [{ op: 'addThreat', amount: 1 }] }
                ]}]
            }]
        }
    }],
    [31, { name: "Illegal Arms Factory", side: "villain", imgPath: "/cards/villains/klaw/IllegalArmsFactory-SideScheme.png", tags: [], flavorText: `Klaw is supplying villains with advanced weaponry from a clandestine arms facility.`,
        type: "side-scheme", boostIcons: 2, startingThreat: 3, startingThreatIsPerPlayer: false, hazard: true,
        whenRevealedThreat: 1, whenRevealedThreatIsPerPlayer: true }],
    [32, { name: "Sonic Boom", side: "villain", imgPath: "/cards/villains/klaw/SonicBoom-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 0,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'chooseOne', options: [
                { label: "Pay 1 Energy, 1 Mental, 1 Physical", condition: { type: 'canAffordResources', resources: ["energy", "mental", "physical"] }, effect: { op: 'payResources', resources: ["energy", "mental", "physical"] } },
                { label: "Exhaust each character you control", effect: { op: 'exhaustAllCharacters' } },
            ]}]
        },
        boostResponseEffect: [{ op: 'if', condition: { type: 'damageWasDealt' }, then: [{ op: 'exhaustIdentity' }] }],
    }],
    [33, { name: "Sound Manipulation", side: "villain", imgPath: "/cards/villains/klaw/SoundManipulation-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 2,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{
                op: 'if', condition: { type: 'identityStatus', value: 'alter-ego' },
                then: [{ op: 'if', condition: { type: 'targetHpFull', target: 'villain' },
                    then: [{ op: 'surge' }],
                    else: [{ op: 'heal', target: 'villain', amount: 4 }]
                }],
                else: [
                    { op: 'dealDamage', target: 'identity', amount: 2 },
                    { op: 'heal', target: 'villain', amount: 2 }
                ]
            }]
        }
    }],
    // ── Masters of Evil modular encounter set ──
    [34, { name: "The Masters of Evil", side: "villain", imgPath: "/cards/modular/the-masters-of-evil/TheMastersOfEvil-SideScheme.png", tags: [], flavorText: `The Masters of Evil have arrived to attack the heroes!`,
        type: "side-scheme", boostIcons: 2, startingThreat: 3, startingThreatIsPerPlayer: true, acceleration: true,
        whenRevealedEffects: [{ op: 'discardUntilTaggedMinionIntoPlay', tag: 'masters of evil' }] }],
    [35, { name: "Radioactive Man", side: "villain", imgPath: "/cards/modular/the-masters-of-evil/RadioactiveMan-Minion.png", tags: ["elite", "masters of evil"], flavorText: "",
        type: "minion", boostIcons: 0, sch: 1, atk: 1, hitPoints: 7,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "MINION_ATTACK",
            effects: [{ op: 'if', condition: { type: 'selfIsAttacker' }, then: [{ op: 'discardRandomFromHand' }] }]
        },
        boostResponseEffect: [{ op: 'discardRandomFromHand' }] }],
    [36, { name: "Whirlwind", side: "villain", imgPath: "/cards/modular/the-masters-of-evil/Whirlwind-Minion.png", tags: ["masters of evil"], flavorText: "",
        type: "minion", boostIcons: 0, sch: 1, atk: 2, hitPoints: 6,
        boostResponseEffect: [{ op: 'if', condition: { type: 'identityStatus', value: 'hero' }, then: [{ op: 'dealDamage', target: 'identity', amount: 1 }] }] }],
    [37, { name: "Tiger Shark", side: "villain", imgPath: "/cards/modular/the-masters-of-evil/TigerShark-Minion.png", tags: ["masters of evil"], flavorText: "",
        type: "minion", boostIcons: 0, sch: 1, atk: 3, hitPoints: 6,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "MINION_ATTACK",
            effects: [{ op: 'if', condition: { type: 'selfIsAttacker' }, then: [{ op: 'giveTough', target: 'self' }] }]
        },
        boostResponseEffect: [{ op: 'giveTough', target: 'villain' }] }],
    [38, { name: "Melter", side: "villain", imgPath: "/cards/modular/the-masters-of-evil/Melter-Minion.png", tags: ["masters of evil"], flavorText: "",
        type: "minion", boostIcons: 0, sch: 1, atk: 3, hitPoints: 5,
        boostResponseEffect: [{ op: 'exhaustAllAllies' }] }],
    [39, { name: "Masters of Mayhem", side: "villain", imgPath: "/cards/modular/the-masters-of-evil/MastersOfMayhem-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 2,
        logic: {
            type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{
                op: 'if', condition: { type: 'taggedMinionInPlay', tag: 'masters of evil' },
                then: [{ op: 'allTaggedMinionsAttack', tag: 'masters of evil' }],
                else: [
                    { op: 'searchForTaggedMinionIntoPlay', tag: 'masters of evil' },
                    { op: 'shuffleVillainDeck' },
                ]
            }]
        }
    }],

    // ── Spider-Man nemesis set ──
    [40, { name: "Highway Robbery", side: "villain", imgPath: "/cards/heroes/spider-man/nemesis/HighwayRobbery-SideScheme.png", tags: [], flavorText: "",
        type: "side-scheme", boostIcons: 3, startingThreat: 3, startingThreatIsPerPlayer: true, acceleration: true,
        whenRevealedEffects: [{ op: 'storeRandomHandCardOnScheme' }],
        whenDefeatedEffects: [{ op: 'returnHeldCardsToHand' }] }],
    [41, { name: "Vulture", side: "villain", imgPath: "/cards/heroes/spider-man/nemesis/Vulture-Minion.png", tags: ["criminal", "vulture"], flavorText: `"I'm faster, stronger, and smarter than a hundred men my age!"`,
        type: "minion", boostIcons: 2, sch: 1, atk: 3, hitPoints: 4,
        logic: { type: "response", forced: true, formRequired: "any", timing: "minionEntered",
            effects: [{ op: 'selfMinionAttack' }] } }],
    [42, { name: "Sweeping Swoop", side: "villain", imgPath: "/cards/heroes/spider-man/nemesis/SweepingSwoop-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 0,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [
                { op: 'stun', target: 'identity' },
                { op: 'if', condition: { type: 'taggedMinionInPlay', tag: 'vulture' }, then: [{ op: 'surge' }] }
            ] },
        boostResponseEffect: [{ op: 'if', condition: { type: 'damageWasDealt' }, then: [{ op: 'stun', target: 'payloadTarget' }] }] }],
    [43, { name: "The Vulture's Plans", side: "villain", imgPath: "/cards/heroes/spider-man/nemesis/TheVulturesPlans-Treachery.png", tags: [], flavorText: `"Spider-Man will pay for interfering with my plans!" - The Vulture`,
        type: "treachery", boostIcons: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'discardRandomAndThreatPerResourceType' }] } }],

    // ── She-Hulk nemesis set ──
    [44, { name: "Personal Challenge", side: "villain", imgPath: "/cards/heroes/she-hulk/nemesis/PersonalChallenge-SideScheme.png", tags: [], flavorText: `Titania has held a grudge against She-Hulk for years. She won't rest until she settles the score.`,
        type: "side-scheme", boostIcons: 3, startingThreat: 3, startingThreatIsPerPlayer: false, crisis: true,
        whenRevealedThreat: 1, whenRevealedThreatIsPerPlayer: true }],
    [45, { name: "Titania", side: "villain", imgPath: "/cards/heroes/she-hulk/nemesis/Titania-Minion.png", tags: ["brute", "elite", "titania"], flavorText: `"Face it, Greenie. There's only room for one strongest woman... and it ain't you!"`,
        type: "minion", boostIcons: 2, sch: 1, atk: 0, dynamicAtk: 'hitPointsRemaining' as const, hitPoints: 6 }],
    [46, { name: "Genetically Enhanced", side: "villain", imgPath: "/cards/heroes/she-hulk/nemesis/GeneticallyEnhanced-Attachment.png", tags: ["condition"], flavorText: "",
        type: "attachment", boostIcons: 1, attachmentTarget: 'highestHpMinion' as const, hpMod: 3 }],
    [47, { name: "Titania's Fury", side: "villain", imgPath: "/cards/heroes/she-hulk/nemesis/TitaniasFury-Treachery.png", tags: [], flavorText: "",
        type: "treachery", boostIcons: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [
                { op: 'taggedMinionAttacks', tag: 'titania' },
                { op: 'if', condition: { type: 'minionAttacked' }, then: [],
                    else: [{ op: 'healTaggedMinionFully', tag: 'titania' }, { op: 'surge' }] }
            ] },
        boostEffect: [{ op: 'addBoostCard' }] }],

    // ── Obligations ──
    [48, { name: "Legal Work", side: "villain", imgPath: "/cards/heroes/she-hulk/LegalWork-Obligation.png", tags: [], flavorText: "",
        type: "obligation", boostIcons: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'chooseOne', options: [
                { label: "Exhaust Jennifer Walters → Remove Legal Work from game",
                  condition: { type: 'identityNotExhausted' },
                  effect: { op: 'sequence', effects: [{ op: 'exhaustIdentity' }, { op: 'removeFromGame' }] } },
                { label: "Add 1 acceleration token. Discard this obligation.",
                  effect: { op: 'addAccelerationToken', amount: 1 } }
            ]}] } }],
    [49, { name: "Eviction Notice", side: "villain", imgPath: "/cards/heroes/spider-man/EvictionNotice-Obligation.png", tags: [], flavorText: "",
        type: "obligation", boostIcons: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'chooseOne', options: [
                { label: "Exhaust Peter Parker → Remove Eviction Notice from game",
                  condition: { type: 'identityNotExhausted' },
                  effect: { op: 'sequence', effects: [{ op: 'exhaustIdentity' }, { op: 'removeFromGame' }] } },
                { label: "Discard 1 card at random from your hand. Surge.",
                  effect: { op: 'sequence', effects: [{ op: 'discardRandomFromHand' }, { op: 'surge' }] } }
            ]}] } }],

    // ── Hawkeye obligation ──
    [73, { name: "Criminal Past", side: "villain", imgPath: "/cards/heroes/hawkeye/CriminalPast-Obligation.png", tags: [], flavorText: "",
        type: "obligation", boostIcons: 2,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'chooseOne', options: [
                { label: "Exhaust Clint Barton → Remove Criminal Past from game",
                  condition: { type: 'identityNotExhausted' },
                  effect: { op: 'sequence', effects: [{ op: 'exhaustIdentity' }, { op: 'removeFromGame' }] } },
                { label: "Discard Hawkeye's Bow from play (if in play).",
                  effect: { op: 'discardTableauCardByStorageId', storageId: 66, cardName: "Hawkeye's Bow" } }
            ]}] } }],

    // ── Hawkeye nemesis set ──
    [74, { name: "Crossfire", side: "villain", imgPath: "/cards/heroes/hawkeye/nemesis/Crossfire-Minion.png", tags: ["mercenary"], flavorText: ``,
        type: "minion", boostIcons: 0, sch: 1, atk: 2, hitPoints: 4, piercing: true,
        logic: { type: "response", forced: true, formRequired: "any", timing: "minionEntered",
            effects: [{ op: 'selfMinionAttack' }] },
        boostEffect: [{ op: 'makeAttackPiercing' }] }],
    [75, { name: "Marked For Death", side: "villain", imgPath: "/cards/heroes/hawkeye/nemesis/MarkedForDeath-SideScheme.png", tags: [], flavorText: ``,
        type: "side-scheme", boostIcons: 3, startingThreat: 5, startingThreatIsPerPlayer: false, acceleration: true,
        whenRevealedEffects: [{ op: 'searchAndAttachAllyToScheme', storageId: 68, cardName: "Mockingbird" }],
        whenDefeatedEffects: [{ op: 'returnHeldCardsToHand' }] }],
    [76, { name: "Crossfire's Rifle", side: "villain", imgPath: "/cards/heroes/hawkeye/nemesis/CrossfiresRifle-Attachment.png", tags: ["weapon"], flavorText: "",
        type: "attachment", boostIcons: 2, atkMod: 2, attachmentTag: "weapon",
        removal: { cost: 1, resourceType: 'wild' as const, formRequired: 'hero' as const } }],
    [77, { name: "Sniper Shot", side: "villain", imgPath: "/cards/heroes/hawkeye/nemesis/SniperShot-Treachery.png", tags: [], flavorText: `"I like to let them run a little before taking the shot." - Crossfire`,
        type: "treachery", boostIcons: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'if', condition: { type: 'identityStatus', value: 'hero' },
                then: [{ op: 'dealDamage', target: 'identity', amount: 3 }],
                else: [{ op: 'addThreat', amount: 3 }] }] } }],

    // ── Standard II encounter set ──────────────────────────────────────────────
    // 78/79: Pursued by the Past — environment; always in play, never in villain deck
    [78, { name: "Pursued by the Past", side: "villain", imgPath: "/cards/villains/standard/PursuedByThePast-EnvironmentSide1.png",
        tags: ["environment"], type: "environment", boostIcons: 0, flavorText: "" }],
    [79, { name: "Pursued by the Past", side: "villain", imgPath: "/cards/villains/standard/PursuedByThePast-EnvironmentSide2.png",
        tags: ["environment"], type: "environment", boostIcons: 0, flavorText: "" }],
    // 80: Dark Designs — 1 pursuit counter; then villain schemes if any counters; boost: 1 pursuit counter
    [80, { name: "Dark Designs", side: "villain", imgPath: "/cards/villains/standard/DarkDesigns-Treachery.png",
        tags: [], flavorText: "", type: "treachery", boostIcons: 0,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'addPursuitCounters', amount: 1 }, { op: 'villainSchemesIfPursuitCounters' }] },
        boostEffect: [{ op: 'addPursuitCounters', amount: 1 }] }],
    // 81: Sinister Strike — 1 pursuit counter; alter-ego: surge if counters; hero: villain attacks if counters
    [81, { name: "Sinister Strike", side: "villain", imgPath: "/cards/villains/standard/SinisterStrike-Treachery.png",
        tags: [], flavorText: "", type: "treachery", boostIcons: 1,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [
                { op: 'addPursuitCounters', amount: 1 },
                { op: 'if',
                  condition: { type: 'identityStatus', value: 'alter-ego' },
                  then: [{ op: 'gainSurgeIfPursuitCounters' }],
                  else: [{ op: 'villainAttacksIfPursuitCounters' }] },
            ] } }],
    // 82: Evil Alliance — each nemesis minion activates; if none activated: 3 pursuit counters; boost: 1 counter
    [82, { name: "Evil Alliance", side: "villain", imgPath: "/cards/villains/standard/EvilAlliance-Treachery.png",
        tags: [], flavorText: "", type: "treachery", boostIcons: 0,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'activateNemesisMinionsOrAddCounters' }] },
        boostEffect: [{ op: 'addPursuitCounters', amount: 1 }] }],
    // 83: Nowhere Is Safe — 1 pursuit counter; then discard upgrade/support if any counters; boost: 1 counter
    [83, { name: "Nowhere Is Safe", side: "villain", imgPath: "/cards/villains/standard/NowhereIsSafe-Treachery.png",
        tags: [], flavorText: "", type: "treachery", boostIcons: 0,
        logic: { type: "response", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'addPursuitCounters', amount: 1 }, { op: 'discardUpgradeOrSupportIfPursuitCounters' }] },
        boostEffect: [{ op: 'addPursuitCounters', amount: 1 }] }],
    // 84: Drawing Nearer — obligation placed in player tableau at game start; not in villain deck
    [84, { name: "Drawing Nearer", side: "villain", imgPath: "/cards/villains/standard/DrawingNearer-Obligation.png",
        tags: [], flavorText: "", type: "obligation", boostIcons: 2 }],

    // ── Colossus nemesis set ──────────────────────────────────────────────────
    [94, {
        name: "Homesick", side: "villain", type: "obligation", boostIcons: 2,
        imgPath: "/cards/heroes/colossus/nemesis/Homesick-Obligation.png",
        tags: [], flavorText: "",
        logic: {
            type: "action", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [
                { op: 'chooseOne', options: [
                    {
                        label: "Exhaust Colossus \u2192 Remove Homesick from game",
                        effect: { op: 'sequence', effects: [
                            { op: 'exhaustIdentity' },
                            { op: 'removeFromGame' }
                        ] }
                    },
                    {
                        label: "Discard all Tough from Colossus; Surge for each missing Tough",
                        effect: { op: 'discardAllFriendlyTough', surgePerMissing: true }
                    }
                ] }
            ]
        }
    }],
    [95, {
        name: "Juggernaut", side: "villain", type: "minion", boostIcons: 1,
        imgPath: "/cards/heroes/colossus/nemesis/Juggernaut-Minion.png",
        tags: ["brute", "nemesis"], flavorText: "",
        hitPoints: 8, sch: 1, atk: 4,
        stalwart: true,
        toughOnEntry: true,
        boostEffect: [
            { op: 'makeAttackPiercing' },
            { op: 'makeCurrentAttackOverkill' }
        ],
    }],
    [96, {
        name: "Rampaging Juggernaut", side: "villain", type: "side-scheme", boostIcons: 1,
        imgPath: "/cards/heroes/colossus/nemesis/RampagingJuggernaut-SideScheme.png",
        tags: ["nemesis"], flavorText: "",
        startingThreat: 0, startingThreatIsPerPlayer: false,
        crisis: false, hazard: false, acceleration: false,
        amplify: true,
        whenRevealedEffects: [
            { op: 'discardAllFriendlyToughAndAddThreat', threatPerCard: 2 }
        ],
    }],
    [97, {
        name: "Unstoppable", side: "villain", type: "attachment", boostIcons: 1,
        imgPath: "/cards/heroes/colossus/nemesis/Unstoppable-Attachment.png",
        tags: ["nemesis"], flavorText: "",
        attachmentTarget: "highestAtkEnemy",
        logics: [
            {
                type: "interrupt", forced: true, formRequired: "any", timing: "MINION_ATTACK",
                effects: [
                    { op: 'if', condition: { type: 'attachedToAttacker' }, then: [
                        { op: 'makeCurrentAttackPiercing' },
                        { op: 'makeCurrentAttackOverkill' }
                    ] }
                ]
            },
            {
                type: "response", forced: true, formRequired: "any", timing: "MINION_ATTACK",
                effects: [
                    { op: 'if', condition: { type: 'attachedToAttacker' }, then: [
                        { op: 'discardSelf' }
                    ] }
                ]
            },
            {
                type: "interrupt", forced: true, formRequired: "any", timing: "VILLAIN_ATTACK",
                effects: [
                    { op: 'makeCurrentAttackPiercing' },
                    { op: 'makeCurrentAttackOverkill' }
                ]
            },
            {
                type: "response", forced: true, formRequired: "any", timing: "VILLAIN_ATTACK_CONCLUDED",
                effects: [{ op: 'discardSelf' }]
            }
        ]
    }],
    [98, {
        name: "Slammed", side: "villain", type: "treachery", boostIcons: 1,
        imgPath: "/cards/heroes/colossus/nemesis/Slammed-Treachery.png",
        tags: ["nemesis"], flavorText: "",
        logic: {
            type: "action", forced: true, formRequired: "any", timing: "treacheryRevealed",
            effects: [{ op: 'stunAndDamage', normalAmount: 0, alreadyStunnedAmount: 2 }]
        },
        boostEffect: [{ op: 'revealBoostCardAsEncounterCard' }],
    }],
]);

export function getCardImgPathById(cardId: number): string {
    return cardMap.get(cardId)?.imgPath ?? "";
}

export function getVillainCardImgPathById(cardId: number): string {
    return villainCardMap.get(cardId)?.imgPath ?? "";
}

// ── Setup libraries ──

export const rhinoVillainCardIds  = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const standardICardIds        = [12, 12, 13, 13, 14, 15, 16];
// Standard II treacheries (shuffled into villain deck); environment (78) placed in play at start; obligation (84) shuffled 1x per player
export const standardIICardIds       = [80, 80, 81, 81, 82, 83, 83];  // shuffled into villain deck
export const standardIIEnvironmentId = 78;   // Pursued by the Past Side A — placed in play at game start
export const standardIIObligationId  = 84;   // Drawing Nearer — 1 copy per player shuffled in; placed in tableau when revealed
export const expertICardIds          = [21, 22, 23];
export const bombScareCardIds     = [17, 18, 18, 19, 20, 20];
export const klawVillainCardIds   = [24, 25, 26, 27, 28, 28, 29, 29, 30, 30, 31, 32, 32, 33, 33];
export const mastersOfEvilCardIds = [34, 35, 36, 37, 38, 39, 39];
export const spiderManNemesisIds  = [41, 40, 42, 42, 43];
export const sheHulkNemesisIds    = [45, 44, 46, 47, 47];
export const colossusHeroDeckIds  = [85, 86, 87, 87, 88, 88, 89, 89, 90, 90, 91, 91, 92, 92, 93];
export const colossusNemesisIds   = [95, 96, 97, 97, 98, 98];

export const heroLibrary = [
    {
        id: 1,
        name: "Spider-Man",
        heroDeckIds: [1, 2, 2, 3, 3, 4, 4, 4, 5, 6, 6, 7, 7, 8, 8],
        primaryColor:   '#b01020',
        secondaryColor: '#1565c0',
        nemesisSet: { minionStorageId: 41, sideSchemeStorageId: 40, otherStorageIds: [42, 42, 43] },
        obligationId: 49,
    },
    {
        id: 2,
        name: "She-Hulk",
        heroDeckIds: [22, 23, 24, 24, 25, 25, 26, 26, 26, 27, 28, 29, 29, 30, 30],
        primaryColor:   '#2e7d32',
        secondaryColor: '#7b1fa2',
        nemesisSet: { minionStorageId: 45, sideSchemeStorageId: 44, otherStorageIds: [46, 47, 47] },
        obligationId: 48,
    },
    {
        id: 3,
        name: "Hawkeye",
        heroDeckIds: [66, 67, 68, 69, 69, 70, 70, 71, 71, 72, 72, 73, 73, 74, 74],
        primaryColor: '#7b52a6',
        secondaryColor: '#ab119e',
        nemesisSet: { minionStorageId: 74, sideSchemeStorageId: 75, otherStorageIds: [76, 77, 77] },
        obligationId: 73,
    },
    {
        id: 4,
        name: "Colossus",
        heroDeckIds: colossusHeroDeckIds,
        primaryColor: '#b71c1c',
        secondaryColor: '#37474f',
        nemesisSet: { minionStorageId: 95, sideSchemeStorageId: 96, otherStorageIds: [97, 97, 98, 98] },
        obligationId: 94,
    },
];

export const villainLibrary = [
    {
        id: 1,
        name: "Rhino",
        imgPath: "/cards/villains/rhino/Rhino-Phase1.png",
        expertImgPath: "/cards/villains/rhino/Rhino-Phase2.png",
        mainSchemeId: 1,
        villainDeckIds: rhinoVillainCardIds,
        standardPhaseChain: [1, 2],
        expertPhaseChain:   [2, 3],
        color: '#b8bcc4',
    },
    {
        id: 2,
        name: "Klaw",
        imgPath: "/cards/villains/klaw/Klaw-Phase1.png",
        expertImgPath: "/cards/villains/klaw/Klaw-Phase2.png",
        mainSchemeId: 2,
        villainDeckIds: klawVillainCardIds,
        standardPhaseChain: [4, 5],
        expertPhaseChain:   [5, 6],
        color: '#2d0a6b',
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
    {
        id: 2,
        name: "The Masters of Evil",
        imgPath: "/cards/misc/villain-card-back.png",
        description: "The Masters of Evil have arrived to attack the heroes!",
        cardIds: mastersOfEvilCardIds,
    },
];
