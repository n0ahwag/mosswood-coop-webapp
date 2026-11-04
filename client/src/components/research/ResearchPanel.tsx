import { useState } from 'react';
import { useGame } from '../../game/GameProvider';
import type { TechDef } from '../../lib/types';
import { ResourceList } from '../ui';

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

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.scope}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold">{g.title}</h2>
            <span className="text-sm text-bark-500">{g.hint}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techs.filter((t) => t.scope === g.scope).map((t) => {
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
                  </header>
                  <p className="text-sm text-bark-600">{t.description}</p>
                  {missingReq.length > 0 && (
                    <p className="text-xs font-bold text-clay-500">
                      Benötigt: {missingReq.map((r) => content.techs[r]?.name ?? r).join(', ')}
                    </p>
                  )}
                  {!done && (
                    <footer className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <ResourceList items={t.cost} content={content} className="text-sm font-bold" />
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
        </section>
      ))}
    </div>
  );
}
