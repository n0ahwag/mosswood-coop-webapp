import { z } from 'zod';

// Validierungsfehler von Zod auf Deutsch ausgeben.
z.config(z.locales.de());

// Fehler, deren Nachricht direkt dem Spieler angezeigt werden darf.
export class GameError extends Error {
  constructor(message, code = 'GAME_ERROR', status = 400) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.status = status;
  }
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
