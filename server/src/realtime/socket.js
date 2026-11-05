// Echtzeit-Synchronisation über Socket.io
//
// Räume:   user:<userId>     → privater Dorf-Zustand
//          valley:<valleyId> → gemeinsamer Tal-Zustand und Ereignis-Feed
//
// Client → Server (mit Ack-Callback { ok, data | error }):
//   villager:assign  { villagerId, buildingId | null }
//   building:collect { buildingId }
//   building:build   { type }
//   project:contribute { projectId, resource, amount }
//   ship:load        { resource, amount }
//   research:unlock  { techKey }
//
// Server → Client:
//   village:state, valley:state, valley:event

import crypto from 'node:crypto';
import { Server } from 'socket.io';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { BUILDINGS, RESOURCES, TECHS } from '../game/content.js';
import { authenticate } from '../services/authService.js';
import { unlockTech } from '../services/researchService.js';
import {
  contributeToProject, getValleyState, loadShip, refreshShip,
} from '../services/valleyService.js';
import {
  assignVillager, buildBuilding, collectBuilding, mutateVillage,
} from '../services/villageService.js';
import { GameError } from '../utils/errors.js';

const resourceKey = z.string().refine((r) => r in RESOURCES, 'Unbekannter Rohstoff');
const schemas = {
  assign: z.object({ villagerId: z.string().min(1), buildingId: z.string().min(1).nullable() }),
  collect: z.object({ buildingId: z.string().min(1) }),
  build: z.object({ type: z.string().refine((t) => Object.hasOwn(BUILDINGS, t), 'Unbekanntes Gebäude') }),
  contribute: z.object({
    projectId: z.string().min(1),
    resource: resourceKey,
    amount: z.number().int().positive().max(10_000),
  }),
  ship: z.object({ resource: resourceKey, amount: z.number().int().positive().max(10_000) }),
  research: z.object({ techKey: z.string().refine((k) => k in TECHS, 'Unbekannte Forschung') }),
};

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin },
  });

  // userId → { sockets, villageId, valleyId }
  const presence = new Map();
  const onlineIn = (valleyId) =>
    new Set([...presence].filter(([, p]) => p.valleyId === valleyId).map(([id]) => id));

  async function broadcastValley(valleyId) {
    if (!valleyId) return;
    const state = await getValleyState(valleyId, onlineIn(valleyId));
    io.to(`valley:${valleyId}`).emit('valley:state', state);
  }

  function valleyEvent(valleyId, icon, text) {
    io.to(`valley:${valleyId}`).emit('valley:event', {
      id: crypto.randomUUID(),
      icon,
      text,
      at: new Date().toISOString(),
    });
  }

  io.use(async (socket, next) => {
    try {
      const user = await authenticate(socket.handshake.auth?.token);
      if (!user?.village) return next(new Error('UNAUTHORIZED'));
      socket.data.user = user;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    const { valleyId } = user;
    const villageId = user.village.id;

    socket.join(`user:${user.id}`);
    if (valleyId) socket.join(`valley:${valleyId}`);

    const entry = presence.get(user.id) ?? { sockets: 0, villageId, valleyId };
    entry.sockets += 1;
    presence.set(user.id, entry);

    const pushVillage = (state) => io.to(`user:${user.id}`).emit('village:state', state);

    // Hilfsfunktion: validiert die Eingabe, führt die Aktion aus, antwortet per Ack.
    const on = (event, schema, handler) => {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          const data = schema.parse(payload ?? {});
          const result = await handler(data);
          reply({ ok: true, data: result ?? null });
        } catch (err) {
          if (err instanceof z.ZodError) return reply({ ok: false, error: err.issues[0]?.message ?? 'Ungültige Eingabe' });
          if (err instanceof GameError) return reply({ ok: false, error: err.message });
          console.error(`[socket] ${event}`, err);
          reply({ ok: false, error: 'Interner Serverfehler' });
        }
      });
    };

    on('villager:assign', schemas.assign, async ({ villagerId, buildingId }) => {
      const { state, result } = await assignVillager(villageId, villagerId, buildingId);
      pushVillage(state);
      return result;
    });

    on('building:collect', schemas.collect, async ({ buildingId }) => {
      const { state, result } = await collectBuilding(villageId, buildingId);
      pushVillage(state);
      return result;
    });

    on('building:build', schemas.build, async ({ type }) => {
      const { state, result } = await buildBuilding(villageId, type);
      pushVillage(state);
      valleyEvent(valleyId, '🔨', `${user.displayName} hat ${result.icon} ${result.name} gebaut.`);
      return result;
    });

    on('project:contribute', schemas.contribute, async (input) => {
      const { state, result } = await contributeToProject(user, input);
      pushVillage(state);
      const res = RESOURCES[result.resource];
      valleyEvent(valleyId, result.icon, `${user.displayName} hat ${result.amount} ${res.icon} ${res.name} in „${result.projectName}“ eingezahlt.`);
      if (result.completed) valleyEvent(valleyId, '🎉', `„${result.projectName}“ ist fertig! Alle im Tal erhalten eine Belohnung.`);
      await broadcastValley(valleyId);
      return result;
    });

    on('ship:load', schemas.ship, async (input) => {
      const { state, result } = await loadShip(user, input);
      pushVillage(state);
      const res = RESOURCES[result.resource];
      valleyEvent(valleyId, '⛵', `${user.displayName} hat ${result.amount} ${res.icon} ${res.name} auf das Handelsschiff geladen.`);
      if (result.completed) valleyEvent(valleyId, '🏵️', 'Das Handelsschiff ist voll beladen und legt mit Siegeln für alle Helfenden ab!');
      await broadcastValley(valleyId);
      return result;
    });

    on('research:unlock', schemas.research, async ({ techKey }) => {
      const { state, result } = await unlockTech(user, techKey);
      pushVillage(state);
      if (result.scope === 'valley') {
        valleyEvent(valleyId, result.icon, `${user.displayName} hat „${result.name}“ für das ganze Tal erforscht.`);
        // Andere Mitglieder profitieren sofort → ihr Dorf beim nächsten Tick neu laden.
        await broadcastValley(valleyId);
      }
      for (const name of result.newcomers) valleyEvent(valleyId, '🧺', `${name} ist bei ${user.displayName} eingezogen.`);
      return result;
    });

    socket.on('disconnect', async () => {
      const p = presence.get(user.id);
      if (p && --p.sockets <= 0) {
        presence.delete(user.id);
        await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
      }
      await broadcastValley(valleyId).catch((err) => console.error('[socket] disconnect', err));
    });

    // Startzustand senden
    try {
      const { state } = await mutateVillage(villageId);
      socket.emit('village:state', state);
      await broadcastValley(valleyId);
      valleyEvent(valleyId, '👋', `${user.displayName} ist im Tal.`);
    } catch (err) {
      console.error('[socket] initial state', err);
    }
  });

  // Simulations-Loop für alle verbundenen Spieler
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (const [userId, p] of presence) {
        const { state } = await mutateVillage(p.villageId);
        io.to(`user:${userId}`).emit('village:state', state);
      }
      for (const valleyId of new Set([...presence.values()].map((p) => p.valleyId).filter(Boolean))) {
        const { changed, ship } = await refreshShip(valleyId);
        if (changed) {
          if (ship.status === 'DOCKED') valleyEvent(valleyId, '⚓', 'Ein Handelsschiff hat im Hafen angelegt!');
          await broadcastValley(valleyId);
        }
      }
    } catch (err) {
      console.error('[tick]', err);
    } finally {
      running = false;
    }
  }, config.tickMs);

  return { io, stop: () => clearInterval(timer) };
}
