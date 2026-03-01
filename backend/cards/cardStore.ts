import type { IdentityCard, PlayerCard, VillainIdentityCard, MainScheme, VillainCard } from "../../frontend/src/types/card";

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
            effects: [{ op: 'stun', target: 'chooseEnemy' }]
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
        tags: ["android", "avenger"], resources: ["energy"], flavorText: "",
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
            formRequired: "any",
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
            effects: [{ op: 'surge' }] } }],

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
export const expertICardIds       = [21, 22, 23];
export const bombScareCardIds     = [17, 18, 18, 19, 20, 20];

export const heroLibrary = [
    {
        id: 1,
        name: "Spider-Man",
        heroDeckIds: [1, 2, 2, 3, 3, 4, 4, 4, 5, 6, 6, 7, 7, 8, 8],
        primaryColor:   '#b01020',
        secondaryColor: '#1565c0',
    },
    {
        id: 2,
        name: "She-Hulk",
        heroDeckIds: [22, 23, 24, 24, 25, 25, 26, 26, 26, 27, 28, 29, 29, 30, 30],
        primaryColor:   '#2e7d32',
        secondaryColor: '#7b1fa2',
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
