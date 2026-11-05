import { prisma } from '../db.js';
import { config } from '../config.js';
import {
  RESOURCES, SHIP_DEMAND_POOL, SHIP_REWARD, VALLEY_PROJECTS, VALLEY_PROJECTS_BY_KEY,
} from '../game/content.js';
import { GameError } from '../utils/errors.js';
import { withLock } from '../utils/lock.js';
import { recordStat } from '../game/progression.js';
import { mutateVillage, requireFeature } from './villageService.js';

const MIN = 60_000;

// ---------- Handelsschiff ----------

function rollDemands(memberCount) {
  const scale = Math.max(1, Math.ceil(memberCount / 2));
  const pool = [...SHIP_DEMAND_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map((d) => ({ resource: d.resource, amount: d.base * scale }));
}

async function createShip(db, valleyId, arrivesAt) {
  const members = await db.user.count({ where: { valleyId } });
  const now = Date.now();
  const arrival = new Date(Math.max(arrivesAt.getTime(), now));
  return db.tradeShip.create({
    data: {
      valleyId,
      status: arrival.getTime() <= now ? 'DOCKED' : 'INCOMING',
      demands: rollDemands(members),
      arrivesAt: arrival,
      departsAt: new Date(arrival.getTime() + config.shipDockMinutes * MIN),
    },
  });
}

/** Bringt den Schiffs-Zustand eines Tals auf "jetzt". Gibt { ship, changed } zurück. */
export function refreshShip(valleyId) {
  return withLock(`ship:${valleyId}`, async () => {
    const now = Date.now();
    let ship = await prisma.tradeShip.findFirst({
      where: { valleyId },
      orderBy: { arrivesAt: 'desc' },
    });

    if (!ship) return { ship: await createShip(prisma, valleyId, new Date(now)), changed: true };

    let changed = false;
    if (ship.status === 'INCOMING' && now >= ship.arrivesAt.getTime()) {
      ship = await prisma.tradeShip.update({ where: { id: ship.id }, data: { status: 'DOCKED' } });
      changed = true;
    }
    if (ship.status === 'DOCKED' && now >= ship.departsAt.getTime()) {
      await prisma.tradeShip.update({ where: { id: ship.id }, data: { status: 'DEPARTED' } });
      const next = new Date(ship.departsAt.getTime() + config.shipIntervalMinutes * MIN);
      ship = await createShip(prisma, valleyId, next);
      changed = true;
    }
    if (ship.status === 'COMPLETED' || ship.status === 'DEPARTED') {
      const from = ship.completedAt ?? ship.departsAt;
      ship = await createShip(prisma, valleyId, new Date(from.getTime() + config.shipIntervalMinutes * MIN));
      changed = true;
    }
    return { ship, changed };
  });
}

function serializeShip(ship) {
  if (!ship) return null;
  return {
    id: ship.id,
    status: ship.status,
    demands: ship.demands,
    progress: ship.progress,
    arrivesAt: ship.arrivesAt.toISOString(),
    departsAt: ship.departsAt.toISOString(),
    reward: SHIP_REWARD,
  };
}

// ---------- Tal-Zustand ----------

const projectOrder = (key) => {
  const i = VALLEY_PROJECTS.findIndex((p) => p.key === key);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

export async function getValleyState(valleyId, onlineUserIds = new Set()) {
  const { ship } = await refreshShip(valleyId);
  const valley = await prisma.valley.findUnique({
    where: { id: valleyId },
    include: {
      members: {
        select: { id: true, displayName: true, prestige: true, seals: true },
        orderBy: { createdAt: 'asc' },
      },
      projects: { orderBy: { createdAt: 'asc' } },
      research: { select: { techKey: true } },
    },
  });
  if (!valley) throw new GameError('Tal nicht gefunden', 'NOT_FOUND', 404);

  const sums = await prisma.projectContribution.groupBy({
    by: ['projectId', 'userId'],
    where: { projectId: { in: valley.projects.map((p) => p.id) } },
    _sum: { amount: true },
  });
  const names = new Map(valley.members.map((m) => [m.id, m.displayName]));

  return {
    id: valley.id,
    name: valley.name,
    inviteCode: valley.inviteCode,
    maxMembers: valley.maxMembers,
    members: valley.members.map((m) => ({ ...m, online: onlineUserIds.has(m.id) })),
    projects: [...valley.projects].sort((a, b) => projectOrder(a.key) - projectOrder(b.key)).map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      icon: p.icon,
      description: p.description,
      requirements: p.requirements,
      progress: p.progress,
      status: p.status,
      completedAt: p.completedAt?.toISOString() ?? null,
      reward: VALLEY_PROJECTS_BY_KEY[p.key]?.reward ?? { prestige: 0, seals: 0 },
      contributors: sums
        .filter((s) => s.projectId === p.id)
        .map((s) => ({
          userId: s.userId,
          displayName: names.get(s.userId) ?? 'Ehemalig',
          amount: s._sum.amount ?? 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    })),
    ship: serializeShip(ship),
    techKeys: valley.research.map((r) => r.techKey),
    serverTime: Date.now(),
  };
}

// ---------- Einzahlen in Monumental-Projekte ----------

export function contributeToProject(user, { projectId, resource, amount }) {
  return mutateVillage(
    user.village.id,
    async (snap, { tx }) => {
      requireFeature(snap, 'valley');
      const project = await tx.valleyProject.findUnique({ where: { id: projectId } });
      if (!project || project.valleyId !== user.valleyId) {
        throw new GameError('Projekt nicht gefunden', 'NOT_FOUND', 404);
      }
      if (project.status !== 'ACTIVE') throw new GameError(`${project.name} ist bereits fertig`);

      const required = project.requirements[resource] ?? 0;
      if (!required) throw new GameError(`${RESOURCES[resource]?.name ?? resource} wird hier nicht benötigt`);

      const current = project.progress[resource] ?? 0;
      const have = snap.inventory[resource] ?? 0;
      const actual = Math.min(amount, required - current, have);
      if (required - current <= 0) throw new GameError('Davon ist schon genug da');
      if (actual <= 0) throw new GameError(`Du hast keine ${RESOURCES[resource].name} im Lager`);

      snap.inventory[resource] = have - actual;
      recordStat(snap.stats, 'contributed', actual);
      const progress = { ...project.progress, [resource]: current + actual };
      const completed = Object.entries(project.requirements).every(
        ([res, n]) => (progress[res] ?? 0) >= n,
      );

      await tx.valleyProject.update({
        where: { id: project.id },
        data: { progress, ...(completed && { status: 'COMPLETED', completedAt: new Date() }) },
      });
      await tx.projectContribution.create({
        data: { projectId: project.id, userId: user.id, resource, amount: actual },
      });

      if (completed) {
        const reward = VALLEY_PROJECTS_BY_KEY[project.key]?.reward ?? { prestige: 0, seals: 0 };
        await tx.user.updateMany({
          where: { valleyId: project.valleyId },
          data: { prestige: { increment: reward.prestige }, seals: { increment: reward.seals } },
        });
      }
      return { amount: actual, resource, completed, projectName: project.name, icon: project.icon };
    },
    { serializable: true },
  );
}

// ---------- Handelsschiff beladen ----------

export async function loadShip(user, { resource, amount }) {
  await refreshShip(user.valleyId);
  return mutateVillage(
    user.village.id,
    async (snap, { tx }) => {
      requireFeature(snap, 'ship');
      const ship = await tx.tradeShip.findFirst({
        where: { valleyId: user.valleyId, status: 'DOCKED' },
        orderBy: { arrivesAt: 'desc' },
      });
      if (!ship || ship.departsAt.getTime() <= Date.now()) {
        throw new GameError('Gerade liegt kein Schiff im Hafen');
      }

      const demand = ship.demands.find((d) => d.resource === resource);
      if (!demand) throw new GameError('Das Schiff möchte diese Ware nicht');

      const current = ship.progress[resource] ?? 0;
      const have = snap.inventory[resource] ?? 0;
      const actual = Math.min(amount, demand.amount - current, have);
      if (demand.amount - current <= 0) throw new GameError('Diese Kiste ist schon voll');
      if (actual <= 0) throw new GameError(`Du hast keine ${RESOURCES[resource].name} im Lager`);

      snap.inventory[resource] = have - actual;
      recordStat(snap.stats, 'shipLoaded', actual);
      const progress = { ...ship.progress, [resource]: current + actual };
      const completed = ship.demands.every((d) => (progress[d.resource] ?? 0) >= d.amount);

      await tx.shipLoad.create({ data: { shipId: ship.id, userId: user.id, resource, amount: actual } });
      await tx.tradeShip.update({
        where: { id: ship.id },
        data: { progress, ...(completed && { status: 'COMPLETED', completedAt: new Date() }) },
      });

      if (completed) {
        // Belohnung für alle, die mindestens eine Ware geladen haben.
        const loaders = await tx.shipLoad.findMany({
          where: { shipId: ship.id },
          distinct: ['userId'],
          select: { userId: true },
        });
        await tx.user.updateMany({
          where: { id: { in: loaders.map((l) => l.userId) } },
          data: { seals: { increment: SHIP_REWARD.seals }, prestige: { increment: SHIP_REWARD.prestige } },
        });
      }
      return { amount: actual, resource, completed };
    },
    { serializable: true },
  );
}
