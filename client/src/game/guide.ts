// Der "nächste Schritt": übersetzt die aktuelle Hofbuch-Aufgabe und den Zustand
// des Dorfes in eine konkrete Handlung und ein Ziel, über dem der Wegweiser schwebt.

import type { GameContent, ValleyState, VillageState } from '../lib/types';

export type Scene = 'village' | 'valley';

export type GuideTarget =
  | { scene: 'village'; kind: 'building'; type: string }
  | { scene: 'village'; kind: 'landmark'; key: 'researchLab' | 'trainStation' }
  | { scene: 'valley'; kind: 'project'; key: string }
  | { scene: 'valley'; kind: 'ship' }
  | { scene: 'valley'; kind: 'station' };

export interface GuideStep {
  text: string;
  target: GuideTarget | null;
}

const producerOf = (content: GameContent, res: string) =>
  Object.entries(content.buildings).find(([, d]) => d.outputs[res])?.[0];

/** Was muss passieren, damit eine Ware entsteht? Rekursiv über fehlende Zutaten. */
function stepForResource(
  village: VillageState, content: GameContent, res: string, selectedVillagerName: string | null, depth = 0,
): GuideStep {
  const type = producerOf(content, res);
  const def = type ? content.buildings[type] : undefined;
  const building = type ? village.buildings.find((b) => b.type === type) : undefined;
  const resName = content.resources[res]?.name ?? res;
  if (!type || !def || !building) {
    return { text: `${resName} kannst du noch nicht herstellen.`, target: null };
  }
  const target: GuideTarget = { scene: 'village', kind: 'building', type };

  if (Object.values(building.stock).some((n) => n > 0) && (building.stock[res] ?? 0) > 0) {
    return { text: `Tippe bei „${def.name}“ auf das goldene Einsammeln-Schild.`, target };
  }

  const workers = village.villagers.filter((v) => v.buildingId === building.id);
  if (workers.length === 0) {
    if (selectedVillagerName) return { text: `Tippe jetzt auf „${def.name}“, damit ${selectedVillagerName} dort arbeitet.`, target };
    const idle = village.villagers.find((v) => !v.buildingId);
    const who = idle?.name ?? village.villagers[village.villagers.length - 1]?.name ?? 'einen Bewohner';
    return { text: `Tippe unten auf ${who} und dann auf „${def.name}“.`, target };
  }

  if (building.status === 'missingInputs' && depth < 3) {
    const missing = Object.entries(def.inputs).find(([r, n]) => (village.inventory[r] ?? 0) < n);
    if (missing) {
      const inner = stepForResource(village, content, missing[0], selectedVillagerName, depth + 1);
      const missName = content.resources[missing[0]]?.name ?? missing[0];
      return { text: `„${def.name}“ braucht ${missing[1]} ${missName}. ${inner.text}`, target: inner.target ?? target };
    }
  }

  if (workers.every((w) => w.state === 'HUNGRY')) {
    const food = (village.inventory.meals ?? 0) === 0 && (village.inventory.berries ?? 0) < 2;
    if (food) {
      const inner = stepForResource(village, content, village.buildings.some((b) => b.type === 'kitchen') ? 'meals' : 'berries', selectedVillagerName, depth + 1);
      return { text: `${workers[0].name} hat Hunger und es gibt nichts zu essen. ${inner.text}`, target: inner.target };
    }
  }

  if (building.status === 'full') {
    return { text: `Das Lager von „${def.name}“ ist voll. Tippe auf Einsammeln.`, target };
  }
  return { text: `„${def.name}“ arbeitet. Warte kurz, bis der Balken voll ist, dann sammelst du ein.`, target };
}

export function nextStep(
  village: VillageState | null,
  valley: ValleyState | null,
  content: GameContent,
  scene: Scene,
  selectedVillagerName: string | null,
): GuideStep | null {
  if (!village) return null;
  const quest = village.progression.quest;

  if (!quest) {
    return scene === 'village'
      ? { text: 'Du hast das Hofbuch geschafft! Fahr mit der Bahn ins Tal und hilf bei den Monumenten.', target: { scene: 'village', kind: 'landmark', key: 'trainStation' } }
      : { text: 'Zahle Waren in die Monumente ein und belade das Handelsschiff, wenn es im Hafen liegt.', target: null };
  }

  const { goal } = quest;

  // Aufgaben im Tal: erst hinfahren
  if ((goal.type === 'contribute' || goal.type === 'shipLoad') && scene === 'village') {
    return { text: 'Tippe auf den Bahnhof und fahr mit der Bahn ins Tal.', target: { scene: 'village', kind: 'landmark', key: 'trainStation' } };
  }
  if (scene === 'valley' && goal.type !== 'contribute' && goal.type !== 'shipLoad') {
    return { text: 'Deine nächste Aufgabe wartet auf deinem Hof. Tippe auf den Bahnhof, um zurückzufahren.', target: { scene: 'valley', kind: 'station' } };
  }

  switch (goal.type) {
    case 'assign': {
      const def = content.buildings[goal.building ?? ''];
      const target: GuideTarget = { scene: 'village', kind: 'building', type: goal.building ?? '' };
      if (selectedVillagerName) return { text: `Tippe jetzt auf „${def?.name}“, damit ${selectedVillagerName} dort arbeitet.`, target };
      return { text: `Tippe unten auf einen Bewohner und dann auf „${def?.name}“.`, target };
    }
    case 'collect':
      return stepForResource(village, content, goal.resource ?? '', selectedVillagerName);
    case 'research': {
      const options = Object.values(content.techs).filter((t) =>
        t.scope === 'player' && !village.techKeys.includes(t.key) && t.requires.every((r) => village.techKeys.includes(r)));
      const affordable = options.find((t) => Object.entries(t.cost).every(([r, n]) => (village.inventory[r] ?? 0) >= n));
      if (affordable) {
        return { text: `Tippe auf den Forschungsturm und erforsche „${affordable.name}“.`, target: { scene: 'village', kind: 'landmark', key: 'researchLab' } };
      }
      const cheapest = options.sort((a, b) => Object.values(a.cost).reduce((s, n) => s + n, 0) - Object.values(b.cost).reduce((s, n) => s + n, 0))[0];
      const lack = cheapest && Object.entries(cheapest.cost).find(([r, n]) => (village.inventory[r] ?? 0) < n);
      if (cheapest && lack) {
        const inner = stepForResource(village, content, lack[0], selectedVillagerName);
        return { text: `Für „${cheapest.name}“ fehlen dir noch ${lack[1] - (village.inventory[lack[0]] ?? 0)} ${content.resources[lack[0]]?.name}. ${inner.text}`, target: inner.target };
      }
      return { text: 'Tippe auf den Forschungsturm.', target: { scene: 'village', kind: 'landmark', key: 'researchLab' } };
    }
    case 'contribute': {
      const project = valley?.projects.find((p) => p.status === 'ACTIVE'
        && Object.entries(p.requirements).some(([r, n]) => (village.inventory[r] ?? 0) > 0 && (p.progress[r] ?? 0) < n));
      if (project) {
        return { text: `Tippe auf „${project.name}“ und zahle dort Waren ein, die du übrig hast.`, target: { scene: 'valley', kind: 'project', key: project.key } };
      }
      return { text: 'Dir fehlen Waren, die die Monumente brauchen (z. B. Planken oder Stein). Fahr zurück und stelle welche her.', target: { scene: 'valley', kind: 'station' } };
    }
    case 'shipLoad': {
      const ship = valley?.ship;
      if (ship?.status === 'DOCKED') {
        const fits = ship.demands.some((d) => (village.inventory[d.resource] ?? 0) > 0 && (ship.progress[d.resource] ?? 0) < d.amount);
        return fits
          ? { text: 'Das Schiff liegt im Hafen! Tippe darauf und lade Waren in die Kisten.', target: { scene: 'valley', kind: 'ship' } }
          : { text: 'Das Schiff möchte Waren, die du nicht hast. Tippe darauf, um zu sehen welche, und stelle sie her.', target: { scene: 'valley', kind: 'ship' } };
      }
      return { text: 'Das Handelsschiff ist gerade unterwegs. Sammle bis dahin Waren auf deinem Hof.', target: { scene: 'valley', kind: 'ship' } };
    }
  }
}
