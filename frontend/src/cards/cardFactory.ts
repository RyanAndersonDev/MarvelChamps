import type { PlayerCardInstance, Ally, Event, Upgrade, Support, IdentityCardInstance } from '../types/card';
import { cardMap, idCardMap } from './cardStore';

// ************* HAND CARDS *************
export function createHandCard(cardId: number, instanceId: number) : Ally | Event | Upgrade | Support {
    const blueprint : PlayerCardInstance | undefined = cardMap.get(cardId);
    

    if (!blueprint)
        throw new Error(`Card ID ${cardId} not found in the map.`);

    blueprint!.storageId = cardId;

    return printHandCard(blueprint, instanceId);
}

function printHandCard(blueprint: PlayerCardInstance, id: number): Ally | Event | Upgrade | Support {
    const base = {
        instanceId: id,
        storageId: blueprint.storageId,
        name: blueprint.name,
        side: blueprint.side,
        type: blueprint.type,
        cost: blueprint.cost,
        aspect: blueprint.aspect,
        imgPath: blueprint.imgPath,
        resources: blueprint.resources
    };

    switch (blueprint.type) {
        case 'ally':
            return {
                ...base,
                exhausted: false,
                health: blueprint.health ?? 1000,
                hpLeft: blueprint.health ?? 1000,
                stunned: false,
                confused: false,
                tough: false
            } as Ally;

        case 'event':
            return {
                ...base,
                tags: blueprint.tags ?? []
            } as Event;

        case 'upgrade':
            return {
                ...base,
                exhausted: false,
                counters: blueprint.counters ?? 0
            } as Upgrade;

        case 'support':
            return {
                ...base,
                exhausted: false
            } as Support;

        default:
            throw new Error(`Unhandled card type: ${blueprint.type}`);
    }
}

// ************* TABLEAU CARDS *************
export function createTableauCard(cardId: number, cardsInTableau: number) : Ally | Upgrade | Support {
    const blueprint : PlayerCardInstance | undefined = cardMap.get(cardId);

    if (!blueprint)
        throw new Error(`Card ID ${cardId} not found in the map.`);

    return printTableauCard(blueprint, cardsInTableau);
}

function printTableauCard(blueprint: PlayerCardInstance, id: number): Ally | Upgrade | Support {
    const base = {
        instanceId: id,
        name: blueprint.name,
        side: blueprint.side,
        type: blueprint.type,
        cost: blueprint.cost,
        aspect: blueprint.aspect,
        imgPath: blueprint.imgPath,
    };

    switch (blueprint.type) {
        case 'ally':
            return {
                ...base,
                exhausted: false,
                health: blueprint.health ?? 1000,
                hpLeft: blueprint.health ?? 1000
            } as Ally;

        case 'upgrade':
            return {
                ...base,
                exhausted: false,
                counters: blueprint.counters ?? 0
            } as Upgrade;

        case 'support':
            return {
                ...base,
                exhausted: false
            } as Support;

        default:
            throw new Error(`Unhandled card type: ${blueprint.type}`);
    }
}

// ************* IDENTITY CARDS *************
export function createIdentityCard(cardId: number) : IdentityCardInstance {
    const blueprint : IdentityCardInstance | undefined = idCardMap.get(cardId);

    if (!blueprint)
        throw new Error(`Card ID ${cardId} not found in the map.`);

    return printIdentityCard(blueprint);
}

function printIdentityCard (blueprint: IdentityCardInstance): IdentityCardInstance {
    blueprint.hitPointsRemaining = blueprint.hitPoints;
    blueprint.exhausted = false;
    blueprint.identityStatus = "alter-ego";
    blueprint.status = "ready";

    return blueprint;
}
