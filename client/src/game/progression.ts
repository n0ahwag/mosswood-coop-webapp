import type { FeatureKey, GameContent, VillageState } from '../lib/types';

export function hasFeature(village: VillageState | null, feature: FeatureKey) {
  return !!village?.progression.features.includes(feature);
}

/** Welche Aufgabe schaltet einen Bereich frei? Für Hinweise wie „Ab Aufgabe 9“. */
export function featureUnlock(content: GameContent, feature: FeatureKey) {
  const index = content.quests.findIndex((q) => q.reward.features?.includes(feature));
  return { index, quest: content.quests[index] };
}
