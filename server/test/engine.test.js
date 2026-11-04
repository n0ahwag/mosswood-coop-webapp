import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VILLAGER_RULES as R } from '../src/game/content.js';
import { computeEffects } from '../src/game/effects.js';
import { collectStock, simulateVillage, stepVillager, tickVillage } from '../src/game/engine.js';

const villager = (over = {}) => ({
  id: 'v1', name: 'Ida', state: 'IDLE', energy: 100, satiety: 100, stateTimer: 0, buildingId: null, ...over,
});
const building = (type, over = {}) => ({
  id: `b-${type}`, type, level: 1, progress: 0, loaded: false, stock: {}, status: 'idle', ...over,
});
const snapshot = (over = {}) => ({
  inventory: {}, baseStorageCap: 100, lastTickAt: 0, buildings: [], villagers: [], techKeys: [], ...over,
});

describe('Dorfbewohner-Zustands-Loop', () => {
  const ctx = (inventory = {}) => ({ inventory, effects: computeEffects([]) });

  it('beginnt zu arbeiten, sobald eine Arbeitsstätte zugewiesen ist', () => {
    const v = villager({ buildingId: 'b1' });
    stepVillager(v, 1, ctx());
    assert.equal(v.state, 'WORKING');
  });

  it('bekommt beim Arbeiten Hunger und isst eine Mahlzeit aus dem Lager', () => {
    const inv = { meals: 1 };
    const v = villager({ state: 'WORKING', buildingId: 'b1', satiety: R.hungryBelow + 0.1 });
    stepVillager(v, 1, ctx(inv));
    assert.equal(v.state, 'HUNGRY');
    stepVillager(v, 1, ctx(inv));
    assert.equal(v.state, 'EATING');
    assert.equal(inv.meals, 0);
    assert.ok(v.satiety > 80);
  });

  it('weicht auf Beeren aus und bleibt ohne Essen hungrig', () => {
    const inv = { berries: R.berriesPerSnack };
    const v = villager({ state: 'HUNGRY', buildingId: 'b1', satiety: 10 });
    stepVillager(v, 1, ctx(inv));
    assert.equal(v.state, 'EATING');
    assert.equal(inv.berries, 0);

    const starving = villager({ state: 'HUNGRY', buildingId: 'b1', satiety: 10 });
    stepVillager(starving, 1, ctx({}));
    assert.equal(starving.state, 'HUNGRY');
  });

  it('ermüdet, ruht sich aus und arbeitet danach weiter', () => {
    const v = villager({ state: 'WORKING', buildingId: 'b1', energy: R.tiredBelow + 0.1 });
    const c = ctx();
    stepVillager(v, 1, c);
    assert.equal(v.state, 'TIRED');
    for (let i = 0; i < R.walkHomeSeconds; i++) stepVillager(v, 1, c);
    assert.equal(v.state, 'RESTING');
    for (let i = 0; i < R.restSeconds; i++) stepVillager(v, 1, c);
    assert.equal(v.state, 'WORKING');
    assert.equal(v.energy, 100);
  });
});

describe('Produktionsketten', () => {
  it('Holzfällerhütte produziert Holz in den Gebäude-Vorrat', () => {
    const snap = snapshot({
      buildings: [building('lumberCamp')],
      villagers: [villager({ state: 'WORKING', buildingId: 'b-lumberCamp' })],
    });
    simulateVillage(snap, 12_000, computeEffects([]));
    assert.equal(snap.buildings[0].stock.wood, 2);
  });

  it('Sägewerk verbraucht 2 Holz pro Planke und wartet ohne Zutaten', () => {
    const snap = snapshot({
      inventory: { wood: 2 },
      buildings: [building('sawmill')],
      villagers: [villager({ state: 'WORKING', buildingId: 'b-sawmill' })],
    });
    simulateVillage(snap, 12_000, computeEffects([]));
    assert.equal(snap.inventory.wood, 0);
    assert.equal(snap.buildings[0].stock.planks, 1);

    simulateVillage(snap, 13_000, computeEffects([]));
    assert.equal(snap.buildings[0].status, 'missingInputs');
  });

  it('stoppt, wenn der Gebäude-Vorrat voll ist', () => {
    const snap = snapshot({
      buildings: [building('flaxField', { stock: { fiber: 20 } })],
      villagers: [villager({ state: 'WORKING', buildingId: 'b-flaxField' })],
    });
    tickVillage(snap, 1, computeEffects([]));
    assert.equal(snap.buildings[0].status, 'full');
  });

  it('Einsammeln respektiert die Lagerkapazität', () => {
    const b = building('lumberCamp', { stock: { wood: 30 } });
    const inv = { wood: 90 };
    const moved = collectStock(b, inv, 100);
    assert.deepEqual(moved, { wood: 10 });
    assert.equal(inv.wood, 100);
    assert.equal(b.stock.wood, 20);
  });

  it('Schubkarren sammeln automatisch ein', () => {
    const snap = snapshot({
      buildings: [building('lumberCamp')],
      villagers: [villager({ state: 'WORKING', buildingId: 'b-lumberCamp' })],
    });
    simulateVillage(snap, 6_000, computeEffects(['wheelbarrows']));
    assert.equal(snap.inventory.wood, 1);
  });
});

describe('Forschungseffekte', () => {
  it('addiert Boni und begrenzt Dorfbewohner auf 5', () => {
    const fx = computeEffects(['sharpAxes', 'mossPaths', 'biggerBarns', 'cottage1', 'cottage2', 'cottage3']);
    assert.equal(fx.speed.lumberCamp, 0.25);
    assert.equal(fx.speed.all, 0.1);
    assert.equal(fx.storageCapBonus, 100);
    assert.equal(fx.villagerSlots, 5);
  });
});
