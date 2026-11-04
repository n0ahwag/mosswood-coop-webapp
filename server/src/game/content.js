// Statische Spielinhalte: Rohstoffe, Gebäude, Forschung, Tal-Projekte.
// Der Client lädt diese Daten über GET /api/content, damit es nur eine Quelle gibt.

export const RESOURCES = {
  wood: { name: 'Holz', icon: '🪵', tier: 'raw' },
  stone: { name: 'Stein', icon: '🪨', tier: 'raw' },
  clay: { name: 'Lehm', icon: '🟤', tier: 'raw' },
  berries: { name: 'Wildbeeren', icon: '🫐', tier: 'raw' },
  wheat: { name: 'Weizen', icon: '🌾', tier: 'raw' },
  fiber: { name: 'Fasern', icon: '🌿', tier: 'raw' },
  planks: { name: 'Planken', icon: '🪚', tier: 'refined' },
  bricks: { name: 'Ziegel', icon: '🧱', tier: 'refined' },
  cloth: { name: 'Stoff', icon: '🧶', tier: 'refined' },
  meals: { name: 'Mahlzeiten', icon: '🥧', tier: 'food' },
};

// durationSec: Dauer eines Zyklus mit einem Arbeiter.
// slots: maximale Arbeiter. stockCap: Lagerplatz im Gebäude, bevor eingesammelt werden muss.
export const BUILDINGS = {
  lumberCamp: {
    name: 'Holzfällerhütte', icon: '🪓', category: 'gathering',
    description: 'Fällt Bäume am Waldrand.',
    inputs: {}, outputs: { wood: 1 }, durationSec: 6, slots: 2, stockCap: 30,
  },
  quarry: {
    name: 'Steinbruch', icon: '⛏️', category: 'gathering',
    description: 'Bricht Steine aus dem Hang.',
    inputs: {}, outputs: { stone: 1 }, durationSec: 9, slots: 2, stockCap: 20,
  },
  clayPit: {
    name: 'Tonkuhle', icon: '🏺', category: 'gathering',
    description: 'Gräbt feuchten Lehm am Bachufer.',
    inputs: {}, outputs: { clay: 1 }, durationSec: 7, slots: 2, stockCap: 25,
  },
  berryFarm: {
    name: 'Beerenfarm', icon: '🫐', category: 'gathering',
    description: 'Pflückt Wildbeeren in den Hecken.',
    inputs: {}, outputs: { berries: 2 }, durationSec: 8, slots: 1, stockCap: 30,
  },
  wheatField: {
    name: 'Weizenfeld', icon: '🌾', category: 'gathering',
    description: 'Erntet goldenen Weizen.',
    inputs: {}, outputs: { wheat: 1 }, durationSec: 10, slots: 2, stockCap: 30,
  },
  flaxField: {
    name: 'Flachsfeld', icon: '🌿', category: 'gathering',
    description: 'Gewinnt Fasern aus Flachs.',
    inputs: {}, outputs: { fiber: 1 }, durationSec: 8, slots: 1, stockCap: 20,
  },
  sawmill: {
    name: 'Sägewerk', icon: '🪚', category: 'refining',
    description: 'Sägt Holz zu Planken.',
    inputs: { wood: 2 }, outputs: { planks: 1 }, durationSec: 12, slots: 1, stockCap: 15,
  },
  brickKiln: {
    name: 'Ziegelbrennerei', icon: '🔥', category: 'refining',
    description: 'Brennt Lehm zu Ziegeln.',
    inputs: { clay: 2 }, outputs: { bricks: 1 }, durationSec: 15, slots: 1, stockCap: 15,
  },
  weavery: {
    name: 'Weberei', icon: '🧶', category: 'refining',
    description: 'Webt Fasern zu Stoff.',
    inputs: { fiber: 3 }, outputs: { cloth: 1 }, durationSec: 18, slots: 1, stockCap: 10,
  },
  kitchen: {
    name: 'Küche', icon: '🍲', category: 'food',
    description: 'Kocht aus Beeren und Weizen sättigende Mahlzeiten.',
    inputs: { berries: 2, wheat: 1 }, outputs: { meals: 2 }, durationSec: 14, slots: 1, stockCap: 20,
  },
};

// Zustands-Loop der Dorfbewohner (alle Raten pro Sekunde).
export const VILLAGER_RULES = {
  baseVillagers: 2,
  maxVillagers: 5,
  workSatietyDrain: 0.6,
  workEnergyDrain: 0.45,
  idleEnergyRegen: 0.5,
  hungryBelow: 25,
  tiredBelow: 15,
  eatSeconds: 8,
  mealSatiety: 70,
  berriesPerSnack: 2,
  berrySatiety: 30,
  walkHomeSeconds: 3,
  restSeconds: 20,
  restEnergyRegen: 5,
  extraWorkerFactor: 0.8, // zweiter Arbeiter bringt +80 % Tempo
};

// effects: speed (Bonus pro Gebäudetyp oder "all"), storageCapBonus,
// autoCollect, mealSatietyBonus, villagerSlots (zusätzliche Bewohner).
export const TECHS = {
  sharpAxes: {
    name: 'Geschärfte Äxte', icon: '🪓', scope: 'player',
    description: 'Holzfällerhütte arbeitet 25 % schneller.',
    cost: { planks: 10, stone: 10 }, requires: [],
    effects: { speed: { lumberCamp: 0.25 } },
  },
  sturdyPicks: {
    name: 'Robuste Spitzhacken', icon: '⛏️', scope: 'player',
    description: 'Steinbruch und Tonkuhle arbeiten 25 % schneller.',
    cost: { planks: 15, stone: 15 }, requires: ['sharpAxes'],
    effects: { speed: { quarry: 0.25, clayPit: 0.25 } },
  },
  biggerBarns: {
    name: 'Größere Scheune', icon: '🏚️', scope: 'player',
    description: '+100 Lagerplatz für jeden Rohstoff.',
    cost: { planks: 20, bricks: 10 }, requires: [],
    effects: { storageCapBonus: 100 },
  },
  wheelbarrows: {
    name: 'Schubkarren', icon: '🛒', scope: 'player',
    description: 'Fertige Waren wandern automatisch ins Lager.',
    cost: { planks: 25, cloth: 5 }, requires: ['biggerBarns'],
    effects: { autoCollect: true },
  },
  heartyStew: {
    name: 'Herzhafter Eintopf', icon: '🍲', scope: 'player',
    description: 'Mahlzeiten sättigen um 20 Punkte mehr.',
    cost: { meals: 10, bricks: 5 }, requires: [],
    effects: { mealSatietyBonus: 20 },
  },
  cottage1: {
    name: 'Kleine Hütte', icon: '🏠', scope: 'player',
    description: 'Ein dritter Dorfbewohner zieht ein.',
    cost: { planks: 20, bricks: 15 }, requires: [],
    effects: { villagerSlots: 1 },
  },
  cottage2: {
    name: 'Fachwerkhaus', icon: '🏡', scope: 'player',
    description: 'Ein vierter Dorfbewohner zieht ein.',
    cost: { planks: 40, bricks: 30, cloth: 10 }, requires: ['cottage1'],
    effects: { villagerSlots: 1 },
  },
  cottage3: {
    name: 'Mooshof', icon: '🏘️', scope: 'player',
    description: 'Ein fünfter Dorfbewohner zieht ein.',
    cost: { planks: 80, bricks: 60, cloth: 25 }, requires: ['cottage2'],
    effects: { villagerSlots: 1 },
  },
  mossPaths: {
    name: 'Moos-Pfade', icon: '🛤️', scope: 'valley',
    description: 'Alle Gebäude aller Talbewohner arbeiten 10 % schneller.',
    cost: { planks: 60, stone: 60 }, requires: [],
    effects: { speed: { all: 0.1 } },
  },
  valleyGranary: {
    name: 'Tal-Kornspeicher', icon: '🏛️', scope: 'valley',
    description: '+50 Lagerplatz für alle Talbewohner.',
    cost: { bricks: 50, planks: 40, wheat: 60 }, requires: ['mossPaths'],
    effects: { storageCapBonus: 50 },
  },
};

export const VALLEY_PROJECTS = [
  {
    key: 'mossBridge', name: 'Moosbrücke', icon: '🌉',
    description: 'Eine breite Brücke über den Silberbach verbindet alle Höfe des Tals.',
    requirements: { planks: 150, stone: 200 },
    reward: { prestige: 30, seals: 5 },
  },
  {
    key: 'greatLibrary', name: 'Große Bibliothek', icon: '📚',
    description: 'Ein Ort, an dem das Wissen des Tals gesammelt und geteilt wird.',
    requirements: { planks: 300, bricks: 200, cloth: 60 },
    reward: { prestige: 60, seals: 12 },
  },
  {
    key: 'lanternFestival', name: 'Laternenfest', icon: '🏮',
    description: 'Ein Sommerfest mit Stofflaternen, Musik und langer Tafel.',
    requirements: { cloth: 80, meals: 120, wheat: 150 },
    reward: { prestige: 40, seals: 8 },
  },
];

export const VALLEY_PROJECTS_BY_KEY = Object.fromEntries(VALLEY_PROJECTS.map((p) => [p.key, p]));

// Das Handelsschiff wählt jedes Mal drei Kisten aus diesem Pool.
export const SHIP_DEMAND_POOL = [
  { resource: 'planks', base: 12 },
  { resource: 'bricks', base: 8 },
  { resource: 'cloth', base: 5 },
  { resource: 'meals', base: 15 },
  { resource: 'wheat', base: 25 },
  { resource: 'stone', base: 25 },
  { resource: 'berries', base: 30 },
];
export const SHIP_REWARD = { seals: 3, prestige: 10 };

export const STARTER_INVENTORY = { wood: 20, berries: 20, wheat: 10, meals: 6 };

export const VILLAGER_NAMES = [
  'Ida', 'Bo', 'Mika', 'Lene', 'Finn', 'Wiebke', 'Jasper', 'Romy', 'Ole', 'Pia',
  'Hannes', 'Malin', 'Theo', 'Smilla', 'Anton', 'Frieda', 'Juri', 'Nele', 'Kalle', 'Tilda',
];

export const VALLEY_NAME_PARTS = {
  first: ['Moos', 'Farn', 'Honig', 'Silber', 'Nebel', 'Birken', 'Distel', 'Linden', 'Klee'],
  second: ['tal', 'grund', 'au', 'wiesen', 'senke', 'hain'],
};

export function getPublicContent() {
  return {
    resources: RESOURCES,
    buildings: BUILDINGS,
    techs: Object.fromEntries(
      Object.entries(TECHS).map(([key, t]) => [key, { key, ...t }]),
    ),
    villagerRules: VILLAGER_RULES,
    projects: VALLEY_PROJECTS,
  };
}
