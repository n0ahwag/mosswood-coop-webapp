import { prisma, Prisma, withRetry } from '../db.js';
import { config } from '../config.js';
import { BUILDINGS, VILLAGER_NAMES } from '../game/content.js';
import { computeEffects } from '../game/effects.js';
import {
  collectStock, effectiveStorageCap, simulateVillage, tickVillage,
} from '../game/engine.js';
import { GameError, pick } from '../utils/errors.js';
import { withLock } from '../utils/lock.js';

const round1 = (n) => Math.round(n * 10) / 10;

export async function loadSnapshot(db, villageId) {
  const village = await db.village.findUnique({
    where: { id: villageId },
    include: {
      buildings: { orderBy: { type: 'asc' } },
      villagers: { orderBy: { createdAt: 'asc' } },
      owner: { select: { id: true, valleyId: true } },
    },
  });
  if (!village) throw new GameError('Dorf nicht gefunden', 'NOT_FOUND', 404);

  const research = await db.researchUnlock.findMany({
    where: {
      OR: [
        { userId: village.ownerId },
        ...(village.owner.valleyId ? [{ valleyId: village.owner.valleyId }] : []),
      ],
    },
    select: { techKey: true, valleyId: true },
  });

  return {
    id: village.id,
    name: village.name,
    ownerId: village.ownerId,
    valleyId: village.owner.valleyId,
    inventory: { ...village.inventory },
    baseStorageCap: village.storageCap,
    lastTickAt: village.lastTickAt.getTime(),
    buildings: village.buildings.map((b) => ({
      id: b.id,
      type: b.type,
      level: b.level,
      progress: b.progress,
      loaded: b.loaded,
      stock: { ...b.stock },
      status: 'idle',
    })),
    villagers: village.villagers.map((v) => ({
      id: v.id,
      name: v.name,
      state: v.state,
      energy: v.energy,
      satiety: v.satiety,
      stateTimer: v.stateTimer,
      buildingId: v.buildingId,
    })),
    techKeys: research.map((r) => r.techKey),
    valleyTechKeys: research.filter((r) => r.valleyId).map((r) => r.techKey),
  };
}

async function persistSnapshot(db, snap) {
  await db.village.update({
    where: { id: snap.id },
    data: { inventory: snap.inventory, lastTickAt: new Date(snap.lastTickAt) },
  });
  for (const b of snap.buildings) {
    await db.building.update({
      where: { id: b.id },
      data: { progress: b.progress, loaded: b.loaded, stock: b.stock },
    });
  }
  for (const v of snap.villagers) {
    await db.villager.update({
      where: { id: v.id },
      data: {
        state: v.state,
        energy: v.energy,
        satiety: v.satiety,
        stateTimer: v.stateTimer,
        buildingId: v.buildingId,
      },
    });
  }
}

export function serializeVillage(snap, effects) {
  return {
    id: snap.id,
    name: snap.name,
    inventory: snap.inventory,
    storageCap: effectiveStorageCap(snap, effects),
    villagerSlots: effects.villagerSlots,
    techKeys: [...new Set(snap.techKeys)],
    buildings: snap.buildings.map((b) => ({
      id: b.id,
      type: b.type,
      level: b.level,
      progress: round1(b.progress),
      loaded: b.loaded,
      stock: b.stock,
      status: b.status,
      workerIds: snap.villagers.filter((v) => v.buildingId === b.id).map((v) => v.id),
    })),
    villagers: snap.villagers.map((v) => ({
      ...v,
      energy: round1(v.energy),
      satiety: round1(v.satiety),
      stateTimer: round1(v.stateTimer),
    })),
    serverTime: Date.now(),
  };
}

/**
 * Lädt ein Dorf, rechnet die Simulation bis "jetzt", führt optional eine Aktion aus
 * und speichert alles in einer Transaktion. Pro Dorf läuft immer nur ein Aufruf gleichzeitig.
 */
export function mutateVillage(villageId, fn, { serializable = false } = {}) {
  return withLock(`village:${villageId}`, () =>
    withRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const snap = await loadSnapshot(tx, villageId);
          simulateVillage(snap, Date.now(), computeEffects(snap.techKeys), config.maxOfflineSeconds);

          const result = fn ? await fn(snap, { tx }) : undefined;

          const effects = computeEffects(snap.techKeys);
          tickVillage(snap, 0, effects); // Status nach der Aktion aktualisieren
          await persistSnapshot(tx, snap);
          return { state: serializeVillage(snap, effects), result };
        },
        {
          timeout: 15_000,
          ...(serializable && { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
        },
      ),
    ),
  );
}

export async function createVillager(tx, snap) {
  const taken = new Set(snap.villagers.map((v) => v.name));
  const free = VILLAGER_NAMES.filter((n) => !taken.has(n));
  const villager = await tx.villager.create({
    data: { villageId: snap.id, name: pick(free.length ? free : VILLAGER_NAMES) },
  });
  snap.villagers.push({
    id: villager.id,
    name: villager.name,
    state: villager.state,
    energy: villager.energy,
    satiety: villager.satiety,
    stateTimer: villager.stateTimer,
    buildingId: null,
  });
  return villager;
}

export function assignVillager(villageId, villagerId, buildingId) {
  return mutateVillage(villageId, (snap) => {
    const villager = snap.villagers.find((v) => v.id === villagerId);
    if (!villager) throw new GameError('Dorfbewohner nicht gefunden', 'NOT_FOUND', 404);

    if (buildingId === null) {
      villager.buildingId = null;
      if (villager.state === 'WORKING') villager.state = 'IDLE';
      return { villager: villager.name, building: null };
    }

    const building = snap.buildings.find((b) => b.id === buildingId);
    if (!building) throw new GameError('Gebäude nicht gefunden', 'NOT_FOUND', 404);
    const def = BUILDINGS[building.type];
    const occupied = snap.villagers.filter(
      (v) => v.buildingId === building.id && v.id !== villager.id,
    ).length;
    if (occupied >= def.slots) throw new GameError(`${def.name}: alle Arbeitsplätze sind belegt`);

    villager.buildingId = building.id;
    return { villager: villager.name, building: def.name };
  });
}

export function collectBuilding(villageId, buildingId) {
  return mutateVillage(villageId, (snap) => {
    const building = snap.buildings.find((b) => b.id === buildingId);
    if (!building) throw new GameError('Gebäude nicht gefunden', 'NOT_FOUND', 404);
    const hasStock = Object.values(building.stock).some((n) => n > 0);
    if (!hasStock) throw new GameError('Hier gibt es noch nichts einzusammeln');

    const cap = effectiveStorageCap(snap, computeEffects(snap.techKeys));
    const moved = collectStock(building, snap.inventory, cap);
    if (Object.keys(moved).length === 0) throw new GameError('Dein Lager ist voll');
    return { moved };
  });
}
