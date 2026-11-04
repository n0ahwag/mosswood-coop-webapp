import crypto from 'node:crypto';
import { prisma } from '../db.js';
import {
  BUILDINGS, STARTER_INVENTORY, VALLEY_NAME_PARTS, VALLEY_PROJECTS, VILLAGER_NAMES,
  VILLAGER_RULES,
} from '../game/content.js';
import { GameError, pick } from '../utils/errors.js';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

export async function createValley(tx, name) {
  return tx.valley.create({
    data: {
      name: name ?? `${pick(VALLEY_NAME_PARTS.first)}${pick(VALLEY_NAME_PARTS.second)}`,
      inviteCode: randomInviteCode(),
      projects: {
        create: VALLEY_PROJECTS.map((p) => ({
          key: p.key,
          name: p.name,
          icon: p.icon,
          description: p.description,
          requirements: p.requirements,
        })),
      },
    },
  });
}

async function findOrCreateValley(tx, inviteCode) {
  if (inviteCode) {
    const valley = await tx.valley.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: { _count: { select: { members: true } } },
    });
    if (!valley) throw new GameError('Diesen Einladungscode gibt es nicht', 'NOT_FOUND', 404);
    if (valley._count.members >= valley.maxMembers) throw new GameError('Dieses Tal ist schon voll');
    return valley;
  }

  // Ohne Code: ältestes Tal mit freiem Platz, sonst ein neues gründen.
  const valleys = await tx.valley.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { members: true } } },
  });
  return valleys.find((v) => v._count.members < v.maxMembers) ?? createValley(tx);
}

async function createStarterVillage(tx, user) {
  const village = await tx.village.create({
    data: {
      name: `Hof von ${user.displayName}`,
      ownerId: user.id,
      inventory: STARTER_INVENTORY,
      buildings: { create: Object.keys(BUILDINGS).map((type) => ({ type })) },
    },
  });
  const names = [...VILLAGER_NAMES].sort(() => Math.random() - 0.5);
  await tx.villager.createMany({
    data: names.slice(0, VILLAGER_RULES.baseVillagers).map((name) => ({ name, villageId: village.id })),
  });
  return village;
}

export async function createPlayer({ displayName, inviteCode }) {
  const token = crypto.randomBytes(32).toString('base64url');
  return prisma.$transaction(async (tx) => {
    const valley = await findOrCreateValley(tx, inviteCode);
    const user = await tx.user.create({
      data: { displayName, sessionTokenHash: hashToken(token), valleyId: valley.id },
    });
    const village = await createStarterVillage(tx, user);
    return { token, user, valley, village };
  });
}

export async function authenticate(token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  return prisma.user.findUnique({
    where: { sessionTokenHash: hashToken(token) },
    include: { village: { select: { id: true } } },
  });
}

export function publicUser(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    seals: user.seals,
    prestige: user.prestige,
    valleyId: user.valleyId,
    villageId: user.village?.id ?? null,
  };
}
