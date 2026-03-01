import type { EffectDef, EffectTarget, EffectCondition, Ally } from "../../shared/types/card";
import { cardMap, villainCardMap } from "../cards/cardStore";
import { createHandCard, createVillainCard, createTableauCard } from "../cards/cardFactory";
import type { GameRoom } from "./GameRoom";

// ======================== RESOURCE UTILITIES ========================

/**
 * Returns true if `paid` satisfies all `required` resources, with wild
 * substituting for any unmet typed requirement.
 * Algorithm: match typed-to-typed first, then backfill unmet slots with wilds.
 */
export function satisfiesResourceRequirements(required: string[], paid: string[]): boolean {
    const remaining = [...paid];
    const unmet: string[] = [];

    for (const req of required) {
        const idx = remaining.indexOf(req);
        if (idx >= 0) {
            remaining.splice(idx, 1);
        } else {
            unmet.push(req);
        }
    }

    for (const _ of unmet) {
        const wildIdx = remaining.indexOf('wild');
        if (wildIdx >= 0) {
            remaining.splice(wildIdx, 1);
        } else {
            return false;
        }
    }

    return true;
}

// ======================== PUBLIC API ========================

export async function executeEffects(effects: EffectDef | EffectDef[], state: GameRoom, context: any): Promise<void> {
    const list = Array.isArray(effects) ? effects : [effects];
    for (const effect of list) {
        if (context.actionBlocked) break;
        await executeEffect(effect, state, context);
    }
}

export async function executeEffect(effect: EffectDef, state: GameRoom, context: any): Promise<void> {
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
            if (target && 'type' in target && target.type === 'minion' && target.hitPointsRemaining <= 0) {
                await state.discardFromEngagedMinions(target.instanceId);
            }
            break;
        }

        case 'heal': {
            let target = resolveTargetEntity(effect.target, state, context);
            if (!target) {
                const targetId = await resolveTargetId(effect.target, state, context);
                if (targetId) target = state.findTargetById(targetId) as any;
            }
            if (!target) return;
            const maxHp = target.hitPoints ?? target.hitPointsPerPlayer ?? (target as any).health ?? 0;
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
            state.generatedResources.push(effect.resourceType);
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
            if (state.villainCard?.stunned) {
                state.addLog(`${state.villainCard.name} is stunned — attack skipped, stun removed.`, 'status');
                state.villainCard.stunned = false;
                break;
            }
            const atkBonus = (state.villainCard?.attachments ?? [])
                .reduce((sum: number, att: any) => sum + (att.atkMod ?? 0), 0);
            const attackPayload = {
                attacker: state.villainCard?.name ?? 'Villain',
                baseDamage: (state.villainCard?.atk ?? 0) + atkBonus,
                boostDamage: 0,
                isDefended: false,
                targetType: 'identity',
                targetId: 'hero' as string | number,
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
                    const ally = state.tableauCards.find((c): c is Ally => c.type === 'ally' && c.instanceId === (attackPayload.targetId as number));
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
            context.surge = (context.surge ?? 0) + 1;
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
                    targetId: enemy!.instanceId,
                    isCanceled: false,
                    source: context.sourceCard ?? 'effect'
                };
                await state.emitEvent('ENTITY_TAKES_DAMAGE', damagePayload, async () => {
                    if (!damagePayload.isCanceled && damagePayload.amount > 0)
                        await state.applyDamageToEntity(damagePayload);
                });
                if (enemy!.type === 'minion' && enemy!.hitPointsRemaining <= 0) {
                    await state.discardFromEngagedMinions(enemy!.instanceId);
                }
            }
            if (effect.includeAllCharacters) {
                // Hero identity
                await state.applyDamageToEntity({ targetId: state.hero.instanceId, amount: effect.amount });
                state.addLog(`${state.hero.name} took ${effect.amount} damage.`, 'damage');
                // Tableau allies
                for (const card of [...state.tableauCards]) {
                    if (card.type === 'ally') {
                        await state.applyDamageToEntity({ targetId: card.instanceId!, amount: effect.amount });
                        if ((card as any).hitPointsRemaining <= 0)
                            await state.handleAllyDefeat(card as any);
                    }
                }
            }
            break;
        }

        case 'dynamicDamage': {
            const hero = state.hero;
            let amount: number;
            if (effect.formula === 'heroAtk') {
                amount = Math.min(effect.max, state.effectiveAtk);
            } else {
                const damageSustained = (hero.hitPoints ?? 0) - (hero.hitPointsRemaining ?? 0);
                amount = Math.min(effect.max, Math.max(0, damageSustained));
                if (amount <= 0) {
                    state.addLog('No damage sustained, effect fizzles.', 'system');
                    break;
                }
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
            if (dTarget && 'type' in dTarget && dTarget.type === 'minion' && dTarget.hitPointsRemaining <= 0) {
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
            const selectedIds = await state.requestHandDiscard(effect.max, 'LEGAL PRACTICE', `Discard up to ${effect.max} card${effect.max !== 1 ? 's' : ''} — each removes 1 threat from ${scheme.name}.`);
            if (selectedIds === null) break;
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

        case 'exhaustIdentity': {
            state.hero.exhausted = true;
            state.addLog(`${state.hero.name} is exhausted.`, 'status');
            break;
        }

        case 'addThreatToEachSideScheme': {
            for (const scheme of state.activeSideSchemes) {
                scheme.threatRemaining += effect.amount;
                state.addLog(`Added ${effect.amount} threat to ${scheme.name}. Total: ${scheme.threatRemaining}`, 'threat');
            }
            break;
        }

        case 'revealSideSchemeFromDeck': {
            let found = false;
            while (!found) {
                const cardId = state.drawOneVillainCard();
                if (cardId === null) break;
                const blueprint = villainCardMap.get(cardId);
                if (blueprint?.type === 'side-scheme') {
                    const instance = createVillainCard(cardId, state.getNextId());
                    await state.handleSideSchemeEntry(instance);
                    found = true;
                } else {
                    state.villainDiscardIds.push(cardId);
                    state.addLog(`${blueprint?.name ?? cardId} discarded (searching for side scheme).`, 'villain');
                }
            }
            if (!found) state.addLog('No side scheme found in the encounter deck.', 'villain');
            break;
        }

        case 'revealTopEncounterCard': {
            state.drawFromVillainDeckAsEncounterCard();
            state.addLog('Revealed the top card of the encounter deck.', 'villain');
            break;
        }

        case 'fetchAndRevealVillainCard': {
            const blueprint = villainCardMap.get(effect.storageId);
            const name = blueprint?.name ?? String(effect.storageId);

            let found = false;
            const deckIdx = state.villainDeckIds.lastIndexOf(effect.storageId);
            if (deckIdx !== -1) {
                state.villainDeckIds.splice(deckIdx, 1);
                found = true;
            } else {
                const discardIdx = state.villainDiscardIds.lastIndexOf(effect.storageId);
                if (discardIdx !== -1) {
                    state.villainDiscardIds.splice(discardIdx, 1);
                    found = true;
                }
            }

            if (found) {
                state.addLog(`${name} fetched and put into play.`, 'villain');
                const instance = createVillainCard(effect.storageId, state.getNextId());
                switch (blueprint?.type) {
                    case 'side-scheme':  await state.handleSideSchemeEntry(instance);    break;
                    case 'minion':       await state.handleMinionEntry(instance);         break;
                    case 'attachment':   await state.handleAttachmentEntry(instance);     break;
                    case 'treachery':    await state.handleTreacheryResolution(instance); break;
                }
            } else {
                state.addLog(`${name} not found in encounter deck or discard — skipping.`, 'villain');
            }
            break;
        }

        case 'shuffleVillainDeck': {
            state.shufflePile(state.villainDeckIds);
            state.addLog(`Encounter deck shuffled.`, 'villain');
            break;
        }

        case 'dealDamageOverkill': {
            const targetId = await resolveTargetId(effect.target, state, context);
            if (!targetId) break;
            const target = state.findTargetById(targetId);
            if (!target || !('hitPointsRemaining' in target)) break;
            const hpBefore = (target as any).hitPointsRemaining ?? 0;
            const damagePayload = { amount: effect.amount, targetId, isCanceled: false, source: context.sourceCard ?? 'effect' };
            await state.emitEvent('ENTITY_TAKES_DAMAGE', damagePayload, async () => {
                if (!damagePayload.isCanceled && damagePayload.amount > 0)
                    await state.applyDamageToEntity(damagePayload);
            });
            if ('type' in target && target.type === 'minion' && (target as any).hitPointsRemaining <= 0)
                await state.discardFromEngagedMinions(target.instanceId);
            // Overkill: excess damage beyond target's HP goes to villain
            if (!damagePayload.isCanceled && state.villainCard) {
                const excess = damagePayload.amount - hpBefore;
                if (excess > 0) {
                    state.addLog(`Overkill: ${excess} damage to ${state.villainCard.name}.`, 'damage');
                    await state.applyDamageToEntity({ targetId: state.villainCard.instanceId, amount: excess });
                }
            }
            break;
        }

        case 'discardTopDeckBranch': {
            if (state.deckIds.length === 0) state.shuffleDiscardPileIntoDrawPile();
            if (state.deckIds.length === 0) { state.addLog('Deck is empty — no card to discard.', 'system'); break; }
            const cardId = state.deckIds.shift()!;
            const blueprint = cardMap.get(cardId);
            state.playerDiscardIds.push(cardId);
            state.addLog(`${blueprint?.name ?? `Card #${cardId}`} discarded (${context.sourceCard?.name ?? 'ability'}).`, 'discard');
            const resourceType = blueprint?.resources?.[0] ?? null;
            const branches = effect.effects;
            if (resourceType === 'wild') {
                for (const key of ['physical', 'energy', 'mental'] as const) {
                    const branch = branches[key];
                    if (branch) await executeEffects(branch, state, context);
                }
            } else if (resourceType && branches[resourceType as keyof typeof branches]) {
                await executeEffects(branches[resourceType as keyof typeof branches]!, state, context);
            } else {
                state.addLog(`No branch for resource type: ${resourceType ?? 'none'}.`, 'system');
            }
            break;
        }

        case 'readyAlly': {
            const targetId = await state.requestTarget(context.sourceCard, 'ally');
            if (!targetId) break;
            const target = state.tableauCards.find((c: any) => c.type === 'ally' && c.instanceId === targetId) as any;
            if (target) {
                target.exhausted = false;
                state.addLog(`${target.name} readied.`, 'status');
            }
            break;
        }

        case 'modifyAllyStat': {
            const targetId = effect.target === 'self'
                ? context.sourceCard?.instanceId
                : await resolveTargetId(effect.target, state, context);
            if (!targetId) break;
            const target = state.tableauCards.find((c: any) => c.type === 'ally' && c.instanceId === targetId) as any;
            if (!target) break;
            if (!target.attachments) target.attachments = [];
            const mod: any = { name: `+${effect.amount} ${effect.stat}`, temporary: true };
            if (effect.stat === 'atk') mod.atkMod = effect.amount;
            else if (effect.stat === 'thw') mod.thwMod = effect.amount;
            target.attachments.push(mod);
            state.addLog(`${target.name} gets +${effect.amount} ${effect.stat} until end of phase.`, 'status');
            break;
        }

        case 'boostAllCharacters': {
            // Hero: accumulate into temp fields so clearTemporaryAllyMods can undo them
            if (effect.stat === 'both' || effect.stat === 'atk')
                (state.playerIdentity as any).tempAtkMod = ((state.playerIdentity as any).tempAtkMod ?? 0) + effect.amount;
            if (effect.stat === 'both' || effect.stat === 'thw')
                (state.playerIdentity as any).tempThwMod = ((state.playerIdentity as any).tempThwMod ?? 0) + effect.amount;
            // Allies: push a temporary attachment (same pattern as modifyAllyStat)
            for (const card of state.tableauCards) {
                if (card.type !== 'ally') continue;
                const ally = card as any;
                if (!ally.attachments) ally.attachments = [];
                const mod: any = { name: 'Lead From The Front', temporary: true };
                if (effect.stat === 'both' || effect.stat === 'atk') mod.atkMod = effect.amount;
                if (effect.stat === 'both' || effect.stat === 'thw') mod.thwMod = effect.amount;
                ally.attachments.push(mod);
            }
            state.addLog(`All characters get +${effect.amount} ${effect.stat === 'both' ? 'ATK and THW' : effect.stat}.`, 'status');
            break;
        }

        case 'putAllyFromDiscardIntoPlay': {
            const seen = new Set<number>();
            const allyOptions: { id: number; name: string }[] = [];
            for (const sid of state.playerDiscardIds) {
                if (seen.has(sid)) continue;
                const bp = cardMap.get(sid);
                if (bp?.type === 'ally') {
                    seen.add(sid);
                    allyOptions.push({ id: sid, name: bp.name });
                }
            }
            if (allyOptions.length === 0) {
                state.addLog('No allies in discard to put into play.', 'system');
                break;
            }
            const chosen = await state.requestChoice('Choose an ally to put into play', allyOptions);
            if (!chosen || chosen.id === 'none') break;
            const storageId = chosen.id as number;
            const idx = state.playerDiscardIds.lastIndexOf(storageId);
            if (idx !== -1) state.playerDiscardIds.splice(idx, 1);
            const tableauAlly = createTableauCard(storageId, state.getNextId());
            state.tableauCards.push(tableauAlly);
            state.addLog(`${chosen.name} put into play from discard.`, 'play');
            break;
        }

        case 'redirectThreatAsDamage': {
            const amount = context.amount ?? 0;
            if (amount <= 0) break;
            context.amount = 0;
            context.isCanceled = true;
            await state.applyDamageToEntity({ targetId: state.hero.instanceId, amount });
            state.addLog(`${amount} threat redirected as damage to ${state.hero.name}.`, 'damage');
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

function resolveTargetEntity(target: EffectTarget, state: GameRoom, context: any): any | null {
    switch (target) {
        case 'identity':      return state.hero;
        case 'villain':       return state.villainCard;
        case 'self':          return context.sourceCard ?? null;
        case 'attachedEnemy':
        case 'attacker':      return context.attacker ?? null;
        case 'chooseFriendly': return null; // requires async; handled via resolveTargetId fallback
        default:              return null;
    }
}

async function resolveTargetId(target: EffectTarget, state: GameRoom, context: any): Promise<any> {
    switch (target) {
        case 'identity':      return state.hero?.instanceId ?? 'hero';
        case 'villain':       return state.villainCard?.instanceId;
        case 'self':          return context.sourceCard?.instanceId ?? null;
        case 'attachedEnemy':
        case 'attacker':      return context.attacker?.instanceId ?? null;
        case 'chooseEnemy':              return await state.requestTarget(context.sourceCard, 'enemy');
        case 'chooseEnemyIgnoreGuard':   return await state.requestTarget(context.sourceCard, 'enemy-ignore-guard');
        case 'chooseMinion':             return await state.requestTarget(context.sourceCard, 'minion');
        case 'chooseScheme':             return await state.requestTarget(context.sourceCard, 'scheme');
        case 'chooseFriendly':           return await state.requestTarget(context.sourceCard, 'friendly');
        case 'payloadTarget': return context.targetId ?? null;
    }
}

function evaluateCondition(condition: EffectCondition, state: GameRoom, context: any): boolean {
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
        case 'heroDefended':
            return context.heroDefended === true;
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
        case 'noActiveSideSchemes':
            return state.activeSideSchemes.length === 0;
        case 'selfIsAttacker':
            return (context.source as any)?.instanceId === context.sourceCard?.instanceId;
        case 'targetWasDefeated':
            return context.targetDefeated === true;
        case 'targetIsMinion':
            return (context.target as any)?.type === 'minion';
        case 'activeCardIsAspect':
            return state.activeCard?.aspect === condition.aspect;
        case 'paidWithResource': {
            const paid = (context.paymentResources as string[] | undefined) ?? [];
            return satisfiesResourceRequirements([condition.resource], paid);
        }
        case 'paidWithResources': {
            const paid = (context.paymentResources as string[] | undefined) ?? [];
            return satisfiesResourceRequirements(condition.resources, paid);
        }
        case 'selfHasCounters':
            return ((context.sourceCard as any)?.counters ?? 0) > 0;
    }
}
