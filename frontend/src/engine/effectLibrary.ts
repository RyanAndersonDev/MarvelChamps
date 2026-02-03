import type { VillainCardInstance, Minion } from "../types/card";

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

export const EffectLibrary: Record<string, (state: any, context: any) => Promise<void> | void> = {
  
  dealDamage: async (state, context) => {
    const damagePayload = {
      amount: context.amount || 0,
      targetId: context.targetId,
      isCanceled: false,
      source: context.source || 'effect'
    };

    await state.emitEvent('ENTITY_TAKES_DAMAGE', damagePayload, async () => {
      if (damagePayload.isCanceled || damagePayload.amount <= 0) return;

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
  }
};