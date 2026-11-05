// Economy Engine – reine Funktionen ohne Datenbankzugriff, damit sie leicht testbar sind.
// Ein "Snapshot" ist ein einfaches Objekt mit inventory, buildings, villagers und lastTickAt.

import { BUILDINGS, VILLAGER_RULES as R } from './content.js';

export function hasResources(inventory, cost) {
  return Object.entries(cost).every(([res, n]) => (inventory[res] ?? 0) >= n);
}

export function takeResources(inventory, cost) {
  for (const [res, n] of Object.entries(cost)) inventory[res] = (inventory[res] ?? 0) - n;
}

export function addResources(target, gain) {
  for (const [res, n] of Object.entries(gain)) target[res] = (target[res] ?? 0) + n;
}

function findFood(inventory, effects) {
  if ((inventory.meals ?? 0) >= 1) {
    return { cost: { meals: 1 }, satiety: R.mealSatiety + effects.mealSatietyBonus };
  }
  if ((inventory.berries ?? 0) >= R.berriesPerSnack) {
    return { cost: { berries: R.berriesPerSnack }, satiety: R.berrySatiety };
  }
  return null;
}

function resumeAfterBreak(v) {
  if (v.satiety <= R.hungryBelow) {
    v.state = 'HUNGRY';
  } else if (v.energy <= R.tiredBelow) {
    v.state = 'TIRED';
    v.stateTimer = R.walkHomeSeconds;
  } else {
    v.state = v.buildingId ? 'WORKING' : 'IDLE';
  }
}

// Zustands-Loop: Arbeiten → Hungern/Ermüden → Essen/Ausruhen → Weiterarbeiten
export function stepVillager(v, dt, ctx) {
  const { inventory, effects } = ctx;

  switch (v.state) {
    case 'IDLE':
      v.energy = Math.min(100, v.energy + R.idleEnergyRegen * dt);
      if (v.buildingId) resumeAfterBreak(v);
      break;

    case 'WORKING':
      if (!v.buildingId) {
        v.state = 'IDLE';
        break;
      }
      v.satiety = Math.max(0, v.satiety - R.workSatietyDrain * dt);
      v.energy = Math.max(0, v.energy - R.workEnergyDrain * dt);
      if (v.satiety <= R.hungryBelow) {
        v.state = 'HUNGRY';
      } else if (v.energy <= R.tiredBelow) {
        v.state = 'TIRED';
        v.stateTimer = R.walkHomeSeconds;
      }
      break;

    case 'HUNGRY': {
      const food = findFood(inventory, effects);
      if (food) {
        takeResources(inventory, food.cost);
        v.satiety = Math.min(100, v.satiety + food.satiety);
        v.state = 'EATING';
        v.stateTimer = R.eatSeconds;
      }
      // ohne Essen im Lager bleibt der Bewohner hungrig und arbeitet nicht
      break;
    }

    case 'EATING':
      v.stateTimer -= dt;
      if (v.stateTimer <= 0) {
        v.stateTimer = 0;
        resumeAfterBreak(v);
      }
      break;

    case 'TIRED':
      v.stateTimer -= dt;
      if (v.stateTimer <= 0) {
        v.state = 'RESTING';
        v.stateTimer = R.restSeconds;
      }
      break;

    case 'RESTING':
      v.energy = Math.min(100, v.energy + R.restEnergyRegen * dt);
      v.stateTimer -= dt;
      if (v.stateTimer <= 0) {
        v.stateTimer = 0;
        resumeAfterBreak(v);
      }
      break;

    default:
      v.state = 'IDLE';
  }
}

// Verschiebt fertige Waren aus dem Gebäude ins Dorflager (bis zur Kapazitätsgrenze).
// Mit `stats` wird mitgezählt, wie viel insgesamt eingesammelt wurde (für das Hofbuch).
export function collectStock(building, inventory, storageCap, stats) {
  const moved = {};
  for (const [res, n] of Object.entries(building.stock)) {
    const space = Math.max(0, storageCap - (inventory[res] ?? 0));
    const amount = Math.min(n, space);
    if (amount <= 0) continue;
    building.stock[res] = n - amount;
    inventory[res] = (inventory[res] ?? 0) + amount;
    moved[res] = amount;
    if (stats) {
      stats.collected ??= {};
      stats.collected[res] = (stats.collected[res] ?? 0) + amount;
    }
  }
  return moved;
}

export function isStockFull(building, def) {
  return Object.entries(def.outputs).some(
    ([res, n]) => (building.stock[res] ?? 0) + n > def.stockCap,
  );
}

export function stepBuilding(b, dt, ctx) {
  const def = BUILDINGS[b.type];
  if (!def) {
    b.status = 'idle';
    return;
  }
  const { inventory, effects, storageCap, workers, stats } = ctx;

  if (effects.autoCollect) collectStock(b, inventory, storageCap, stats);
  if (isStockFull(b, def)) {
    b.status = 'full';
    return;
  }

  const workerCount = workers.get(b.id) ?? 0;
  if (workerCount === 0) {
    b.status = 'idle';
    return;
  }

  if (!b.loaded) {
    if (!hasResources(inventory, def.inputs)) {
      b.status = 'missingInputs';
      return;
    }
    takeResources(inventory, def.inputs);
    b.loaded = true;
  }

  const speed = 1 + (effects.speed[b.type] ?? 0) + (effects.speed.all ?? 0);
  const workerFactor = 1 + (workerCount - 1) * R.extraWorkerFactor;
  b.progress += dt * speed * workerFactor;
  b.status = 'working';

  if (b.progress >= def.durationSec) {
    addResources(b.stock, def.outputs);
    b.progress = Math.min(b.progress - def.durationSec, def.durationSec - 0.001);
    b.loaded = false;
    if (effects.autoCollect) collectStock(b, inventory, storageCap, stats);
  }
}

export function effectiveStorageCap(snap, effects) {
  return snap.baseStorageCap + effects.storageCapBonus;
}

// Ein Simulationsschritt für das ganze Dorf. dt = 0 berechnet nur die Status neu.
export function tickVillage(snap, dt, effects) {
  const ctx = {
    inventory: snap.inventory,
    effects,
    storageCap: effectiveStorageCap(snap, effects),
    workers: new Map(),
    stats: (snap.stats ??= {}),
  };

  for (const v of snap.villagers) stepVillager(v, dt, ctx);
  for (const v of snap.villagers) {
    if (v.state === 'WORKING' && v.buildingId) {
      ctx.workers.set(v.buildingId, (ctx.workers.get(v.buildingId) ?? 0) + 1);
    }
  }
  for (const b of snap.buildings) stepBuilding(b, dt, ctx);
}

// Holt die Simulation von snap.lastTickAt bis nowMs auf (auch Offline-Fortschritt).
export function simulateVillage(snap, nowMs, effects, maxSeconds = 8 * 3600) {
  let elapsed = Math.min(Math.max(0, (nowMs - snap.lastTickAt) / 1000), maxSeconds);
  if (elapsed === 0) tickVillage(snap, 0, effects);
  while (elapsed > 0) {
    const step = Math.min(elapsed, elapsed > 600 ? 5 : 1);
    tickVillage(snap, step, effects);
    elapsed -= step;
  }
  snap.lastTickAt = nowMs;
  return snap;
}
