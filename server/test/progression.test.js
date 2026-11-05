import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUILDINGS, QUESTS, STARTER_BUILDINGS, STARTER_INVENTORY, TECHS,
} from '../src/game/content.js';
import { computeEffects } from '../src/game/effects.js';
import { collectStock, simulateVillage } from '../src/game/engine.js';
import {
  advanceQuests, buildPlans, featureSource, questProgress, recordStat, serializeProgression, unlockedFeatures,
} from '../src/game/progression.js';

const building = (type, id = `b-${type}`) => ({ id, type, progress: 0, loaded: false, stock: {}, status: 'idle' });

const snap = (over = {}) => ({
  inventory: {}, baseStorageCap: 100, lastTickAt: 0, questStep: 0, stats: {}, questBase: {},
  buildings: [building('berryFarm', 'b1')],
  villagers: [{ id: 'v1', name: 'Ida', state: 'IDLE', energy: 100, satiety: 100, stateTimer: 0, buildingId: null }],
  techKeys: [],
  ...over,
});

/** Welche Rohstoffe kann ein Hof mit diesen Gebäuden selbst herstellen? */
const producible = (types) => new Set(types.flatMap((t) => Object.keys(BUILDINGS[t].outputs)));

describe('Bauplan', () => {
  it('jedes Gebäude hat Kosten und nur bekannte Voraussetzungen', () => {
    for (const [type, def] of Object.entries(BUILDINGS)) {
      assert.ok(def.cost && Object.keys(def.cost).length > 0, `${type}: keine Baukosten`);
      for (const r of def.requires) assert.ok(BUILDINGS[r], `${type}: unbekannte Voraussetzung ${r}`);
    }
  });

  it('jedes Gebäude ist baubar: Voraussetzungen und Rohstoffe kommen von früheren Gebäuden', () => {
    const built = [...STARTER_BUILDINGS];
    const pending = Object.keys(BUILDINGS).filter((t) => !built.includes(t));
    // So lange bauen, wie etwas bezahlbar ist (Startvorrat zählt mit).
    let progress = true;
    while (pending.length && progress) {
      progress = false;
      for (const type of [...pending]) {
        const def = BUILDINGS[type];
        const can = producible(built);
        for (const r of Object.keys(STARTER_INVENTORY)) can.add(r);
        if (def.requires.every((r) => built.includes(r)) && Object.keys(def.cost).every((r) => can.has(r))) {
          built.push(type);
          pending.splice(pending.indexOf(type), 1);
          progress = true;
        }
      }
    }
    assert.deepEqual(pending, [], `nicht baubar: ${pending.join(', ')}`);
  });

  it('zeigt fehlende Voraussetzungen und ob der Bau bezahlbar ist', () => {
    const s = snap({ inventory: { wood: 12 } });
    const plans = Object.fromEntries(buildPlans(s).map((p) => [p.type, p]));
    assert.equal(plans.berryFarm, undefined);
    assert.equal(plans.lumberCamp.available, true);
    assert.equal(plans.lumberCamp.affordable, true);
    assert.deepEqual(plans.sawmill.missing, ['lumberCamp']);
    assert.equal(plans.sawmill.affordable, false);
  });

  it('Forschung und Tal öffnen die Wahrzeichen, Schiff und Tal-Forschung das Hofbuch', () => {
    assert.deepEqual(featureSource('research'), { kind: 'building', type: 'researchLab' });
    assert.deepEqual(featureSource('valley'), { kind: 'building', type: 'trainStation' });
    assert.equal(featureSource('ship').kind, 'quest');
    assert.equal(featureSource('valleyResearch').kind, 'quest');
    const s = snap();
    assert.equal(unlockedFeatures(s).size, 0);
    s.buildings.push(building('researchLab'));
    assert.deepEqual([...unlockedFeatures(s)], ['research']);
  });
});

describe('Hofbuch', () => {
  it('jede Aufgabe ist mit dem erreichbar, was die Aufgaben davor gebaut haben', () => {
    const built = new Set(STARTER_BUILDINGS);
    QUESTS.forEach((q, i) => {
      const features = unlockedFeatures({ questStep: i, buildings: [...built].map((t) => building(t)) });
      const can = producible([...built]);
      const { goal } = q;
      if (goal.type === 'assign') assert.ok(built.has(goal.building), q.key);
      if (goal.type === 'collect') assert.ok(can.has(goal.resource), `${q.key}: kein Produzent für ${goal.resource}`);
      if (goal.type === 'build') {
        assert.equal(goal.amount, goal.buildings.length, q.key);
        for (const t of goal.buildings) {
          assert.ok(BUILDINGS[t].requires.every((r) => built.has(r) || goal.buildings.includes(r)), `${q.key}: ${t} noch nicht baubar`);
          built.add(t);
        }
      }
      if (goal.type === 'research') {
        assert.ok(features.has('research'), q.key);
        const affordable = Object.values(TECHS).some((t) => t.scope === 'player' && t.requires.length === 0
          && Object.keys(t.cost).every((r) => can.has(r)));
        assert.ok(affordable, `${q.key}: keine bezahlbare Forschung`);
      }
      if (goal.type === 'contribute') assert.ok(features.has('valley'), q.key);
      if (goal.type === 'shipLoad') assert.ok(features.has('ship'), q.key);
    });
    // Am Ende des Hofbuchs steht jedes Gebäude.
    assert.deepEqual([...built].sort(), Object.keys(BUILDINGS).sort());
  });

  it('erste Aufgabe: Bewohner auf die Beerenfarm', () => {
    const s = snap();
    assert.equal(questProgress(QUESTS[0], s), 0);
    s.villagers[0].buildingId = 'b1';
    assert.deepEqual(advanceQuests(s).completed, ['firstWork']);
    assert.equal(s.questStep, 1);
  });

  it('zählt nur, was nach Beginn der Aufgabe eingesammelt wurde', () => {
    const s = snap({ questStep: 1, stats: { collected: { berries: 50 } } });
    s.questBase = structuredClone(s.stats);
    assert.equal(questProgress(QUESTS[1], s), 0);
    recordStat(s.stats, 'collected', 6, 'berries');
    assert.deepEqual(advanceQuests(s).completed, ['firstHarvest']);
  });

  it('Bau-Aufgaben zählen, was steht – auch wenn es schon vorher gebaut wurde', () => {
    const farm = QUESTS.findIndex((q) => q.key === 'farmKitchen');
    const s = snap({ questStep: farm - 1, buildings: [building('berryFarm'), building('lumberCamp'), building('wheatField')] });
    // Holzfäller steht schon → diese Aufgabe ist sofort erfüllt, die nächste halb.
    assert.deepEqual(advanceQuests(s).completed, ['buildLumber']);
    assert.equal(questProgress(QUESTS[farm], s), 1);
    s.buildings.push(building('kitchen'));
    assert.deepEqual(advanceQuests(s).completed, ['farmKitchen']);
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
    assert.ok(p.plans.some((plan) => plan.type === 'sawmill'));
  });

  it('nach der letzten Aufgabe gibt es keine weitere', () => {
    const s = snap({ questStep: QUESTS.length, buildings: Object.keys(BUILDINGS).map((t) => building(t)) });
    assert.deepEqual(advanceQuests(s).completed, []);
    const p = serializeProgression(s);
    assert.equal(p.quest, null);
    assert.equal(p.plans.length, 0);
    assert.deepEqual(p.features.sort(), ['research', 'ship', 'valley', 'valleyResearch']);
  });
});
