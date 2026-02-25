import type { EffectDef, EffectTarget, EffectCondition, Resource } from "../types/card";
import { cardMap } from "../cards/cardStore";
import { createHandCard } from "../cards/cardFactory";

// ======================== PUBLIC API ========================

export async function executeEffects(effects: EffectDef | EffectDef[], state: any, context: any): Promise<void> {
    const list = Array.isArray(effects) ? effects : [effects];
    for (const effect of list) {
        if (context.actionBlocked) break;
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
            let target = resolveTargetEntity(effect.target, state, context);
            if (!target) {
                const targetId = await resolveTargetId(effect.target, state, context);
                if (targetId) target = state.findTargetById(targetId);
            }
            if (target) {
                target.stunned = true;
                state.addLog(`${target.name} is stunned.`, 'status');
            }
            break;
        }

        case 'confuse': {
            const target = resolveTargetEntity(effect.target, state, context);
            if (target) {
                target.confused = true;
                state.addLog(`${target.name} is confused.`, 'status');
            }
            break;
        }

        case 'chooseOne': {
            const options = effect.options.map((o: any, i: number) => ({ id: String(i), name: o.label }));
            const chosen = await state.requestChoice('Choose one', options);
            const idx = effect.options.findIndex((_: any, i: number) => String(i) === chosen?.id);
            if (idx >= 0) await executeEffect(effect.options[idx]!.effect, state, context);
            break;
        }

        case 'dealDamageBySideSchemeThreat': {
            const scheme = state.activeSideSchemes.find((ss: any) => ss.name === effect.schemeName);
            if (!scheme) break;
            const amount = scheme.threatRemaining;
            if (amount > 0) {
                const targetId = await resolveTargetId(effect.target, state, context);
                await state.applyDamageToEntity({ targetId, amount });
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
                context.actionBlocked = true;
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

        case 'reduceCostNextPlay': {
            state.pendingCostReduction = (state.pendingCostReduction ?? 0) + 1;
            state.addLog(`Next card played costs 1 less this phase.`, 'system');
            break;
        }

        case 'clearStatus': {
            const target = resolveTargetEntity(effect.target, state, context);
            if (target) {
                target.stunned = false;
                target.confused = false;
                state.addLog(`${target.name}'s status effects cleared.`, 'status');
            }
            break;
        }

        case 'readyIdentity': {
            state.hero.exhausted = false;
            state.addLog(`${state.hero.name} is readied.`, 'status');
            break;
        }

        case 'shuffleSelfIntoDeck': {
            const card = context.sourceCard;
            if (!card) return;
            state.tableauCards = state.tableauCards.filter((c: any) => c.instanceId !== card.instanceId);
            if (card.storageId != null) {
                const insertAt = Math.floor(Math.random() * (state.deckIds.length + 1));
                state.deckIds.splice(insertAt, 0, card.storageId);
                state.addLog(`${card.name} shuffled back into the deck.`, 'system');
            }
            context.isCanceled = true;
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

        case 'allEnemiesAttack': {
            await state.villainActivationAttack({
                attacker: state.villainCard?.name ?? 'Villain',
                baseDamage: (state.villainCard?.atk ?? 0) + (state.villainCard?.attachments ?? []).reduce((s: number, a: any) => s + (a.atkMod ?? 0), 0),
                boostDamage: 0, isDefended: false, targetType: 'identity', targetId: 'hero',
                isCanceled: false, damageWasDealt: false,
                overkill: (state.villainCard?.attachments ?? []).some((a: any) => a.overkill),
            });
            for (const minion of [...state.engagedMinions]) {
                await state.minionActivationAttack(minion);
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
            state.tableauCards = state.tableauCards.filter((a: any) => a.instanceId !== card.instanceId);
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

        case 'discardTableauCard': {
            const candidates = state.tableauCards.filter((c: any) => effect.types.includes(c.type));
            if (candidates.length === 0) {
                if (effect.surgeIfNone) {
                    context.surge = true;
                    state.addLog("No valid cards to discard — surge triggered.", 'surge');
                }
                break;
            }
            const options = candidates.map((c: any) => ({ id: c.instanceId, name: c.name, imgPath: c.imgPath, cost: c.cost }));
            const chosen = await state.requestChoice('Discard an upgrade or support', options);
            if (chosen?.id !== 'none') {
                state.discardFromTableau(chosen.id);
            }
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

        case 'addDefBonus': {
            context.defBonus = (context.defBonus ?? 0) + effect.amount;
            state.addLog(`+${effect.amount} DEF for this attack.`, 'status');
            break;
        }

        case 'preventThreat': {
            const before = context.amount ?? 0;
            context.amount = Math.max(0, before - effect.amount);
            if (context.amount === 0) context.isCanceled = true;
            state.addLog(`Prevented ${Math.min(effect.amount, before)} threat. (${before} → ${context.amount})`, 'threat');
            break;
        }

        case 'dealDamageToAll': {
            const enemies = [state.villainCard, ...state.engagedMinions].filter(Boolean);
            for (const enemy of enemies) {
                const damagePayload = {
                    amount: effect.amount,
                    targetId: enemy.instanceId,
                    isCanceled: false,
                    source: context.sourceCard ?? 'effect'
                };
                await state.emitEvent('ENTITY_TAKES_DAMAGE', damagePayload, async () => {
                    if (!damagePayload.isCanceled && damagePayload.amount > 0)
                        await state.applyDamageToEntity(damagePayload);
                });
                if (enemy.type === 'minion' && enemy.hitPointsRemaining <= 0) {
                    await state.discardFromEngagedMinions(enemy.instanceId);
                }
            }
            break;
        }

        case 'dynamicDamage': {
            const hero = state.hero;
            const damageSustained = (hero.hitPoints ?? 0) - (hero.hitPointsRemaining ?? 0);
            const amount = Math.min(effect.max, Math.max(0, damageSustained));
            if (amount <= 0) {
                state.addLog('Gamma Slam — no damage sustained, effect fizzles.', 'system');
                break;
            }
            const targetId = await resolveTargetId(effect.target, state, context);
            if (!targetId) break;
            const damagePayload = {
                amount,
                targetId,
                isCanceled: false,
                source: context.sourceCard ?? 'effect'
            };
            await state.emitEvent('ENTITY_TAKES_DAMAGE', damagePayload, async () => {
                if (!damagePayload.isCanceled && damagePayload.amount > 0)
                    await state.applyDamageToEntity(damagePayload);
            });
            const dTarget = state.findTargetById(targetId);
            if (dTarget && dTarget.type === 'minion' && dTarget.hitPointsRemaining <= 0) {
                await state.discardFromEngagedMinions(dTarget.instanceId);
            }
            break;
        }

        case 'returnAllyToHand': {
            const card = context.sourceCard;
            if (!card) break;
            state.tableauCards = state.tableauCards.filter((c: any) => c.instanceId !== card.instanceId);
            if (card.storageId != null) {
                state.hand.push(createHandCard(card.storageId, state.getNextId()));
                state.addLog(`${card.name} returned to hand.`, 'system');
            }
            break;
        }

        case 'flipForm': {
            const wasHero = state.hero.identityStatus === 'hero';
            state.hero.identityStatus = wasHero ? 'alter-ego' : 'hero';
            state.addLog(`Flipped to ${state.hero.identityStatus}.`, 'system');
            if (!wasHero) {
                await state.checkTriggers('response', 'FLIP_TO_HERO', {});
            }
            break;
        }

        case 'drawToHandSize': {
            const limit = state.currentHandSizeLimit;
            while (state.hand.length < limit) {
                await state.drawCardFromDeck();
            }
            break;
        }

        case 'selfDamage': {
            await state.applyDamageToEntity({ targetId: state.hero.instanceId, amount: effect.amount });
            state.addLog(`${state.hero.name} took ${effect.amount} self-damage.`, 'damage');
            break;
        }

        case 'discardHandForThreat': {
            const targetId = await resolveTargetId('chooseScheme', state, context);
            if (!targetId) break;
            const scheme = state.findSchemeById(targetId);
            if (!scheme) break;
            if (scheme.type === 'main-scheme' && state.hasCrisisScheme) {
                state.addLog("Cannot remove threat from main scheme while Crisis is active.", 'system');
                break;
            }
            const selectedIds: number[] = await state.requestHandDiscard(effect.max);
            for (const id of selectedIds) {
                const card = state.hand.find((c: any) => c.instanceId === id);
                if (card) {
                    state.hand = state.hand.filter((c: any) => c.instanceId !== id);
                    if (card.storageId != null) state.playerDiscardIds.push(card.storageId);
                    state.addLog(`${card.name} discarded.`, 'discard');
                }
            }
            if (selectedIds.length > 0) {
                scheme.threatRemaining = Math.max(0, scheme.threatRemaining - selectedIds.length);
                state.addLog(`Removed ${selectedIds.length} threat from ${scheme.name}.`, 'threat');
                if (scheme.type === 'side-scheme' && scheme.threatRemaining === 0)
                    await state.discardSideScheme(scheme.instanceId);
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
        case 'payloadTarget': return context.targetId ?? null;
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
        case 'damageCanceled':
            return context.isCanceled === true;
        case 'noDamageDealt':
            return context.damageWasDealt !== true;
        case 'wasDefended':
            return context.isDefended === true;
        case 'sideSchemeInPlay':
            return state.activeSideSchemes.some((ss: any) => ss.name === condition.name);
        case 'targetIsConfused': {
            const entity = resolveTargetEntity(condition.target, state, context);
            return entity?.confused === true;
        }
        case 'payloadTargetAlive': {
            const target = state.findTargetById(context.targetId);
            return target != null && (target.hitPointsRemaining === undefined || target.hitPointsRemaining > 0);
        }
    }
}
