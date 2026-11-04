import { TECHS, VILLAGER_RULES } from './content.js';

// Fasst alle freigeschalteten Technologien (Spieler + Tal) zu einem Effekt-Objekt zusammen.
export function computeEffects(techKeys = []) {
  const effects = {
    speed: {},
    storageCapBonus: 0,
    autoCollect: false,
    mealSatietyBonus: 0,
    villagerSlots: VILLAGER_RULES.baseVillagers,
  };

  for (const key of new Set(techKeys)) {
    const fx = TECHS[key]?.effects;
    if (!fx) continue;
    for (const [type, bonus] of Object.entries(fx.speed ?? {})) {
      effects.speed[type] = (effects.speed[type] ?? 0) + bonus;
    }
    effects.storageCapBonus += fx.storageCapBonus ?? 0;
    effects.mealSatietyBonus += fx.mealSatietyBonus ?? 0;
    effects.villagerSlots += fx.villagerSlots ?? 0;
    if (fx.autoCollect) effects.autoCollect = true;
  }

  effects.villagerSlots = Math.min(effects.villagerSlots, VILLAGER_RULES.maxVillagers);
  return effects;
}
