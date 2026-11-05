import type { FeatureKey, GameContent, Inventory, VillageState } from '../lib/types';

export function hasFeature(village: VillageState | null, feature: FeatureKey) {
  return !!village?.progression.features.includes(feature);
}

/**
 * Wie öffnet sich ein Bereich? Wahrzeichen (Forschung, Tal) werden gebaut,
 * Handelsschiff und Tal-Forschung kommen aus dem Hofbuch.
 * short: knapper Hinweis für Schilder, text: ganzer Satz.
 */
export function featureUnlock(content: GameContent, feature: FeatureKey) {
  const building = Object.entries(content.buildings).find(([, d]) => d.feature === feature);
  if (building) {
    const [type, def] = building;
    return { type, short: `Baue den ${def.name}`, text: `Baue zuerst den ${def.icon} ${def.name}.` };
  }
  const index = content.quests.findIndex((q) => q.reward.features?.includes(feature));
  const quest = content.quests[index];
  return {
    type: null,
    short: `Ab Aufgabe ${index + 1}`,
    text: `Wird mit Aufgabe ${index + 1} im Hofbuch frei${quest ? ` („${quest.title}“)` : ''}.`,
  };
}

/** Was fehlt noch an Rohstoffen? */
export function lacking(inventory: Inventory, cost: Inventory) {
  return Object.entries(cost)
    .map(([res, n]) => [res, n - (inventory[res] ?? 0)] as const)
    .filter(([, n]) => n > 0);
}
