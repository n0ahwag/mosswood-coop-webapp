import { prisma, Prisma, withRetry } from '../db.js';
import { config } from '../config.js';
import {
  BUILDINGS, FEATURES, QUESTS, RESOURCES, VILLAGER_NAMES,
} from '../game/content.js';
import { computeEffects } from '../game/effects.js';
import {
  advanceQuests, featureSource, missingRequirements, recordStat, serializeProgression, unlockedFeatures,
} from '../game/progression.js';
import {
  collectStock, effectiveStorageCap, simulateVillage, takeResources, tickVillage,
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
    questStep: village.questStep,
    stats: structuredClone(village.stats ?? {}),
    questBase: structuredClone(village.questBase ?? {}),
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
    data: {
      inventory: snap.inventory,
      lastTickAt: new Date(snap.lastTickAt),
      questStep: snap.questStep,
      stats: snap.stats,
      questBase: snap.questBase,
    },
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
    progression: serializeProgression(snap),
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

          // Hofbuch: erfüllte Aufgaben abschließen und Belohnungen ausgeben.
          const { completed } = advanceQuests(snap);
          if (completed.length) snap.completedQuests = completed;

          const effects = computeEffects(snap.techKeys);
          tickVillage(snap, 0, effects); // Status nach der Aktion aktualisieren
          await persistSnapshot(tx, snap);
          return { state: serializeVillage(snap, effects), result, completedQuests: snap.completedQuests ?? [] };
        },
        {
          timeout: 15_000,
          ...(serializable && { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
        },
      ),
    ),
  );
}

/** Wirft einen verständlichen Fehler, wenn ein Bereich noch gesperrt ist. */
export function requireFeature(snap, feature) {
  if (unlockedFeatures(snap).has(feature)) return;
  const source = featureSource(feature);
  const name = FEATURES[feature]?.name ?? feature;
  if (source.kind === 'building') {
    // Beide Wahrzeichen sind maskulin: der Forschungsturm, der Bahnhof.
    throw new GameError(`${name}: Baue zuerst den ${BUILDINGS[source.type].name}`, 'LOCKED', 403);
  }
  throw new GameError(`${name} schaltest du mit der Aufgabe „${QUESTS[source.index]?.title}“ im Hofbuch frei`, 'LOCKED', 403);
}

/** Baut ein neues Gebäude, wenn Voraussetzungen und Rohstoffe passen. */
export function buildBuilding(villageId, type) {
  return mutateVillage(villageId, async (snap, { tx }) => {
    const def = BUILDINGS[type];
    if (!def) throw new GameError('Dieses Gebäude gibt es nicht', 'NOT_FOUND', 404);
    if (snap.buildings.some((b) => b.type === type)) throw new GameError(`${def.name} steht schon`);

    const missing = missingRequirements(snap, type);
    if (missing.length) {
      throw new GameError(`Für ${def.name} muss zuerst ${missing.map((m) => BUILDINGS[m].name).join(' und ')} stehen`);
    }
    const lacking = Object.entries(def.cost)
      .filter(([res, n]) => (snap.inventory[res] ?? 0) < n)
      .map(([res, n]) => `${n - (snap.inventory[res] ?? 0)} ${RESOURCES[res]?.name ?? res}`);
    if (lacking.length) throw new GameError(`Für ${def.name} fehlen dir noch ${lacking.join(', ')}`);

    takeResources(snap.inventory, def.cost);
    const b = await tx.building.create({ data: { villageId: snap.id, type } });
    snap.buildings.push({
      id: b.id, type: b.type, level: b.level, progress: 0, loaded: false, stock: {}, status: 'idle',
    });
    recordStat(snap.stats, 'built', 1);
    return { type, name: def.name, icon: def.icon, buildingId: b.id, feature: def.feature ?? null };
  });
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
    const moved = collectStock(building, snap.inventory, cap, snap.stats);
    if (Object.keys(moved).length === 0) throw new GameError('Dein Lager ist voll');
    return { moved };
  });
}
