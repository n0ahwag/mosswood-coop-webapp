// Fortschritt über das Hofbuch – reine Funktionen, damit sie testbar bleiben.
import { BUILDINGS, QUESTS, STARTER_BUILDINGS } from './content.js';

/** Alles, was bis zur Aufgabe `step` (exklusiv) freigeschaltet ist. */
export function unlocksAt(step) {
  const buildings = new Set(STARTER_BUILDINGS);
  const features = new Set();
  for (const quest of QUESTS.slice(0, step)) {
    for (const b of quest.reward.buildings ?? []) buildings.add(b);
    for (const f of quest.reward.features ?? []) features.add(f);
  }
  return { buildings, features };
}

/** Bei welcher Aufgabe wird ein Gebäude oder Bereich frei? (-1 = von Anfang an) */
export function unlockQuestIndex(kind, key) {
  if (kind === 'building' && STARTER_BUILDINGS.includes(key)) return -1;
  return QUESTS.findIndex((q) => (q.reward[kind === 'building' ? 'buildings' : 'features'] ?? []).includes(key));
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

/**
 * Schließt alle erfüllten Aufgaben ab (auch mehrere hintereinander) und gibt sie zurück.
 * Neue Gebäudetypen, die dadurch frei werden, stehen in `newBuildings`.
 */
export function advanceQuests(snap) {
  const completed = [];
  const newBuildings = [];
  while (snap.questStep < QUESTS.length) {
    const quest = QUESTS[snap.questStep];
    if (questProgress(quest, snap) < quest.goal.amount) break;
    for (const [res, n] of Object.entries(quest.reward.resources ?? {})) {
      snap.inventory[res] = (snap.inventory[res] ?? 0) + n;
    }
    for (const b of quest.reward.buildings ?? []) if (BUILDINGS[b]) newBuildings.push(b);
    snap.questStep += 1;
    snap.questBase = structuredClone(snap.stats);
    completed.push(quest.key);
  }
  return { completed, newBuildings };
}

export function serializeProgression(snap) {
  const step = snap.questStep;
  const { buildings, features } = unlocksAt(step);
  const quest = QUESTS[step];
  return {
    step,
    total: QUESTS.length,
    quest: quest ? { ...quest, progress: questProgress(quest, snap) } : null,
    features: [...features],
    unlockedBuildings: [...buildings],
    locked: Object.keys(BUILDINGS)
      .filter((type) => !buildings.has(type))
      .map((type) => {
        const index = unlockQuestIndex('building', type);
        return { type, questIndex: index, questTitle: QUESTS[index]?.title ?? '' };
      })
      .sort((a, b) => a.questIndex - b.questIndex),
  };
}
