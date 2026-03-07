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
            context.lastResolvedTargetId = targetId;
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
            // Retaliate fires for attack events, unless the event has the "arrow" tag and
            // a rangedForArrowEvents upgrade (Hawkeye's Bow) is in the tableau.
            const src = context.sourceCard;
            if (src?.type === 'event' && src?.tags?.includes('attack')) {
                const isArrow = src.tags?.includes('arrow');
                const hasRangedUpgrade = state.tableauCards.some((c: any) => c.rangedForArrowEvents);
                const isRanged = isArrow && hasRangedUpgrade;
                if (!isRanged) {
                    const retaliateAmt = state.getRetaliateAmount(targetId);
                    if (retaliateAmt > 0) {
                        state.addLog(`Retaliate ${retaliateAmt}! ${state.hero.name} takes ${retaliateAmt} damage.`, 'damage');
                        await state.applyDamageToEntity({ targetId: state.hero.instanceId, amount: retaliateAmt });
                    }
                }
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

        case 'searchAndAddToHand': {
            // Search deck then discard for a card by storageId; add to hand, shuffle deck
            const sid: number = effect.storageId;
            const label: string = effect.cardName ?? 'card';
            const deckIdx = state.deckIds.indexOf(sid);
            if (deckIdx >= 0) {
                state.deckIds.splice(deckIdx, 1);
                state.hand.push(createHandCard(sid, state.getNextId()));
                state.shufflePile(state.deckIds);
                state.addLog(`Found ${label} in deck — added to hand. Deck shuffled.`, 'play');
                break;
            }
            const discardIdx = state.playerDiscardIds.indexOf(sid);
            if (discardIdx >= 0) {
                state.playerDiscardIds.splice(discardIdx, 1);
                state.hand.push(createHandCard(sid, state.getNextId()));
                state.shufflePile(state.deckIds);
                state.addLog(`Found ${label} in discard — added to hand. Deck shuffled.`, 'play');
                break;
            }
            state.addLog(`${label} not found in deck or discard.`, 'system');
            break;
        }

        case 'readyUpgradeByStorageId': {
            const label: string = effect.cardName ?? 'upgrade';
            const upgrade = state.tableauCards.find(c => (c as any).storageId === effect.storageId);
            if (!upgrade) {
                state.addLog(`${label} is not in play — action blocked.`, 'system');
                context.actionBlocked = true;
            } else if (!(upgrade as any).exhausted) {
                state.addLog(`${label} is already ready.`, 'system');
            } else {
                (upgrade as any).exhausted = false;
                state.addLog(`${label} readied.`, 'play');
            }
            break;
        }

        case 'exhaustUpgradeByStorageId': {
            const label: string = effect.cardName ?? 'upgrade';
            const upgrade = state.tableauCards.find(c => (c as any).storageId === effect.storageId);
            if (!upgrade) {
                state.addLog(`${label} is not in play — action blocked.`, 'system');
                context.actionBlocked = true;
            } else if ((upgrade as any).exhausted) {
                state.addLog(`${label} is already exhausted — action blocked.`, 'system');
                context.actionBlocked = true;
            } else {
                (upgrade as any).exhausted = true;
                state.addLog(`${label} exhausted.`, 'play');
            }
            break;
        }

        case 'confuseAndDamage': {
            const targetId = await resolveTargetId('chooseEnemyIgnoreGuard' as any, state, context);
            if (!targetId) break;
            const target = state.findTargetById(targetId);
            if (!target) break;
            const wasConfused = !!(target as any).confused;
            (target as any).confused = true;
            state.addLog(`${target.name} is confused.`, 'status');
            const dmgAmount = wasConfused ? effect.alreadyConfusedAmount : effect.normalAmount;
            const dmgPayload = { amount: dmgAmount, targetId, isCanceled: false, source: context.sourceCard ?? 'effect' };
            await state.emitEvent('ENTITY_TAKES_DAMAGE', dmgPayload, async () => {
                if (!dmgPayload.isCanceled && dmgPayload.amount > 0) await state.applyDamageToEntity(dmgPayload);
            });
            if ((target as any).type === 'minion' && target.hitPointsRemaining! <= 0)
                await state.discardFromEngagedMinions(target.instanceId!);
            // Retaliate — skipped if arrow event + bow in play (ranged)
            const src69 = context.sourceCard;
            if (src69?.type === 'event' && src69?.tags?.includes('attack')) {
                const isRanged = src69.tags?.includes('arrow') && state.tableauCards.some((c: any) => c.rangedForArrowEvents);
                if (!isRanged) {
                    const ret = state.getRetaliateAmount(targetId);
                    if (ret > 0) {
                        state.addLog(`Retaliate ${ret}! ${state.hero.name} takes ${ret} damage.`, 'damage');
                        await state.applyDamageToEntity({ targetId: state.hero.instanceId, amount: ret });
                    }
                }
            }
            break;
        }

        case 'dealDamagePiercing': {
            const targetId = await resolveTargetId(effect.target, state, context);
            if (!targetId) break;
            const target = state.findTargetById(targetId);
            if (!target) break;
            // Piercing: remove tough but still deal full damage
            if ((target as any).tough) {
                (target as any).tough = false;
                state.addLog(`${target.name} lost Tough (piercing).`, 'status');
            }
            const piercingPayload = { amount: effect.amount, targetId, isCanceled: false, source: context.sourceCard ?? 'effect' };
            await state.emitEvent('ENTITY_TAKES_DAMAGE', piercingPayload, async () => {
                if (!piercingPayload.isCanceled && piercingPayload.amount > 0) await state.applyDamageToEntity(piercingPayload);
            });
            if ((target as any).type === 'minion' && target.hitPointsRemaining! <= 0)
                await state.discardFromEngagedMinions(target.instanceId!);
            // Retaliate — skipped if ranged arrow
            const src71 = context.sourceCard;
            if (src71?.type === 'event' && src71?.tags?.includes('attack')) {
                const isRanged = src71.tags?.includes('arrow') && state.tableauCards.some((c: any) => c.rangedForArrowEvents);
                if (!isRanged) {
                    const ret = state.getRetaliateAmount(targetId);
                    if (ret > 0) {
                        state.addLog(`Retaliate ${ret}! ${state.hero.name} takes ${ret} damage.`, 'damage');
                        await state.applyDamageToEntity({ targetId: state.hero.instanceId, amount: ret });
                    }
                }
            }
            break;
        }

        case 'removeThreatIgnoreCrisis': {
            const targetId = await state.requestTarget(context.sourceCard, 'scheme');
            if (!targetId) break;
            if (targetId === state.mainScheme!.instanceId) {
                state.mainScheme!.threatRemaining = Math.max(0, state.mainScheme!.threatRemaining - effect.amount);
                state.addLog(`Removed ${effect.amount} threat from ${state.mainScheme!.name} (ignoring crisis).`, 'threat');
            } else {
                const ss = state.activeSideSchemes.find(s => s.instanceId === targetId);
                if (ss) {
                    ss.threatRemaining = Math.max(0, ss.threatRemaining - effect.amount);
                    state.addLog(`Removed ${effect.amount} threat from ${ss.name}.`, 'threat');
                    if (ss.threatRemaining === 0) await state.discardSideScheme(ss.instanceId);
                }
            }
            break;
        }

        case 'attachArrowFromTopDeck': {
            const top5 = state.deckIds.slice(0, 5);
            const arrowIds = top5.filter(id => {
                const bp = cardMap.get(id);
                return bp?.type === 'event' && (bp as any).tags?.includes('arrow');
            });
            if (arrowIds.length === 0) {
                state.addLog('No arrow events in the top 5 cards. Deck shuffled.', 'system');
                state.shufflePile(state.deckIds);
                break;
            }
            let chosenId: number;
            if (arrowIds.length === 1) {
                chosenId = arrowIds[0]!;
            } else {
                const opts = arrowIds.map(id => ({ id, name: cardMap.get(id)?.name ?? `Card ${id}`, imgPath: cardMap.get(id)?.imgPath ?? '' }));
                const pick = await state.requestChoice("Attach which arrow event to Hawkeye's Quiver?", opts);
                chosenId = pick?.id ?? arrowIds[0]!;
            }
            state.deckIds.splice(state.deckIds.indexOf(chosenId), 1);
            const quiver = state.tableauCards.find((c: any) => c.storageId === 67);
            if (quiver) {
                if (!(quiver as any).attachedCards) (quiver as any).attachedCards = [];
                (quiver as any).attachedCards.push(createHandCard(chosenId, state.getNextId()));
                state.addLog(`${cardMap.get(chosenId)?.name ?? 'Arrow event'} attached to Hawkeye's Quiver.`, 'play');
            }
            state.shufflePile(state.deckIds);
            break;
        }

        case 'payAnyResource': {
            const cardName = context.sourceCard?.name ?? 'ability';
            if (!state.hand.some((c: any) => c.resources?.length > 0)) {
                state.addLog(`No resources in hand — cannot pay for ${cardName}.`, 'system');
                context.actionBlocked = true;
                break;
            }
            const paid = await state.requestHandDiscard(1, 'RESOURCE COST', `Discard any resource card to pay for ${cardName}.`, undefined);
            if (!paid || paid.length === 0) { context.actionBlocked = true; break; }
            const paidCard = state.hand.find((c: any) => c.instanceId === paid[0]);
            state.hand = state.hand.filter((c: any) => c.instanceId !== paid[0]);
            if (paidCard?.storageId != null) state.playerDiscardIds.push(paidCard.storageId);
            state.addLog(`${paidCard?.name} discarded as resource.`, 'discard');
            break;
        }

        case 'discardTableauCardByStorageId': {
            const idx = state.tableauCards.findIndex((c: any) => c.storageId === effect.storageId);
            if (idx === -1) {
                const name = effect.cardName ?? `storageId ${effect.storageId}`;
                state.addLog(`${name} is not in play — cannot discard it.`, 'system');
                break;
            }
            const [removed] = state.tableauCards.splice(idx, 1);
            state.playerDiscardIds.push(effect.storageId);
            state.addLog(`${(removed as any).name} discarded from play.`, 'discard');
            break;
        }

        case 'searchAndAttachAllyToScheme': {
            const targetScheme = context.sourceCard as any;
            if (!targetScheme) { state.addLog(`searchAndAttachAllyToScheme: no source scheme in context.`, 'system'); break; }
            if (!targetScheme.heldCards) targetScheme.heldCards = [];
            const allyBp = cardMap.get(effect.storageId);
            const allyName = effect.cardName ?? allyBp?.name ?? `Card ${effect.storageId}`;

            // Search tableau first (ally in play), then hand, then discard, then deck
            const inTableau = state.tableauCards.findIndex((c: any) => c.storageId === effect.storageId && c.type === 'ally');
            if (inTableau !== -1) {
                state.tableauCards.splice(inTableau, 1);
                targetScheme.heldCards.push(effect.storageId);
                state.addLog(`${allyName} removed from play and placed under ${targetScheme.name}.`, 'villain');
                break;
            }

            // Search hand, then discard, then deck
            const inHand = state.hand.findIndex((c: any) => c.storageId === effect.storageId);
            if (inHand !== -1) {
                state.hand.splice(inHand, 1);
                targetScheme.heldCards.push(effect.storageId);
                state.addLog(`${allyName} removed from hand and placed under ${targetScheme.name}.`, 'villain');
                break;
            }
            const inDiscard = state.playerDiscardIds.indexOf(effect.storageId);
            if (inDiscard !== -1) {
                state.playerDiscardIds.splice(inDiscard, 1);
                targetScheme.heldCards.push(effect.storageId);
                state.addLog(`${allyName} removed from discard and placed under ${targetScheme.name}.`, 'villain');
                break;
            }
            const inDeck = state.deckIds.indexOf(effect.storageId);
            if (inDeck !== -1) {
                state.deckIds.splice(inDeck, 1);
                state.shufflePile(state.deckIds);
                targetScheme.heldCards.push(effect.storageId);
                state.addLog(`${allyName} removed from deck and placed under ${targetScheme.name}. Deck shuffled.`, 'villain');
                break;
            }
            state.addLog(`${allyName} not found in hand, discard, or deck.`, 'system');
            break;
        }

        case 'makeAttackPiercing': {
            state.pendingPiercingBoost = true;
            state.addLog(`Attack gains Piercing!`, 'villain');
            break;
        }

        case 'dealDamageToVillainAndEngaged': {
            // Deal damage to villain
            const villainId = state.villainCard?.instanceId;
            if (villainId) {
                const vp = { amount: effect.amount, targetId: villainId, isCanceled: false, source: context.sourceCard ?? 'effect' };
                await state.emitEvent('ENTITY_TAKES_DAMAGE', vp, async () => {
                    if (!vp.isCanceled && vp.amount > 0) await state.applyDamageToEntity(vp);
                });
            }
            // Deal damage to each minion engaged with the CURRENT player only
            const engagedSnapshot = [...state.engagedMinions];
            for (const minion of engagedSnapshot) {
                if (!state.engagedMinions.some(m => m.instanceId === minion.instanceId)) continue;
                const mp = { amount: effect.amount, targetId: minion.instanceId, isCanceled: false, source: context.sourceCard ?? 'effect' };
                await state.emitEvent('ENTITY_TAKES_DAMAGE', mp, async () => {
                    if (!mp.isCanceled && mp.amount > 0) await state.applyDamageToEntity(mp);
                });
                if (minion.hitPointsRemaining <= 0)
                    await state.discardFromEngagedMinions(minion.instanceId);
            }
            break;
        }

        case 'stunAndDamage': {
            const targetId = await resolveTargetId('chooseEnemyIgnoreGuard', state, context);
            if (!targetId) break;
            const target = state.findTargetById(targetId) as any;
            if (!target) break;
            const alreadyStunned = !!target.stunned;
            target.stunned = true;
            state.addLog(`${target.name} is ${alreadyStunned ? 'already' : 'now'} stunned.`, 'status');
            const dmgAmount = alreadyStunned ? effect.alreadyStunnedAmount : effect.normalAmount;
            const stunDmgPayload = { amount: dmgAmount, targetId, isCanceled: false, source: context.sourceCard ?? 'effect' };
            await state.emitEvent('ENTITY_TAKES_DAMAGE', stunDmgPayload, async () => {
                if (!stunDmgPayload.isCanceled && stunDmgPayload.amount > 0) await state.applyDamageToEntity(stunDmgPayload);
            });
            if ((target as any).type === 'minion' && target.hitPointsRemaining <= 0)
                await state.discardFromEngagedMinions(target.instanceId);
            break;
        }

        case 'stun': {
            let target = resolveTargetEntity(effect.target, state, context);
            if (!target) {
                const targetId = await resolveTargetId(effect.target, state, context);
                if (targetId) target = state.findTargetById(targetId);
            }
            if (target) {
                if ((target as any).stalwart) {
                    state.addLog(`${target.name} is Stalwart — immune to stun.`, 'status');
                } else {
                    target.stunned = true;
                    state.addLog(`${target.name} is stunned.`, 'status');
                }
            }
            break;
        }

        case 'confuse': {
            const target = resolveTargetEntity(effect.target, state, context);
            if (target) {
                if ((target as any).stalwart) {
                    state.addLog(`${target.name} is Stalwart — immune to confuse.`, 'status');
                } else {
                    target.confused = true;
                    state.addLog(`${target.name} is confused.`, 'status');
                }
            }
            break;
        }

        case 'chooseOne': {
            // Filter out options whose condition is not satisfied
            const available = effect.options.filter((o: any) =>
                !o.condition || evaluateCondition(o.condition, state, context)
            );
            if (available.length === 0) break;
            if (available.length === 1) {
                // Only one valid option — auto-resolve
                await executeEffect(available[0]!.effect, state, context);
                break;
            }
            const promptOptions = available.map((o: any, i: number) => ({ id: String(i), name: o.label }));
            const chosen = await state.requestChoice('Choose one', promptOptions);
            const idx = available.findIndex((_: any, i: number) => String(i) === chosen?.id);
            if (idx >= 0) await executeEffect(available[idx]!.effect, state, context);
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
                const maxTough = (target as any).maxToughCounters ?? 1;
                const currentTough = (target as any).toughCounters ?? (target.tough ? 1 : 0);
                if (currentTough < maxTough) {
                    (target as any).toughCounters = currentTough + 1;
                    target.tough = true;
                    state.addLog(`${target.name} gained Tough (${(target as any).toughCounters}/${maxTough}).`, 'status');
                } else {
                    state.addLog(`${target.name} already at max Tough.`, 'status');
                }
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
            if (attackPayload.damageWasDealt) context.damageWasDealt = true;
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
            const inHeroFormAll = state.hero.identityStatus === 'hero';
            if (inHeroFormAll) {
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
            } else {
                await state.villainActivationScheme({
                    attacker: state.villainCard?.name ?? 'Villain',
                    baseThreat: state.villainCard?.sch ?? 0,
                    boostThreat: 0, isCanceled: false,
                });
                for (const minion of [...state.engagedMinions]) {
                    await state.minionActivationScheme(minion);
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
            const source = context.source;
            if (source?.attachments) {
                source.attachments = source.attachments.filter((a: any) => a.instanceId !== card.instanceId);
            }
            // Search all engaged minions across all player slots
            for (const slot of state.players.values()) {
                for (const minion of slot.engagedMinions) {
                    if (minion.attachments) {
                        minion.attachments = minion.attachments.filter((a: any) => a.instanceId !== card.instanceId);
                    }
                }
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
            if (!wasHero) await state.checkTriggers('response', 'FLIP_TO_HERO', {});
            if (wasHero)  await state.checkTriggers('response', 'FLIP_TO_AE',   {});
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

        // ── Standard II effect ops ────────────────────────────────────────────

        case 'addPursuitCounters': {
            await state.addPursuitCounters(effect.amount);
            break;
        }

        case 'villainSchemesIfPursuitCounters': {
            if (!state.activeEnvironmentCard || state.activeEnvironmentCard.counters <= 0) break;
            state.addLog(`Pursued by the Past has counters — villain schemes!`, 'villain');
            const sch = (state.villainCard?.sch ?? 0);
            await state.villainActivationScheme({ attacker: state.villainCard?.name ?? 'Villain', baseThreat: sch, isCanceled: false });
            break;
        }

        case 'gainSurgeIfPursuitCounters': {
            if (!state.activeEnvironmentCard || state.activeEnvironmentCard.counters <= 0) break;
            state.addLog(`Pursued by the Past has counters — Sinister Strike surges!`, 'villain');
            context.surge = (context.surge ?? 0) + 1;
            break;
        }

        case 'villainAttacksIfPursuitCounters': {
            if (!state.activeEnvironmentCard || state.activeEnvironmentCard.counters <= 0) break;
            state.addLog(`Pursued by the Past has counters — villain attacks!`, 'villain');
            if (!state.villainCard) break;
            const atkBonus = (state.villainCard.attachments || [])
                .reduce((sum: number, att: any) => sum + (att.atkMod || 0), 0);
            const attackPayload = {
                attacker: state.villainCard.name,
                baseDamage: (state.villainCard.atk || 0) + atkBonus,
                boostDamage: 0,
                isDefended: false,
                targetType: 'identity',
                targetId: 'hero',
                isCanceled: false,
                overkill: false,
                skipBoost: true,
            };
            await state.villainActivationAttack(attackPayload);
            break;
        }

        case 'activateNemesisMinionsOrAddCounters': {
            const nemId = state.p.nemesisMinionStorageId;
            const nemesisMinions = state.p.engagedMinions.filter(m =>
                nemId !== null && m.storageId === nemId
            );
            if (nemesisMinions.length === 0) {
                state.addLog(`Evil Alliance — no nemesis minion in play. Adding 3 pursuit counters.`, 'villain');
                await state.addPursuitCounters(3);
            } else {
                for (const minion of nemesisMinions) {
                    state.addLog(`Evil Alliance — ${minion.name} activates!`, 'villain');
                    if (state.hero.identityStatus === 'alter-ego') {
                        await state.minionActivationScheme(minion);
                    } else {
                        await state.minionActivationAttack(minion);
                    }
                }
            }
            break;
        }

        case 'discardUpgradeOrSupportIfPursuitCounters': {
            if (!state.activeEnvironmentCard || state.activeEnvironmentCard.counters <= 0) break;
            const eligible = state.tableauCards.filter(c => c.type === 'upgrade' || c.type === 'support');
            if (eligible.length === 0) {
                state.addLog(`Nowhere Is Safe — no upgrade or support in play to discard.`, 'villain');
                break;
            }
            const chosen = await state.requestChoice(
                'NOWHERE IS SAFE — Discard an upgrade or support',
                eligible.map(c => ({ id: c.instanceId, name: c.name, imgPath: (c as any).imgPath ?? '' }))
            );
            const target = eligible.find(c => c.instanceId === chosen?.id);
            if (!target) break;
            state.tableauCards = state.tableauCards.filter(c => c.instanceId !== target.instanceId);
            if (target.storageId != null) state.playerDiscardIds.unshift(target.storageId);
            state.addLog(`Nowhere Is Safe — ${target.name} discarded.`, 'villain');
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
            const allyOptions: { id: number; name: string; imgPath?: string }[] = [];
            for (const sid of state.playerDiscardIds) {
                if (seen.has(sid)) continue;
                const bp = cardMap.get(sid);
                if (bp?.type === 'ally') {
                    seen.add(sid);
                    allyOptions.push({ id: sid, name: bp.name, imgPath: (bp as any).imgPath });
                }
            }
            if (allyOptions.length === 0) {
                state.addLog('No allies in discard to put into play.', 'system');
                context.actionBlocked = true;
                break;
            }
            const chosen = await state.requestChoice('Choose an ally to put into play (pay printed cost)', allyOptions);
            if (!chosen || chosen.id === 'none') {
                context.actionBlocked = true;
                break;
            }
            const storageId = chosen.id as number;
            const bp = cardMap.get(storageId)!;
            const allyCost = (bp as any).cost ?? 0;

            // Check ally limit
            const allyLimit = 3 + state.tableauCards.reduce((sum: number, c: any) => sum + (c.allyLimitBonus ?? 0), 0);
            if (state.tableauCards.filter((c: any) => c.type === 'ally').length >= allyLimit) {
                state.addLog(`Cannot put ${bp.name} into play — ally limit reached.`, 'system');
                context.actionBlocked = true;
                break;
            }

            // Collect payment if the ally has a cost
            if (allyCost > 0) {
                const selectedIds = await state.requestHandDiscard(
                    allyCost,
                    'PAY ALLY COST',
                    `Discard ${allyCost} card${allyCost !== 1 ? 's' : ''} as resources to pay for ${bp.name} (cost ${allyCost}).`
                );
                if (!selectedIds || selectedIds.length < allyCost) {
                    state.addLog(`Play of ${bp.name} cancelled.`, 'system');
                    context.actionBlocked = true;
                    break;
                }
                for (const instId of selectedIds) {
                    const handIdx = state.hand.findIndex((c: any) => c.instanceId === instId);
                    if (handIdx !== -1) {
                        const pCard = state.hand[handIdx] as any;
                        state.hand.splice(handIdx, 1);
                        if (pCard.storageId != null) state.playerDiscardIds.push(pCard.storageId);
                    }
                }
            }

            // Remove one copy of the ally from discard and put it into play
            const discardIdx = state.playerDiscardIds.lastIndexOf(storageId);
            if (discardIdx !== -1) state.playerDiscardIds.splice(discardIdx, 1);
            const tableauAlly = createTableauCard(storageId, state.getNextId());
            state.tableauCards.push(tableauAlly);
            state.addLog(`${bp.name} put into play from discard (cost paid: ${allyCost}).`, 'play');

            // Fire "when enters play" effects (e.g. Nick Fury, Maria Hill)
            if ((tableauAlly as any).logic?.timing === 'afterPlay') {
                await state.executeCardEffect(tableauAlly as any);
            }
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

        case 'addVillainHp': {
            if (!state.villainCard) break;
            state.villainCard.hitPointsRemaining = (state.villainCard.hitPointsRemaining ?? 0) + effect.amount;
            const label = effect.amount > 0 ? `+${effect.amount}` : `${effect.amount}`;
            state.addLog(`${state.villainCard.name} ${label} hit points.`, 'status');
            if (state.villainCard.hitPointsRemaining <= 0) {
                await state.handleVillainDefeated();
            }
            break;
        }

        case 'exhaustAllCharacters': {
            state.hero.exhausted = true;
            for (const card of state.tableauCards) {
                if (card.type === 'ally') (card as any).exhausted = true;
            }
            state.addLog(`All characters exhausted.`, 'status');
            break;
        }

        case 'payResources': {
            const required = effect.resources;
            let paid = false;
            while (!paid) {
                const handResources = state.hand.flatMap((c: any) => c.resources ?? []);
                if (!satisfiesResourceRequirements(required, handResources)) {
                    state.addLog(`Not enough resources in hand to pay — effect skipped.`, 'system');
                    break;
                }
                const selectedIds = await state.requestHandDiscard(
                    required.length,
                    'PAY RESOURCES',
                    `Discard cards providing: ${required.join(' + ')}.`
                );
                if (!selectedIds || selectedIds.length === 0) {
                    state.addLog(`Resource payment canceled.`, 'system');
                    context.actionBlocked = true;
                    break;
                }
                const selected = selectedIds.map((id: number) => state.hand.find((c: any) => c.instanceId === id)).filter(Boolean);
                const paidResources = selected.flatMap((c: any) => c.resources ?? []);
                if (!satisfiesResourceRequirements(required, paidResources)) {
                    state.addLog(`Invalid resource selection — try again.`, 'system');
                    continue;
                }
                for (const card of selected) {
                    state.hand = state.hand.filter((c: any) => c.instanceId !== (card as any).instanceId);
                    if ((card as any).storageId != null) state.playerDiscardIds.push((card as any).storageId);
                }
                state.addLog(`Paid ${required.join('+')} — cards discarded.`, 'discard');
                paid = true;
            }
            break;
        }

        case 'exhaustAllAllies': {
            for (const card of state.tableauCards) {
                if (card.type === 'ally') (card as any).exhausted = true;
            }
            state.addLog(`All allies exhausted.`, 'status');
            break;
        }

        case 'allTaggedMinionsAttack': {
            const minionsToAttack = state.engagedMinions.filter(m => {
                const bp = villainCardMap.get(m.storageId!);
                return bp?.tags?.includes(effect.tag);
            });
            const inHeroForm = state.hero.identityStatus === 'hero';
            for (const minion of [...minionsToAttack]) {
                if (state.engagedMinions.some(m => m.instanceId === minion.instanceId)) {
                    if (inHeroForm) {
                        await state.minionActivationAttack(minion);
                    } else {
                        await state.minionActivationScheme(minion);
                    }
                }
            }
            break;
        }

        case 'discardUntilTaggedMinionIntoPlay': {
            let found = false;
            while (state.villainDeckIds.length > 0 && !found) {
                const cardId = state.villainDeckIds.shift()!;
                const bp = villainCardMap.get(cardId);
                if (bp?.type === 'minion' && bp.tags?.includes(effect.tag)) {
                    state.addLog(`${bp.name} revealed — enters play!`, 'villain');
                    const minionCard = createVillainCard(cardId, state.getNextId());
                    await state.handleMinionEntry(minionCard);
                    found = true;
                } else {
                    state.villainDiscardIds.push(cardId);
                    state.addLog(`${bp?.name ?? `Card #${cardId}`} discarded.`, 'discard');
                }
            }
            if (!found) state.addLog(`No ${effect.tag} minion found in villain deck.`, 'system');
            break;
        }

        case 'searchForTaggedMinionIntoPlay': {
            let foundId: number | null = null;
            const deckIdx = state.villainDeckIds.findIndex(id => {
                const bp = villainCardMap.get(id);
                return bp?.type === 'minion' && bp.tags?.includes(effect.tag);
            });
            if (deckIdx !== -1) {
                [foundId] = state.villainDeckIds.splice(deckIdx, 1);
            } else {
                const discardIdx = state.villainDiscardIds.findIndex(id => {
                    const bp = villainCardMap.get(id);
                    return bp?.type === 'minion' && bp.tags?.includes(effect.tag);
                });
                if (discardIdx !== -1) [foundId] = state.villainDiscardIds.splice(discardIdx, 1);
            }
            if (foundId != null) {
                const bp = villainCardMap.get(foundId);
                state.addLog(`${bp?.name ?? `Card #${foundId}`} found — enters play!`, 'villain');
                const minionCard = createVillainCard(foundId, state.getNextId());
                await state.handleMinionEntry(minionCard);
            } else {
                state.addLog(`No ${effect.tag} minion found.`, 'system');
            }
            break;
        }

        case 'revealNemesisSet': {
            if (state.nemesisSetAdded) {
                context.surge = (context.surge ?? 0) + 1;
                state.addLog(`Nemesis set already in play — Shadow of the Past surges!`, 'surge');
                break;
            }
            state.nemesisSetAdded = true;

            // Pull nemesis minion from set-aside pile and put it into play
            const minionIdx = state.setAsideNemesisIds.indexOf(state.nemesisMinionStorageId!);
            if (minionIdx !== -1 && state.nemesisMinionStorageId != null) {
                state.setAsideNemesisIds.splice(minionIdx, 1);
                const minionCard = createVillainCard(state.nemesisMinionStorageId, state.getNextId());
                const bp = villainCardMap.get(state.nemesisMinionStorageId);
                state.addLog(`${bp?.name ?? 'Nemesis minion'} revealed — enters play!`, 'villain');
                await state.handleMinionEntry(minionCard);
            }

            // Pull nemesis side scheme from set-aside pile and put it into play
            const ssIdx = state.setAsideNemesisIds.indexOf(state.nemesisSideSchemeStorageId!);
            if (ssIdx !== -1 && state.nemesisSideSchemeStorageId != null) {
                state.setAsideNemesisIds.splice(ssIdx, 1);
                const ssCard = createVillainCard(state.nemesisSideSchemeStorageId, state.getNextId());
                const bp = villainCardMap.get(state.nemesisSideSchemeStorageId);
                state.addLog(`${bp?.name ?? 'Nemesis side scheme'} revealed — enters play!`, 'villain');
                await state.handleSideSchemeEntry(ssCard);
            }

            // Shuffle remaining set-aside nemesis cards into the villain deck
            if (state.setAsideNemesisIds.length > 0) {
                state.villainDeckIds.push(...state.setAsideNemesisIds);
                state.shufflePile(state.villainDeckIds);
                state.addLog(`${state.setAsideNemesisIds.length} nemesis card(s) shuffled into the encounter deck.`, 'villain');
                state.setAsideNemesisIds = [];
            }
            break;
        }

        case 'taggedMinionAttacks': {
            const minion = state.engagedMinions.find(m => {
                const bp = villainCardMap.get(m.storageId!);
                return bp?.tags?.includes(effect.tag);
            });
            if (!minion) { state.addLog(`No ${effect.tag} minion in play — attack skipped.`, 'system'); break; }
            if (minion.stunned) {
                minion.stunned = false;
                state.addLog(`${minion.name} is stunned — attack prevented, stun removed.`, 'status');
                break;
            }
            if (minion.confused) {
                minion.confused = false;
                state.addLog(`${minion.name} is confused — attack prevented, status removed.`, 'status');
                break;
            }
            context.minionAttacked = true;
            await state.minionActivationAttack(minion);
            break;
        }

        case 'healTaggedMinionFully': {
            const minion = state.engagedMinions.find(m => {
                const bp = villainCardMap.get(m.storageId!);
                return bp?.tags?.includes(effect.tag);
            });
            if (!minion) { state.addLog(`No ${effect.tag} minion in play to heal.`, 'system'); break; }
            const maxHp = minion.hitPoints ?? villainCardMap.get(minion.storageId!)?.hitPoints ?? 0;
            minion.hitPointsRemaining = maxHp;
            state.addLog(`${minion.name} healed to full HP (${maxHp}).`, 'system');
            break;
        }

        case 'selfMinionAttack': {
            const minion = context.sourceCard;
            if (!minion) { state.addLog(`selfMinionAttack: no source minion in context.`, 'system'); break; }
            if (state.hero.identityStatus === 'alter-ego') {
                state.addLog(`${minion.name} quickstrikes — but ${state.hero.name} is in alter-ego form, no attack.`, 'status');
                break;
            }
            state.addLog(`${minion.name} quickstrikes!`, 'villain');
            await state.minionActivationAttack(minion);
            break;
        }

        case 'storeRandomHandCardOnScheme': {
            if (state.hand.length === 0) { state.addLog(`No cards in hand to place facedown.`, 'system'); break; }
            const idx = Math.floor(Math.random() * state.hand.length);
            const [card] = state.hand.splice(idx, 1);
            if (!context.sourceCard.heldCards) context.sourceCard.heldCards = [];
            context.sourceCard.heldCards.push(card.storageId!);
            state.addLog(`${card.name} placed facedown on ${context.sourceCard.name}.`, 'villain');
            break;
        }

        case 'returnHeldCardsToHand': {
            const heldIds: number[] = context.sourceCard?.heldCards ?? [];
            for (const storageId of heldIds) {
                const newCard = createHandCard(storageId, state.getNextId());
                state.hand.push(newCard);
                const bp = cardMap.get(storageId);
                state.addLog(`${bp?.name ?? 'Card'} returned to hand from ${context.sourceCard.name}.`, 'system');
            }
            if (context.sourceCard) context.sourceCard.heldCards = [];
            break;
        }

        case 'discardRandomAndThreatPerResourceType': {
            if (state.hand.length === 0) { state.addLog(`No cards in hand to discard.`, 'system'); break; }
            const idx = Math.floor(Math.random() * state.hand.length);
            const [discarded] = state.hand.splice(idx, 1);
            if (discarded.storageId != null) state.playerDiscardIds.push(discarded.storageId);
            const bp = cardMap.get(discarded.storageId!);
            const distinctTypes = new Set(bp?.resources ?? []).size;
            state.addLog(`${discarded.name} discarded randomly — ${distinctTypes} distinct resource type(s), placing ${distinctTypes} threat on the main scheme.`, 'villain');
            if (distinctTypes > 0) {
                await state.applyThreatToMainScheme({ amount: distinctTypes, source: 'vultures_plans', isCanceled: false });
            }
            break;
        }

        case 'addBoostCard': {
            context.extraBoostCards = (context.extraBoostCards ?? 0) + 1;
            state.addLog(`Extra boost card granted for this activation.`, 'status');
            break;
        }

        case 'putBoostCardIntoPlay': {
            const storageId = context.boostCardId;
            if (storageId == null) break;
            // Remove from discard (was just pushed by flipBoostCard)
            const discardIdx = state.villainDiscardIds.lastIndexOf(storageId);
            if (discardIdx !== -1) state.villainDiscardIds.splice(discardIdx, 1);
            const bp = villainCardMap.get(storageId);
            state.addLog(`${bp?.name ?? `Card #${storageId}`} enters play as a minion!`, 'villain');
            const minionCard = createVillainCard(storageId, state.getNextId());
            await state.handleMinionEntry(minionCard, { fromBoost: true });
            break;
        }

        case 'discardRandomFromHand': {
            if (state.hand.length === 0) {
                state.addLog(`No cards in hand to discard.`, 'system');
                break;
            }
            const randIdx = Math.floor(Math.random() * state.hand.length);
            const [discarded] = state.hand.splice(randIdx, 1);
            if (discarded.storageId != null) state.playerDiscardIds.push(discarded.storageId);
            state.addLog(`${discarded.name} discarded randomly from hand.`, 'discard');
            break;
        }

        case 'discardUntilMinionIntoPlay': {
            let found = false;
            while (state.villainDeckIds.length > 0 && !found) {
                const cardId = state.villainDeckIds.shift()!;
                const bp = villainCardMap.get(cardId);
                if (bp?.type === 'minion') {
                    state.addLog(`${bp.name} revealed from villain deck — enters play!`, 'villain');
                    const minionCard = createVillainCard(cardId, state.getNextId());
                    await state.handleMinionEntry(minionCard);
                    found = true;
                } else {
                    state.villainDiscardIds.push(cardId);
                    state.addLog(`${bp?.name ?? `Card #${cardId}`} discarded from villain deck.`, 'discard');
                }
            }
            if (!found) state.addLog(`No minions found in villain deck.`, 'system');
            break;
        }

        case 'removeFromGame': {
            context.removedFromGame = true;
            state.addLog(`Card removed from the game.`, 'system');
            break;
        }

        case 'addAccelerationToken': {
            state.accelerationTokens += effect.amount;
            state.addLog(`${effect.amount} acceleration token(s) added (now ${state.accelerationTokens}).`, 'villain');
            break;
        }

        case 'shuffleTaggedCardFromDiscardIntoDeck': {
            const tag = effect.tag;
            const idx = state.playerDiscardIds.findIndex(sid => cardMap.get(sid)?.tags?.includes(tag));
            if (idx >= 0) {
                const sid = state.playerDiscardIds[idx]!;
                state.playerDiscardIds.splice(idx, 1);
                const insertAt = Math.floor(Math.random() * (state.deckIds.length + 1));
                state.deckIds.splice(insertAt, 0, sid);
                state.addLog(`${cardMap.get(sid)?.name ?? 'Card'} shuffled from discard into deck.`, 'system');
            } else {
                state.addLog(`No card tagged '${tag}' found in discard.`, 'system');
            }
            break;
        }

        case 'discardTopDeckUntilTag': {
            const tag = effect.tag;
            let found: ReturnType<typeof createHandCard> | null = null;
            while (state.deckIds.length > 0) {
                const topId = state.deckIds.shift()!;
                const bp = cardMap.get(topId);
                if (bp?.tags?.includes(tag)) {
                    found = createHandCard(topId, state.getNextId());
                    break;
                }
                state.playerDiscardIds.unshift(topId);
            }
            if (found) {
                state.hand.push(found);
                state.addLog(`${found.name} revealed — added to hand.`, 'play');
            } else {
                state.addLog(`No card tagged '${tag}' found in deck.`, 'system');
            }
            break;
        }

        case 'discardToughFromHero': {
            const hero = state.hero;
            if (!hero?.tough) {
                state.addLog(`${hero?.name ?? 'Hero'} has no Tough to discard.`, 'system');
                context.actionBlocked = true;
                break;
            }
            const current = (hero as any).toughCounters ?? 1;
            (hero as any).toughCounters = Math.max(0, current - 1);
            if ((hero as any).toughCounters === 0) hero.tough = false;
            state.addLog(`${hero.name} discarded a Tough status card.`, 'status');
            await state.checkTriggers('response', 'HERO_TOUGH_DISCARDED', {});
            break;
        }

        case 'addBonusDamageToCurrentAttack': {
            context.bonusDamage = (context.bonusDamage ?? 0) + effect.amount;
            state.addLog(`+${effect.amount} bonus damage added to this attack.`, 'play');
            break;
        }

        case 'makeCurrentAttackOverkill': {
            context.overkill = true;
            state.pendingOverkillBoost = true; // also consumed after flipBoostCard for boost effects
            state.addLog(`This attack gains Overkill.`, 'play');
            break;
        }

        case 'makeCurrentAttackPiercing': {
            context.isPiercing = true;
            state.pendingPiercingBoost = true; // consumed after flipBoostCard for boost effects
            state.addLog(`This attack gains Piercing!`, 'play');
            break;
        }

        case 'discardAllFriendlyTough': {
            const hero = state.hero;
            const maxTough = (hero as any).maxToughCounters ?? 1;
            const current = (hero as any).toughCounters ?? (hero.tough ? 1 : 0);
            const removed = current;
            if (removed > 0) {
                (hero as any).toughCounters = 0;
                hero.tough = false;
                state.addLog(`${hero.name} — ${removed} Tough card${removed !== 1 ? 's' : ''} discarded.`, 'status');
            } else {
                state.addLog(`${hero.name} has no Tough to discard.`, 'status');
            }
            if (effect.surgePerMissing) {
                const missing = maxTough - removed;
                for (let i = 0; i < missing; i++) {
                    context.surge = (context.surge ?? 0) + 1;
                    state.addLog(`Surge! (${missing - i} Tough missing)`, 'surge');
                    state.drawFromVillainDeckAsEncounterCard();
                }
            }
            break;
        }

        case 'discardAllFriendlyToughAndAddThreat': {
            let totalRemoved = 0;
            for (const slot of state.players.values()) {
                const hero = slot.playerIdentity;
                if (!hero) continue;
                const current = (hero as any).toughCounters ?? (hero.tough ? 1 : 0);
                if (current > 0) {
                    (hero as any).toughCounters = 0;
                    hero.tough = false;
                    state.addLog(`${hero.name} — ${current} Tough card${current !== 1 ? 's' : ''} discarded.`, 'status');
                    totalRemoved += current;
                }
            }
            if (totalRemoved > 0) {
                const threatAmount = totalRemoved * effect.threatPerCard;
                state.addLog(`+${threatAmount} threat (${totalRemoved} Tough discarded × ${effect.threatPerCard}).`, 'villain');
                await state.applyThreatToMainScheme({ amount: threatAmount, source: 'rampaging_juggernaut', isCanceled: false });
            }
            break;
        }

        case 'revealBoostCardAsEncounterCard': {
            context.revealBoostCardAsEncounterCard = true;
            state.addLog(`Boost card will be revealed as an encounter card!`, 'villain');
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
        case 'lastTarget': {
            const tid = context.lastResolvedTargetId;
            if (!tid) return null;
            return state.findTargetById(tid) ?? null;
        }
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
        case 'payloadTarget': {
            const tid = context.targetId;
            if (tid === 'hero') return state.hero?.instanceId ?? null;
            return tid ?? null;
        }
        case 'lastTarget': {
            const tid = context.lastResolvedTargetId;
            if (!tid) return null;
            if (tid === 'hero') return state.hero?.instanceId ?? null;
            return tid;
        }
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
        case 'taggedMinionInPlay':
            return state.engagedMinions.some(m => {
                const bp = villainCardMap.get(m.storageId!);
                return bp?.tags?.includes(condition.tag);
            });
        case 'minionAttacked':
            return context.minionAttacked === true;
        case 'identityNotExhausted':
            return state.hero?.exhausted !== true;
        case 'canAffordResources': {
            const handResources = state.hand.flatMap((c: any) => c.resources ?? []);
            return satisfiesResourceRequirements(condition.resources as string[], handResources);
        }
        case 'heroHasTough':
            return state.hero?.tough === true;
        case 'attachedToAttacker': {
            // True if sourceCard (the attachment) is attached to the current attacker (context.source)
            const attacker = context.source;
            const card = context.sourceCard;
            if (!attacker || !card) return false;
            const attachments = (attacker as any).attachments ?? [];
            return attachments.some((a: any) => a.instanceId === card.instanceId);
        }
    }
}
