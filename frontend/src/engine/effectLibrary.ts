import type { EffectDef, EffectTarget, EffectCondition, Resource } from "../types/card";
import { cardMap } from "../cards/cardStore";
import { createHandCard } from "../cards/cardFactory";

// ======================== PUBLIC API ========================

export async function executeEffects(effects: EffectDef | EffectDef[], state: any, context: any): Promise<void> {
    const list = Array.isArray(effects) ? effects : [effects];
    for (const effect of list) {
        await executeEffect(effect, state, context);
    }
}

export async function executeEffect(effect: EffectDef, state: any, context: any): Promise<void> {
    switch (effect.op) {

        case 'dealDamage': {
            const targetId = await resolveTargetId(effect.target, state, context);
            if (!targetId) return;
            const damagePayload = {
                amount: effect.amount,
                targetId,
                isCanceled: false,
                source: context.sourceCard ?? 'effect'
            };
            await state.emitEvent('ENTITY_TAKES_DAMAGE', damagePayload, async () => {
                if (!damagePayload.isCanceled && damagePayload.amount > 0)
                    await state.applyDamageToEntity(damagePayload);
            });
            const target = state.findTargetById(targetId);
            if (target && target.type === 'minion' && target.hitPointsRemaining <= 0) {
                await state.discardFromEngagedMinions(target.instanceId);
            }
            break;
        }

        case 'heal': {
            const target = resolveTargetEntity(effect.target, state, context);
            if (!target) return;
            const maxHp = target.hitPoints ?? target.hitPointsPerPlayer ?? 0;
            const before = target.hitPointsRemaining ?? 0;
            target.hitPointsRemaining = Math.min(maxHp, before + effect.amount);
            state.addLog(`Healed ${target.hitPointsRemaining - before} on ${target.name}.`, 'heal');
            break;
        }

        case 'drawCards': {
            for (let i = 0; i < effect.amount; i++) {
                await state.drawCardFromDeck();
            }
            break;
        }

        case 'stun': {
            const target = resolveTargetEntity(effect.target, state, context);
            if (target) {
                target.stunned = true;
                state.addLog(`${target.name} is stunned.`, 'status');
            }
            break;
        }

        case 'giveTough': {
            const target = resolveTargetEntity(effect.target, state, context);
            if (target) {
                target.tough = true;
                state.addLog(`${target.name} gained Tough.`, 'status');
            }
            break;
        }

        case 'removeThreat': {
            const targetId = await resolveTargetId(effect.target, state, context);
            if (!targetId) return;
            const scheme = state.findSchemeById(targetId);
            if (!scheme) return;
            if (scheme.type === 'main-scheme' && state.hasCrisisScheme) {
                state.addLog("Cannot remove threat from main scheme while Crisis is active.", 'system');
                return;
            }
            scheme.threatRemaining = Math.max(0, scheme.threatRemaining - effect.amount);
            state.addLog(`Removed ${effect.amount} threat from ${scheme.name}. Remaining: ${scheme.threatRemaining}`, 'threat');
            if (scheme.type === 'side-scheme' && scheme.threatRemaining === 0)
                await state.discardSideScheme(scheme.instanceId);
            break;
        }

        case 'generateResource': {
            context.generatedResource = effect.resourceType;
            state.addLog(`Generated ${effect.resourceType} resource.`, 'system');
            break;
        }

        case 'villainAttack': {
            const atkBonus = (state.villainCard?.attachments ?? [])
                .reduce((sum: number, att: any) => sum + (att.atkMod ?? 0), 0);
            const attackPayload = {
                attacker: state.villainCard?.name ?? 'Villain',
                baseDamage: (state.villainCard?.atk ?? 0) + atkBonus,
                boostDamage: 0,
                isDefended: false,
                targetType: 'identity',
                targetId: 'hero',
                isCanceled: false,
                damageWasDealt: false,
                overkill: (state.villainCard?.attachments ?? []).some((att: any) => att.overkill)
            };
            await state.villainActivationAttack(attackPayload);
            if (effect.stunOnHit && attackPayload.damageWasDealt) {
                if (attackPayload.targetType === 'identity') {
                    state.hero.stunned = true;
                    state.addLog("Hero was stunned by villain attack.", 'status');
                } else if (attackPayload.targetType === 'ally') {
                    const ally = state.tableauCards.find((c: any) => c.instanceId === attackPayload.targetId);
                    if (ally) { ally.stunned = true; state.addLog(`${ally.name} was stunned.`, 'status'); }
                }
            }
            break;
        }

        case 'villainScheme': {
            const schemeMod = (state.villainCard?.attachments ?? [])
                .reduce((sum: number, att: any) => sum + (att.thwMod ?? 0), 0);
            const schemePayload = {
                baseThreat: (state.villainCard?.sch ?? 0) + schemeMod,
                boostThreat: 0,
                isCanceled: false,
            };
            await state.villainActivationScheme(schemePayload);
            break;
        }

        case 'preventAttack': {
            if (context.attackPayload) context.attackPayload.isCanceled = true;
            else context.isCanceled = true;
            break;
        }

        case 'cancelDamage': {
            context.amount = 0;
            context.isCanceled = true;
            context.isResolved = true;
            state.addLog("Damage canceled.", 'damage');
            break;
        }

        case 'reduceDamage': {
            context.amount = Math.max(0, (context.amount ?? 0) - effect.amount);
            if (context.amount === 0) context.isCanceled = true;
            context.isResolved = true;
            state.addLog(`Damage reduced by ${effect.amount}. Remaining: ${context.amount}`, 'damage');
            break;
        }

        case 'cancelEffect': {
            context.isCanceled = true;
            context.isResolved = true;
            state.addLog("Effect canceled.", 'system');
            break;
        }

        case 'discardSelf': {
            const card = context.sourceCard ?? context.attachment;
            if (!card) return;
            const attacker = context.attacker;
            if (attacker?.attachments) {
                attacker.attachments = attacker.attachments.filter((a: any) => a.instanceId !== card.instanceId);
            }
            if (state.villainCard?.attachments) {
                state.villainCard.attachments = state.villainCard.attachments.filter(
                    (a: any) => a.instanceId !== card.instanceId
                );
            }
            if (card.storageId != null) {
                if (card.side === 'villain') state.villainDiscardIds.push(card.storageId);
                else state.playerDiscardIds.push(card.storageId);
            }
            state.addLog(`${card.name} discarded.`, 'discard');
            break;
        }

        case 'discardTopDeck': {
            const discarded: number[] = [];
            for (let i = 0; i < effect.amount; i++) {
                if (state.deckIds.length === 0) state.shuffleDiscardPileIntoDrawPile();
                if (state.deckIds.length > 0) discarded.push(state.deckIds.shift()!);
            }
            for (const cardId of discarded) {
                const blueprint = cardMap.get(cardId);
                if (effect.addToHandIfHasResource && blueprint?.resources?.includes(effect.addToHandIfHasResource)) {
                    state.hand.push(createHandCard(cardId, state.getNextId()));
                    state.addLog(`${blueprint.name} has ${effect.addToHandIfHasResource} — added to hand.`, 'draw');
                } else {
                    state.playerDiscardIds.push(cardId);
                    state.addLog(`${blueprint?.name ?? cardId} discarded.`, 'discard');
                }
            }
            break;
        }

        case 'decrementCounter': {
            const card = context.sourceCard;
            if (!card || card.counters <= 0) return;
            card.counters--;
            state.addLog(`${card.name} counter decremented. Remaining: ${card.counters}`, 'system');
            if (effect.discardIfEmpty && card.counters <= 0) {
                state.discardFromTableau(card.instanceId);
                state.addLog(`${card.name} discarded — no counters left.`, 'discard');
            }
            break;
        }

        case 'exhaust': {
            if (context.sourceCard) {
                context.sourceCard.exhausted = true;
                state.addLog(`${context.sourceCard.name} exhausted.`, 'status');
            }
            break;
        }

        case 'surge': {
            context.surge = true;
            state.addLog("Surge triggered.", 'surge');
            break;
        }

        case 'addThreat': {
            await state.applyThreatToMainScheme({ amount: effect.amount, source: 'encounter', isCanceled: false });
            break;
        }

        case 'redirectDamage': {
            const suit = context.sourceCard ?? state.villainCard?.attachments?.find(
                (a: any) => a.instanceId === context.sourceCard?.instanceId
            );
            if (!suit) return;
            const amount = context.amount ?? 0;
            suit.damageAccumulated = (suit.damageAccumulated ?? 0) + amount;
            context.amount = 0;
            context.isCanceled = true;
            state.addLog(`${suit.name} absorbed ${amount} damage. Total: ${suit.damageAccumulated}`, 'damage');
            if (effect.discardAt != null && suit.damageAccumulated >= effect.discardAt) {
                if (state.villainCard?.attachments) {
                    state.villainCard.attachments = state.villainCard.attachments.filter(
                        (a: any) => a.instanceId !== suit.instanceId
                    );
                }
                if (suit.storageId != null) state.villainDiscardIds.push(suit.storageId);
                state.addLog(`${suit.name} broke apart and was discarded.`, 'discard');
            }
            break;
        }

        case 'if': {
            if (evaluateCondition(effect.condition, state, context)) {
                await executeEffects(effect.then, state, context);
            } else if (effect.else) {
                await executeEffects(effect.else, state, context);
            }
            break;
        }

        case 'sequence': {
            await executeEffects(effect.effects, state, context);
            break;
        }

        default: {
            const _exhaustive: never = effect;
            state.addLog(`Unknown effect op: ${(_exhaustive as any).op}`, 'system');
        }
    }
}

// ======================== PRIVATE HELPERS ========================

/** Returns the actual entity object (for mutation like stunned, tough, hp). */
function resolveTargetEntity(target: EffectTarget, state: any, context: any): any | null {
    switch (target) {
        case 'identity':      return state.hero;
        case 'villain':       return state.villainCard;
        case 'attachedEnemy':
        case 'attacker':      return context.attacker ?? null;
        default:              return null; // choose* targets require ID resolution, not entity
    }
}

/** Returns the instanceId/key needed for damage/threat targeting — prompts player for choose* targets. */
async function resolveTargetId(target: EffectTarget, state: any, context: any): Promise<any> {
    switch (target) {
        case 'identity':      return state.hero?.instanceId ?? 'hero';
        case 'villain':       return state.villainCard?.instanceId;
        case 'attachedEnemy':
        case 'attacker':      return context.attacker?.instanceId ?? null;
        case 'chooseEnemy':   return await state.requestTarget(context.sourceCard, 'enemy');
        case 'chooseScheme':  return await state.requestTarget(context.sourceCard, 'scheme');
    }
}

function evaluateCondition(condition: EffectCondition, state: any, context: any): boolean {
    switch (condition.type) {
        case 'identityStatus':
            return state.hero?.identityStatus === condition.value;
        case 'targetHpFull': {
            const entity = resolveTargetEntity(condition.target, state, context);
            if (!entity) return false;
            const max = entity.hitPoints ?? entity.hitPointsPerPlayer ?? 0;
            return (entity.hitPointsRemaining ?? 0) >= max;
        }
        case 'targetHasTough': {
            const entity = resolveTargetEntity(condition.target, state, context);
            return entity?.tough === true;
        }
        case 'damageWasDealt':
            return context.damageWasDealt === true;
    }
}
