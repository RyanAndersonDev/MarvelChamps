import type { PlayerCardInstance, Ally, Event, Upgrade, Support } from '../types/card';
import { cardMap } from './cardStore';

export function createHandCard(cardId: number, cardsInDeck: number) : Ally | Event | Upgrade | Support {
    const blueprint : PlayerCardInstance | undefined = cardMap.get(cardId);

    if (!blueprint)
        throw new Error(`Card ID ${cardId} not found in the map.`);

    return printHandCard(blueprint, cardsInDeck);
}

export function createTableauCard(cardId: number, cardsInTableau: number) : Ally | Upgrade | Support {
    const blueprint : PlayerCardInstance | undefined = cardMap.get(cardId);

    if (!blueprint)
        throw new Error(`Card ID ${cardId} not found in the map.`);

    return printTableauCard(blueprint, cardsInTableau);
}

function printHandCard(blueprint: PlayerCardInstance, id: number): Ally | Event | Upgrade | Support {
    const base = {
        id: id,
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

function printTableauCard(blueprint: PlayerCardInstance, id: number): Ally | Upgrade | Support {
    const base = {
        id: id,
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

