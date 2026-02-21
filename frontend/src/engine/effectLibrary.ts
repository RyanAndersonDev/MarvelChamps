import type { Attachment, Upgrade } from "../types/card";
import { cardMap } from "../cards/cardStore";
import { createHandCard } from "../cards/cardFactory";

export interface BasePayload {
    isCanceled?: boolean;
    amount?: number;
    card?: any;
    [key: string]: any;
}

type EffectFn = (
    state: any,
    payload?: number | BasePayload,
    targetId?: any,
    context?: any
) => void | Promise<void>;

export const EffectLibrary: Record<string | number, (state: any, context: any) => Promise<void> | void> = {

  // ======================== CORE EFFECTS ========================

  dealDamage: async (state, context) => {
    const damagePayload = {
      amount: context.amount || 0,
      targetId: context.targetId,
      isCanceled: false,
      source: context.source || 'effect'
    };

    await state.emitEvent('ENTITY_TAKES_DAMAGE', damagePayload, async () => {
      if (damagePayload.isCanceled || damagePayload.amount <= 0)
        return;

      await state.applyDamageToEntity(damagePayload);
    });
  },

  preventDamage: async (state, context) => {
    const reductionPower = context.effectValue ?? context.sourceCard?.logic?.value ?? 0;

    if (reductionPower === 100 || context.preventAll) {
      context.amount = 0;
      context.isCanceled = true;
      console.log("Damage fully prevented.");
    } else {
      context.amount = Math.max(0, context.amount - reductionPower);
      console.log(`Damage reduced by ${reductionPower}. Remaining: ${context.amount}`);

      if (context.amount === 0) {
        context.isCanceled = true;
      }
    }

    context.isResolved = true;
  },

  cancelWhenRevealed: (state, context) => {
    context.isCanceled = true;
    context.isResolved = true;
    console.log("Effect canceled by library.");
  },

  drawACard: async (state, context) => {
    const amount = context.effectValue || 1;

    for (let i = 0; i < amount; i++) {
      await state.drawCardFromDeck();
    }
  },

  // ======================== SPIDER-MAN HERO EFFECTS ========================

  // Black Cat — Forced Response: After you play Black Cat, discard the top 2 cards
  // of your deck. Add each card with a printed mental resource to your hand.
  blackCatDiscard: async (state, _context) => {
    const discarded: number[] = [];

    for (let i = 0; i < 2; i++) {
      if (state.deckIds.length === 0) state.shuffleDiscardPileIntoDrawPile();
      if (state.deckIds.length > 0) {
        discarded.push(state.deckIds.shift()!);
      }
    }

    for (const cardId of discarded) {
      const blueprint = cardMap.get(cardId);
      if (blueprint && blueprint.resources?.includes('mental')) {
        state.hand.push(createHandCard(cardId, state.getNextId()));
        console.log(`${blueprint.name} has a mental resource — added to hand.`);
      } else {
        state.playerDiscardIds.push(cardId);
        console.log(`${blueprint?.name || cardId} discarded (no mental resource).`);
      }
    }
  },

  // Aunt May — Alter-Ego Action (Exhaust): Heal 4 damage from Peter Parker.
  healIdentity: async (state, context) => {
    const healAmount = context.effectValue || context.amount || 4;
    const hero = state.hero;

    const before = hero.hitPointsRemaining;
    hero.hitPointsRemaining = Math.min(hero.hitPoints, hero.hitPointsRemaining + healAmount);
    const healed = hero.hitPointsRemaining - before;

    console.log(`Healed ${healed} damage from ${hero.name}. HP: ${hero.hitPointsRemaining}/${hero.hitPoints}`);
  },

  // Spider-Tracer — Forced Interrupt: When attached minion is defeated,
  // remove 3 threat from a scheme.
  removeThreat: async (state, context) => {
    const amount = context.effectValue || 3;

    const targetId = await state.requestTarget(context.sourceCard || context.attachment, 'scheme');
    if (!targetId) return;

    const target = state.findSchemeById(targetId);
    if (!target) return;

    // Crisis check: can't remove threat from main scheme if crisis is active
    if (target.type === 'main-scheme' && state.hasCrisisScheme) {
      console.warn("Cannot remove threat from main scheme while a Crisis side scheme is in play!");
      return;
    }

    target.threatRemaining = Math.max(0, target.threatRemaining - amount);
    console.log(`Removed ${amount} threat from ${target.name}. Remaining: ${target.threatRemaining}`);

    if (target.type === 'side-scheme' && target.threatRemaining === 0) {
      await state.discardSideScheme(target.instanceId);
    }
  },

  // Web-Shooter — Hero Resource (Exhaust + remove 1 web counter): Generate a wild resource.
  // Uses (3 web counters). Discard when counters reach 0.
  generateWildResource: async (state, context) => {
    const card = context.sourceCard;
    if (!card || card.counters <= 0) return;

    card.counters--;
    context.generatedResource = 'wild';
    console.log(`Web-Shooter generated a wild resource. ${card.counters} uses remaining.`);

    if (card.counters <= 0) {
      state.discardFromTableau(card.instanceId);
      console.log("Web-Shooter has no uses left — discarded.");
    }
  },

  // Peter Parker AE — Scientist: Generate a mental resource.
  generateMentalResource: async (state, context) => {
    context.generatedResource = 'mental';
    console.log("Peter Parker generated a mental resource.");
  },

  // Webbed Up — Forced Interrupt: When attached enemy would attack,
  // discard Webbed Up instead. Then, stun that enemy.
  preventAttackThenStun: async (state, context) => {
    const attacker = context.attacker;
    const attachment = context.attachment;

    // Cancel the current attack
    if (context.attackPayload) {
      context.attackPayload.isCanceled = true;
    }

    // Discard Webbed Up from the enemy's attachments
    if (attacker?.attachments) {
      attacker.attachments = attacker.attachments.filter(
        (a: any) => a.instanceId !== attachment.instanceId
      );
    }
    if (attachment?.storageId) {
      state.playerDiscardIds.push(attachment.storageId);
    }

    // Stun the enemy
    if (attacker) {
      attacker.stunned = true;
      console.log(`Webbed Up canceled the attack and stunned ${attacker.name}!`);
    }
  },

  // ======================== RHINO TREACHERY EFFECTS ========================
  // Keyed by storageId (number) since handleTreacheryResolution looks up by card.storageId

  // Hard to Keep Down (storageId 7) — When Revealed: Rhino heals 4 damage.
  // If no damage was healed this way, this card gains surge.
  7: async (state, context) => {
    const villain = state.villainCard;
    if (!villain) return;

    const maxHp = villain.hitPointsPerPlayer * 1; // TODO: multiply by player count
    const before = villain.hitPointsRemaining || 0;
    const missingHp = maxHp - before;

    if (missingHp <= 0) {
      context.surge = true;
      console.log("Hard to Keep Down: Rhino at full HP — surge!");
    } else {
      const healAmount = Math.min(4, missingHp);
      villain.hitPointsRemaining = before + healAmount;
      console.log(`Hard to Keep Down: Rhino healed ${healAmount} HP. Now at ${villain.hitPointsRemaining}/${maxHp}`);
    }
  },

  // "I'm Tough!" (storageId 8) — When Revealed: Give Rhino a tough status card.
  // If Rhino already has a tough status card, this card gains surge.
  8: async (state, context) => {
    const villain = state.villainCard;
    if (!villain) return;

    if (villain.tough) {
      context.surge = true;
      console.log(`"I'm Tough!": Rhino already has Tough — surge!`);
    } else {
      villain.tough = true;
      console.log(`"I'm Tough!": Rhino gained Tough status.`);
    }
  },

  // Stampede (storageId 9) — When Revealed (Alter-Ego): This card gains surge.
  // When Revealed (Hero): Rhino attacks you. If a character is damaged by this attack,
  // that character is stunned.
  9: async (state, context) => {
    if (state.hero.identityStatus === 'alter-ego') {
      context.surge = true;
      console.log("Stampede: Alter-ego form — surge!");
    } else {
      const atkBonus = (state.villainCard?.attachments || [])
        .reduce((sum: number, att: any) => sum + ((att as Attachment).atkMod || 0), 0);

      const attackPayload = {
        attacker: state.villainCard?.name || 'Villain',
        baseDamage: (state.villainCard?.atk || 0) + atkBonus,
        boostDamage: 0,
        isDefended: false,
        targetType: 'identity',
        targetId: 'hero',
        isCanceled: false,
        damageWasDealt: false,
        overkill: (state.villainCard?.attachments || []).some((att: any) => (att as Attachment).overkill)
      };

      console.log("Stampede: Rhino attacks!");
      await state.villainActivationAttack(attackPayload);

      // If damage was dealt, stun the damaged character
      if (attackPayload.damageWasDealt) {
        if (attackPayload.targetType === 'identity') {
          state.hero.stunned = true;
          console.log("Stampede: Hero was stunned!");
        } else if (attackPayload.targetType === 'ally') {
          const ally = state.tableauCards.find((c: any) => c.instanceId === attackPayload.targetId);
          if (ally) {
            ally.stunned = true;
            console.log(`Stampede: ${ally.name} was stunned!`);
          }
        }
      }
    }
  },

  // ======================== RHINO ATTACHMENT EFFECTS ========================

  // Armored Rhino Suit — When any amount of damage would be dealt to Rhino,
  // place it here instead. If 5+ damage accumulated, discard this card.
  armoredRhinoSuitRedirect: async (state, context) => {
    const suit = state.villainCard?.attachments?.find(
      (a: any) => a.storageId === 1
    ) as Attachment | undefined;

    if (!suit) return;

    const damageAmount = context.amount || 0;
    suit.damageAccumulated = (suit.damageAccumulated || 0) + damageAmount;
    context.amount = 0;
    context.isCanceled = true;

    console.log(`Armored Rhino Suit absorbed ${damageAmount} damage. Total: ${suit.damageAccumulated}/5`);

    if (suit.damageAccumulated! >= 5) {
      state.villainCard.attachments = state.villainCard.attachments.filter(
        (a: any) => a.storageId !== 1
      );
      state.villainDiscardIds.push(1);
      console.log("Armored Rhino Suit broke apart and was discarded!");
    }
  },

  // Charge — At the end of this attack, discard Charge.
  // (overkill + ATK bonus handled by game store; this just self-discards)
  chargeDiscard: async (state, _context) => {
    if (!state.villainCard) return;

    state.villainCard.attachments = state.villainCard.attachments.filter(
      (a: any) => a.storageId !== 2
    );
    state.villainDiscardIds.push(2);
    console.log("Charge was discarded after the attack.");
  },

  // ======================== MINION WHEN REVEALED EFFECTS ========================

  // Shocker — When Revealed: Deal 1 damage to each hero.
  shockerWhenRevealed: async (state, _context) => {
    console.log("Shocker: When Revealed — dealing 1 damage to the hero.");
    await state.applyDamageToEntity({
      targetId: state.hero.instanceId,
      amount: 1
    });
  }
};
