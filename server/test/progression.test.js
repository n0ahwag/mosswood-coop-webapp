import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILDINGS, QUESTS, STARTER_BUILDINGS, TECHS } from '../src/game/content.js';
import { computeEffects } from '../src/game/effects.js';
import { collectStock, simulateVillage } from '../src/game/engine.js';
import {
  advanceQuests, questProgress, recordStat, serializeProgression, unlocksAt,
} from '../src/game/progression.js';

const snap = (over = {}) => ({
  inventory: {}, baseStorageCap: 100, lastTickAt: 0, questStep: 0, stats: {}, questBase: {},
  buildings: [{ id: 'b1', type: 'berryFarm', progress: 0, loaded: false, stock: {}, status: 'idle' }],
  villagers: [{ id: 'v1', name: 'Ida', state: 'IDLE', energy: 100, satiety: 100, stateTimer: 0, buildingId: null }],
  techKeys: [],
  ...over,
});

describe('Hofbuch', () => {
  it('startet nur mit der Beerenfarm und ohne Bereiche', () => {
    const { buildings, features } = unlocksAt(0);
    assert.deepEqual([...buildings], STARTER_BUILDINGS);
    assert.equal(features.size, 0);
  });

  it('schaltet über die ganze Kette jedes Gebäude und jeden Bereich genau einmal frei', () => {
    const { buildings, features } = unlocksAt(QUESTS.length);
    assert.deepEqual([...buildings].sort(), Object.keys(BUILDINGS).sort());
    assert.deepEqual([...features].sort(), ['research', 'ship', 'valley', 'valleyResearch']);
  });

  it('jede Aufgabe ist mit dem erreichbar, was vorher freigeschaltet wurde', () => {
    QUESTS.forEach((q, i) => {
      const { buildings, features } = unlocksAt(i);
      const producers = Object.entries(BUILDINGS).filter(([, d]) => d.outputs[q.goal.resource]).map(([k]) => k);
      if (q.goal.type === 'assign') assert.ok(buildings.has(q.goal.building), q.key);
      if (q.goal.type === 'collect') assert.ok(producers.some((p) => buildings.has(p)), `${q.key}: kein Produzent`);
      if (q.goal.type === 'research') {
        assert.ok(features.has('research'), q.key);
        const affordable = Object.values(TECHS).some((t) => t.scope === 'player' && t.requires.length === 0
          && Object.keys(t.cost).every((r) => Object.entries(BUILDINGS).some(([k, d]) => buildings.has(k) && d.outputs[r])));
        assert.ok(affordable, `${q.key}: keine bezahlbare Forschung`);
      }
      if (q.goal.type === 'contribute') assert.ok(features.has('valley'), q.key);
      if (q.goal.type === 'shipLoad') assert.ok(features.has('ship'), q.key);
    });
  });

  it('erste Aufgabe: Bewohner auf die Beerenfarm', () => {
    const s = snap();
    assert.equal(questProgress(QUESTS[0], s), 0);
    s.villagers[0].buildingId = 'b1';
    const { completed, newBuildings } = advanceQuests(s);
    assert.deepEqual(completed, ['firstWork']);
    assert.deepEqual(newBuildings, []);
    assert.equal(s.questStep, 1);
  });

  it('zählt nur, was nach Beginn der Aufgabe eingesammelt wurde', () => {
    const s = snap({ questStep: 1, stats: { collected: { berries: 50 } } });
    s.questBase = structuredClone(s.stats);
    assert.equal(questProgress(QUESTS[1], s), 0);
    recordStat(s.stats, 'collected', 6, 'berries');
    const { completed, newBuildings } = advanceQuests(s);
    assert.deepEqual(completed, ['firstHarvest']);
    assert.deepEqual(newBuildings, ['lumberCamp']);
  });

  it('Einsammeln und Schubkarren zählen für das Hofbuch mit', () => {
    const s = snap({ villagers: [{ id: 'v1', name: 'Ida', state: 'WORKING', energy: 100, satiety: 100, stateTimer: 0, buildingId: 'b1' }] });
    simulateVillage(s, 8_000, computeEffects(['wheelbarrows']));
    assert.equal(s.stats.collected.berries, 2);
    const b = { stock: { wood: 4 } };
    collectStock(b, s.inventory, 100, s.stats);
    assert.equal(s.stats.collected.wood, 4);
  });

  it('gibt Belohnungen aus und meldet den Abschluss', () => {
    const cook = QUESTS.findIndex((q) => q.key === 'cook');
    const s = snap({ questStep: cook, stats: { collected: { meals: 4 } } });
    advanceQuests(s);
    assert.equal(s.inventory.meals, 4);
    const p = serializeProgression(s);
    assert.equal(p.quest.key, QUESTS[cook + 1].key);
    assert.ok(p.unlockedBuildings.includes('sawmill'));
    assert.ok(p.locked.every((l) => l.questIndex > cook));
  });

  it('nach der letzten Aufgabe gibt es keine weitere', () => {
    const s = snap({ questStep: QUESTS.length });
    assert.deepEqual(advanceQuests(s).completed, []);
    const p = serializeProgression(s);
    assert.equal(p.quest, null);
    assert.equal(p.locked.length, 0);
  });
});
