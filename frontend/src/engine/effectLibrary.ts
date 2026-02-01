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
  },

  healIdentity: (state, value = 0) => {
    const hero = state.playerIdentity;

    if (hero && hero.hitPointsRemaining !== undefined) {
        const maxHP = hero.hitPoints;
        const currentHP = hero.hitPointsRemaining;

        hero.hitPointsRemaining = Math.min(maxHP, currentHP + value);

        console.log(`${hero.name} healed for ${value}. Health is now ${hero.hitPointsRemaining}/${maxHP}`);
    } else {
        console.error("Effect Library: Could not find Hero Identity or HP property.");
    }
  }
};