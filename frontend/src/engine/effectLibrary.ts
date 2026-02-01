import type { VillainCardInstance, Minion } from "../types/card";
type EffectFn = (state: any, value?: number, targetId?: any) => void;

export const EffectLibrary: Record<string, EffectFn> = {
  
  dealDamage: (state, value = 0, targetId) => {
    if (targetId === undefined) {
      console.error("No target selected for dealDamage");
      return;
    }

    const enemy: (VillainCardInstance | Minion) = state.findEnemyById(targetId);

    if (enemy) {
      enemy.hitPointsRemaining = Math.max(0, enemy.hitPointsRemaining! -= value);
      console.log(`${enemy.name} took ${value} damage. Health is now ${enemy.hitPointsRemaining}`);
      
      if (enemy.hitPointsRemaining! <= 0) {
        if (enemy.type === "minion") {
            state.discardFromEngagedMinions(targetId);
        } else {
            // TODO: Next villain phase or players win!
        }
      }
    } else {
      console.warn(`Target enemy with ID ${targetId} not found.`);
    }
  }
};