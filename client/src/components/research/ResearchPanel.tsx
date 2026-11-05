import { useState } from 'react';
import { useGame } from '../../game/GameProvider';
import { featureUnlock, hasFeature } from '../../game/progression';
import type { TechDef } from '../../lib/types';
import { ResourceIcon } from '../icons/ResourceIcon';

export function ResearchPanel() {
  const { content, village, actions } = useGame();
  const [busy, setBusy] = useState<string | null>(null);
  if (!village) return null;

  const unlocked = new Set(village.techKeys);
  const techs = Object.values(content.techs);
  const groups: { scope: TechDef['scope']; title: string; hint: string }[] = [
    { scope: 'player', title: 'Dein Hof', hint: 'Verbesserungen nur für dein Dorf' },
    { scope: 'valley', title: 'Das ganze Tal', hint: 'Du bezahlst, alle Nachbarn profitieren' },
  ];

  const affordable = (t: TechDef) =>
    Object.entries(t.cost).every(([r, n]) => (village.inventory[r] ?? 0) >= n);

  const unlock = async (key: string) => {
    setBusy(key);
    await actions.unlockTech(key);
    setBusy(null);
  };

  const available = (t: TechDef) => !unlocked.has(t.key) && t.requires.every((r) => unlocked.has(r));
  const costSum = (t: TechDef) => Object.values(t.cost).reduce((s, n) => s + n, 0);
  // Empfehlung: die günstigste Technik, die man jetzt schon bezahlen kann (sonst die günstigste verfügbare).
  const playerOptions = techs.filter((t) => t.scope === 'player' && available(t)).sort((a, b) => costSum(a) - costSum(b));
  const recommended = (playerOptions.find(affordable) ?? playerOptions[0])?.key;
  const order = (t: TechDef) => (unlocked.has(t.key) ? 3 : available(t) ? (affordable(t) ? 0 : 1) : 2);

  return (
    <div className="space-y-6">
      <p className="slot px-4 py-2.5 text-sm font-semibold text-bark-700">
        📜 Jede Technik kostet Rohstoffe aus deinem Vorrat und wirkt danach dauerhaft. Grün markierte Kosten hast du schon,
        rote fehlen dir noch.
      </p>
      {groups.map((g) => (
        <section key={g.scope}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold">{g.title}</h2>
            <span className="text-sm text-bark-500">{g.hint}</span>
          </div>
          {g.scope === 'valley' && !hasFeature(village, 'valleyResearch') ? (
            <p className="slot px-4 py-3 text-sm font-bold text-bark-600">
              🔒 Tal-Forschung wird mit Aufgabe {featureUnlock(content, 'valleyResearch').index + 1} im Hofbuch frei
              („{featureUnlock(content, 'valleyResearch').quest?.title}“).
            </p>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techs.filter((t) => t.scope === g.scope).sort((a, b) => order(a) - order(b)).map((t) => {
              const done = unlocked.has(t.key);
              const missingReq = t.requires.filter((r) => !unlocked.has(r));
              const canBuy = !done && missingReq.length === 0 && affordable(t);
              return (
                <article
                  key={t.key}
                  className={`card flex flex-col gap-2 p-4 ${done ? 'bg-moss-50' : ''} ${missingReq.length ? 'opacity-70' : ''}`}
                >
                  <header className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>{t.icon}</span>
                    <h3 className="flex-1 text-lg leading-tight font-semibold">{t.name}</h3>
                    {done && <span className="chip bg-moss-100 text-moss-700">✓ Erforscht</span>}
                    {!done && t.key === recommended && <span className="chip animate-bob bg-gold-300 text-bark-900">⭐ Empfohlen</span>}
                  </header>
                  <p className="text-sm text-bark-600">{t.description}</p>
                  {missingReq.length > 0 && (
                    <p className="text-xs font-bold text-clay-500">
                      Benötigt: {missingReq.map((r) => content.techs[r]?.name ?? r).join(', ')}
                    </p>
                  )}
                  {!done && (
                    <footer className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="flex flex-wrap gap-1">
                        {Object.entries(t.cost).map(([r, n]) => {
                          const have = village.inventory[r] ?? 0;
                          return (
                            <span
                              key={r}
                              title={content.resources[r]?.name}
                              className={`chip gap-0.5 ${have >= n ? 'bg-moss-100 text-moss-800' : 'bg-clay-200 text-clay-500'}`}
                            >
                              <ResourceIcon resource={r} size={18} />
                              {Math.min(have, n)}/{n}
                            </span>
                          );
                        })}
                      </span>
                      <button
                        className="btn-primary px-3 py-1.5 text-sm"
                        disabled={!canBuy || busy === t.key}
                        onClick={() => unlock(t.key)}
                      >
                        Erforschen
                      </button>
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
          )}
        </section>
      ))}
    </div>
  );
}
