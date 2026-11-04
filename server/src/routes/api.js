import { Router } from 'express';
import { z } from 'zod';
import { getPublicContent } from '../game/content.js';
import { authenticate, createPlayer, publicUser } from '../services/authService.js';
import { GameError } from '../utils/errors.js';

export const api = Router();

const guestSchema = z.object({
  displayName: z.string().trim().min(2, 'Name: mindestens 2 Zeichen').max(24, 'Name: höchstens 24 Zeichen'),
  inviteCode: z.string().trim().max(12).optional().transform((v) => v || undefined),
});

async function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await authenticate(token);
  if (!user) throw new GameError('Bitte melde dich an', 'UNAUTHORIZED', 401);
  req.user = user;
  next();
}

api.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

api.get('/content', (_req, res) => res.json(getPublicContent()));

// Gast-Login: legt Spieler, Dorf und ggf. ein neues Tal an. Echte Accounts folgen später.
api.post('/auth/guest', async (req, res) => {
  const body = guestSchema.parse(req.body ?? {});
  const { token, user, village } = await createPlayer(body);
  res.status(201).json({ token, user: publicUser({ ...user, village }) });
});

api.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// Express 5 leitet Fehler aus async-Handlern automatisch hierher weiter.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message ?? 'Ungültige Eingabe' });
  }
  if (err instanceof GameError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(err);
  return res.status(500).json({ error: 'Interner Serverfehler' });
}
