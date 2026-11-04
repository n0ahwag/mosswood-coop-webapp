// Einfache In-Process-Sperre pro Schlüssel: Aufrufe mit demselben Schlüssel laufen nacheinander.
// Reicht für eine einzelne Server-Instanz. Für mehrere Instanzen → Redis-Lock o. Ä.
const chains = new Map();

export function withLock(key, fn) {
  const previous = chains.get(key) ?? Promise.resolve();
  const run = previous.then(() => fn());
  const tail = run.catch(() => {});
  chains.set(key, tail);
  tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });
  return run;
}
