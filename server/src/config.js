const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: num(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // wie oft das Dorf verbundener Spieler simuliert und an den Client gesendet wird
  tickMs: num(process.env.TICK_MS, 2000),
  // maximal nachgerechneter Offline-Fortschritt
  maxOfflineSeconds: num(process.env.MAX_OFFLINE_SECONDS, 8 * 3600),
  // Handelsschiff: Pause zwischen zwei Besuchen und Liegezeit im Hafen
  shipIntervalMinutes: num(process.env.SHIP_INTERVAL_MINUTES, 240),
  shipDockMinutes: num(process.env.SHIP_DOCK_MINUTES, 120),
};
