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
      enemy.healthRemaining! = Math.max(0, enemy.healthRemaining! -= value);
      console.log(`${enemy.name} took ${value} damage. Health is now ${enemy.healthRemaining}`);
      
      if (enemy.healthRemaining! <= 0) {
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