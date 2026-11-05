// Fortschritt über Bauplan und Hofbuch – reine Funktionen, damit sie testbar bleiben.
//
// Gebäude werden mit Rohstoffen gebaut (cost), sobald ihre Voraussetzungen stehen (requires).
// Bereiche (features) öffnen sich über Wahrzeichen (Forschungsturm, Bahnhof) oder über
// Belohnungen aus dem Hofbuch (Handelsschiff, Tal-Forschung).
import { BUILDINGS, QUESTS } from './content.js';
import { hasResources } from './engine.js';

/** Bereiche, die das Dorf gerade nutzen darf. */
export function unlockedFeatures(snap) {
  const features = new Set();
  for (const quest of QUESTS.slice(0, snap.questStep)) {
    for (const f of quest.reward.features ?? []) features.add(f);
  }
  for (const b of snap.buildings) {
    const f = BUILDINGS[b.type]?.feature;
    if (f) features.add(f);
  }
  return features;
}

/** Woher kommt ein Bereich? Ein Wahrzeichen ({ kind: 'building' }) oder eine Aufgabe ({ kind: 'quest' }). */
export function featureSource(feature) {
  const type = Object.keys(BUILDINGS).find((k) => BUILDINGS[k].feature === feature);
  if (type) return { kind: 'building', type };
  return { kind: 'quest', index: QUESTS.findIndex((q) => (q.reward.features ?? []).includes(feature)) };
}

/** Fehlende Voraussetzungen für einen Bau. */
export function missingRequirements(snap, type) {
  const have = new Set(snap.buildings.map((b) => b.type));
  return (BUILDINGS[type]?.requires ?? []).filter((r) => !have.has(r));
}

/** Alle Gebäude, die noch nicht stehen, mit Kosten und Status. */
export function buildPlans(snap) {
  const have = new Set(snap.buildings.map((b) => b.type));
  return Object.entries(BUILDINGS)
    .filter(([type]) => !have.has(type))
    .map(([type, def]) => {
      const missing = (def.requires ?? []).filter((r) => !have.has(r));
      return {
        type,
        cost: def.cost,
        requires: def.requires ?? [],
        missing,
        available: missing.length === 0,
        affordable: missing.length === 0 && hasResources(snap.inventory, def.cost),
      };
    });
}

const statValue = (stats, goal) => {
  switch (goal.type) {
    case 'collect':
      return stats.collected?.[goal.resource] ?? 0;
    case 'research':
      return stats.research ?? 0;
    case 'contribute':
      return stats.contributed ?? 0;
    case 'shipLoad':
      return stats.shipLoaded ?? 0;
    default:
      return 0;
  }
};

/** Fortschritt einer Aufgabe, begrenzt auf 0 … goal.amount. */
export function questProgress(quest, snap) {
  const { goal } = quest;
  let value;
  if (goal.type === 'assign') {
    const building = snap.buildings.find((b) => b.type === goal.building);
    value = building && snap.villagers.some((v) => v.buildingId === building.id) ? 1 : 0;
  } else if (goal.type === 'build') {
    // Zählt den Zustand, nicht die Bauaktion: Wer vorbaut, hat die Aufgabe schon erfüllt.
    value = goal.buildings.filter((t) => snap.buildings.some((b) => b.type === t)).length;
  } else {
    value = statValue(snap.stats, goal) - statValue(snap.questBase, goal);
  }
  return Math.max(0, Math.min(goal.amount, value));
}

export function recordStat(stats, key, amount, resource) {
  if (key === 'collected') {
    stats.collected ??= {};
    stats.collected[resource] = (stats.collected[resource] ?? 0) + amount;
  } else {
    stats[key] = (stats[key] ?? 0) + amount;
  }
}

/** Schließt alle erfüllten Aufgaben ab (auch mehrere hintereinander) und gibt ihre Schlüssel zurück. */
export function advanceQuests(snap) {
  const completed = [];
  while (snap.questStep < QUESTS.length) {
    const quest = QUESTS[snap.questStep];
    if (questProgress(quest, snap) < quest.goal.amount) break;
    for (const [res, n] of Object.entries(quest.reward.resources ?? {})) {
      snap.inventory[res] = (snap.inventory[res] ?? 0) + n;
    }
    snap.questStep += 1;
    snap.questBase = structuredClone(snap.stats);
    completed.push(quest.key);
  }
  return { completed };
}

export function serializeProgression(snap) {
  const step = snap.questStep;
  const quest = QUESTS[step];
  return {
    step,
    total: QUESTS.length,
    quest: quest ? { ...quest, progress: questProgress(quest, snap) } : null,
    features: [...unlockedFeatures(snap)],
    plans: buildPlans(snap),
  };
}
