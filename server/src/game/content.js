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
// cost: Baukosten aus dem Lager. requires: Gebäude, die vorher stehen müssen.
// Wahrzeichen (category "landmark") haben keine Arbeiter, schalten aber einen Bereich (feature) frei.
// Die Reihenfolge entspricht dem Bauplan, so wie ein neuer Hof wächst.
export const BUILDINGS = {
  berryFarm: {
    name: 'Beerenfarm', icon: '🫐', category: 'gathering',
    description: 'Pflückt Wildbeeren in den Hecken.',
    inputs: {}, outputs: { berries: 2 }, durationSec: 8, slots: 1, stockCap: 30,
    cost: { wood: 8 }, requires: [],
  },
  lumberCamp: {
    name: 'Holzfällerhütte', icon: '🪓', category: 'gathering',
    description: 'Fällt Bäume auf dem Waldgipfel.',
    inputs: {}, outputs: { wood: 1 }, durationSec: 6, slots: 2, stockCap: 30,
    cost: { wood: 12 }, requires: [],
  },
  wheatField: {
    name: 'Weizenfeld', icon: '🌾', category: 'gathering',
    description: 'Erntet goldenen Weizen auf der Sonnenterrasse.',
    inputs: {}, outputs: { wheat: 1 }, durationSec: 10, slots: 2, stockCap: 30,
    cost: { wood: 10 }, requires: ['lumberCamp'],
  },
  kitchen: {
    name: 'Küche', icon: '🍲', category: 'food',
    description: 'Kocht aus Beeren und Weizen sättigende Mahlzeiten.',
    inputs: { berries: 2, wheat: 1 }, outputs: { meals: 2 }, durationSec: 14, slots: 1, stockCap: 20,
    cost: { wood: 18 }, requires: ['wheatField'],
  },
  sawmill: {
    name: 'Sägewerk', icon: '🪚', category: 'refining',
    description: 'Sägt Holz zu Planken.',
    inputs: { wood: 2 }, outputs: { planks: 1 }, durationSec: 12, slots: 1, stockCap: 15,
    cost: { wood: 24 }, requires: ['lumberCamp'],
  },
  quarry: {
    name: 'Steinbruch', icon: '⛏️', category: 'gathering',
    description: 'Bricht Steine aus dem Felsgipfel.',
    inputs: {}, outputs: { stone: 1 }, durationSec: 9, slots: 2, stockCap: 20,
    cost: { wood: 12, planks: 6 }, requires: ['sawmill'],
  },
  researchLab: {
    name: 'Forschungsturm', icon: '🔭', category: 'landmark', feature: 'research',
    description: 'Ein Observatorium auf dem höchsten Gipfel. Hier erforschst du Verbesserungen.',
    inputs: {}, outputs: {}, durationSec: 1, slots: 0, stockCap: 0,
    cost: { planks: 10, stone: 10 }, requires: ['quarry'],
  },
  clayPit: {
    name: 'Tonkuhle', icon: '🏺', category: 'gathering',
    description: 'Gräbt feuchten Lehm am Bergsee.',
    inputs: {}, outputs: { clay: 1 }, durationSec: 7, slots: 2, stockCap: 25,
    cost: { planks: 6, stone: 8 }, requires: ['quarry'],
  },
  brickKiln: {
    name: 'Ziegelbrennerei', icon: '🔥', category: 'refining',
    description: 'Brennt Lehm zu Ziegeln.',
    inputs: { clay: 2 }, outputs: { bricks: 1 }, durationSec: 15, slots: 1, stockCap: 15,
    cost: { stone: 12, clay: 8 }, requires: ['clayPit'],
  },
  trainStation: {
    name: 'Bahnhof', icon: '🚂', category: 'landmark', feature: 'valley',
    description: 'Die Bergbahn fährt von hier hinunter ins Tal zu deinen Nachbarn.',
    inputs: {}, outputs: {}, durationSec: 1, slots: 0, stockCap: 0,
    cost: { planks: 15, stone: 10, bricks: 8 }, requires: ['brickKiln'],
  },
  flaxField: {
    name: 'Flachsfeld', icon: '🌿', category: 'gathering',
    description: 'Gewinnt Fasern aus Flachs. Die Samen kommen mit der Bahn aus dem Tal.',
    inputs: {}, outputs: { fiber: 1 }, durationSec: 8, slots: 1, stockCap: 20,
    cost: { wood: 15, planks: 8 }, requires: ['trainStation'],
  },
  weavery: {
    name: 'Weberei', icon: '🧶', category: 'refining',
    description: 'Webt Fasern zu Stoff.',
    inputs: { fiber: 3 }, outputs: { cloth: 1 }, durationSec: 18, slots: 1, stockCap: 10,
    cost: { planks: 12, bricks: 8, fiber: 6 }, requires: ['flaxField'],
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

// ---------- Fortschritt: das Hofbuch ----------
// Neue Spieler starten klein: eine Beerenfarm und etwas Holz. Jedes weitere Gebäude
// bauen sie selbst mit Rohstoffen aus dem Lager. Das Hofbuch führt sie Schritt für
// Schritt durch die Mechaniken und verschenkt unterwegs kleine Vorräte.

export const STARTER_BUILDINGS = ['berryFarm'];
export const STARTER_INVENTORY = { berries: 12, wood: 12 };

export const FEATURES = {
  research: { name: 'Forschung', icon: '📜' },
  valley: { name: 'Gemeinschaftsprojekte', icon: '🏞️' },
  ship: { name: 'Handelsschiff', icon: '⛵' },
  valleyResearch: { name: 'Tal-Forschung', icon: '🛤️' },
};

// goal.type: assign (Bewohner in Gebäude), collect (Ware einsammeln), build (Gebäude bauen),
// research (Technik erforschen), contribute (in Tal-Projekte einzahlen), shipLoad.
export const QUESTS = [
  {
    key: 'firstWork', icon: '🫐', title: 'Ein neuer Anfang',
    text: 'Deine zwei Bewohner warten auf dem Dorfplatz. Tippe eine Person an und dann die Beerenfarm.',
    goal: { type: 'assign', building: 'berryFarm', amount: 1 },
    reward: {},
  },
  {
    key: 'firstHarvest', icon: '🧺', title: 'Erste Ernte',
    text: 'Fertige Waren sammeln sich im Gebäude. Tippe auf das goldene Einsammeln-Schild, bis 6 Beeren in deinem Lager sind.',
    goal: { type: 'collect', resource: 'berries', amount: 6 },
    reward: {},
  },
  {
    key: 'buildLumber', icon: '🪓', title: 'Der erste Neubau',
    text: 'Auf den Gipfeln stehen die Ruinen eines alten Dorfes. Du baust sie mit Rohstoffen aus deinem Lager wieder auf. Tippe die verfallene Holzfällerhütte auf dem Waldgipfel an.',
    goal: { type: 'build', buildings: ['lumberCamp'], amount: 1 },
    reward: {},
  },
  {
    key: 'farmKitchen', icon: '🌾', title: 'Korn und Kochtopf',
    text: 'Schick jemanden zum Holzfällen. Mit dem Holz baust du das verwilderte Weizenfeld und danach die alte Küche wieder auf.',
    goal: { type: 'build', buildings: ['wheatField', 'kitchen'], amount: 2 },
    reward: {},
  },
  {
    key: 'cook', icon: '🥧', title: 'Warme Mahlzeit',
    text: 'Die Küche macht aus 2 Beeren und 1 Weizen zwei Mahlzeiten. Sie sättigen viel besser als Beeren. Koche 4 Mahlzeiten.',
    goal: { type: 'collect', resource: 'meals', amount: 4 },
    reward: { resources: { meals: 4 } },
  },
  {
    key: 'buildSawmill', icon: '🪚', title: 'Bretter für alles',
    text: 'Das Sägewerk sägt aus 2 Holz eine Planke. Planken brauchst du für fast jeden weiteren Bau.',
    goal: { type: 'build', buildings: ['sawmill'], amount: 1 },
    reward: {},
  },
  {
    key: 'buildQuarry', icon: '⛏️', title: 'Auf den Felsgipfel',
    text: 'Für den Steinbruch brauchst du Holz und Planken. Lass das Sägewerk arbeiten und baue dann den Steinbruch.',
    goal: { type: 'build', buildings: ['quarry'], amount: 1 },
    reward: { resources: { wood: 6 } },
  },
  {
    key: 'buildLab', icon: '🔭', title: 'Dem Himmel so nah',
    text: 'Auf dem höchsten Gipfel verfällt eine alte Sternwarte. Bau den Forschungsturm mit Planken und Stein wieder auf.',
    goal: { type: 'build', buildings: ['researchLab'], amount: 1 },
    reward: {},
  },
  {
    key: 'firstResearch', icon: '📜', title: 'Kluge Köpfe',
    text: 'Im Forschungsturm verbesserst du deinen Hof dauerhaft. Erforsche eine Technik, zum Beispiel „Geschärfte Äxte“.',
    goal: { type: 'research', amount: 1 },
    reward: {},
  },
  {
    key: 'bricksCraft', icon: '🔥', title: 'Lehm und Feuer',
    text: 'Am Bergsee liegen eine alte Tonkuhle und eine zerfallene Ziegelbrennerei. Bau erst die Tonkuhle auf, mit ihrem Lehm dann die Brennerei.',
    goal: { type: 'build', buildings: ['clayPit', 'brickKiln'], amount: 2 },
    reward: { resources: { planks: 6 } },
  },
  {
    key: 'buildStation', icon: '🚂', title: 'Gleise ins Tal',
    text: 'Unten im Tal leben deine Nachbarn. Bring den verlassenen Bahnhof wieder in Schuss, dann bringt dich die Bergbahn zu ihnen.',
    goal: { type: 'build', buildings: ['trainStation'], amount: 1 },
    reward: {},
  },
  {
    key: 'helpValley', icon: '🌉', title: 'Gemeinsam stark',
    text: 'Dein Tal baut an großen Monumenten. Fahr mit der Bahn hinunter und zahle insgesamt 10 Waren in ein Projekt ein.',
    goal: { type: 'contribute', amount: 10 },
    reward: { resources: { planks: 8 } },
  },
  {
    key: 'textiles', icon: '🧶', title: 'Feine Fäden',
    text: 'Mit der Bahn kommen Flachssamen aus dem Tal. Baue ein Flachsfeld und danach die Weberei.',
    goal: { type: 'build', buildings: ['flaxField', 'weavery'], amount: 2 },
    reward: {},
  },
  {
    key: 'cloth', icon: '🧵', title: 'Stoff vom Webstuhl',
    text: 'Die Weberei macht aus 3 Fasern einen Stoff. Webe 3 Stoffe.',
    goal: { type: 'collect', resource: 'cloth', amount: 3 },
    reward: { features: ['ship'] },
  },
  {
    key: 'tradeShip', icon: '⛵', title: 'Ahoi!',
    text: 'Das Handelsschiff kommt regelmäßig ins Tal. Lade 5 Waren auf, während es im Hafen liegt.',
    goal: { type: 'shipLoad', amount: 5 },
    reward: { features: ['valleyResearch'], resources: { meals: 10 } },
  },
];

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
    quests: QUESTS,
    features: FEATURES,
  };
}
