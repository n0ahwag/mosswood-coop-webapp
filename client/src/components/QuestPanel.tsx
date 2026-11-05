import type { ReactNode } from 'react';
import { useGame } from '../game/GameProvider';
import type { QuestDef } from '../lib/types';
import { ResourceIcon } from './icons/ResourceIcon';
import { ProgressBar } from './ui';

function goalLabel(goal: QuestDef['goal'], names: { resource: (k: string) => string; building: (k: string) => string }) {
  switch (goal.type) {
    case 'assign':
      return `Bewohner in ${names.building(goal.building ?? '')}`;
    case 'collect':
      return `${names.resource(goal.resource ?? '')} eingesammelt`;
    case 'build':
      return `gebaut: ${(goal.buildings ?? []).map(names.building).join(' und ')}`;
    case 'research':
      return 'Technik erforscht';
    case 'contribute':
      return 'Waren ins Tal eingezahlt';
    case 'shipLoad':
      return 'Waren aufs Schiff geladen';
  }
}

/** Das Hofbuch: aktuelle Aufgabe mit Fortschritt und Belohnung. */
export function QuestPanel({ onShowBuilding }: { onShowBuilding?: (type: string) => void }) {
  const { village, content } = useGame();
  if (!village) return null;
  const { quest, step, total } = village.progression;
  const names = {
    resource: (k: string) => content.resources[k]?.name ?? k,
    building: (k: string) => content.buildings[k]?.name ?? k,
  };

  if (!quest) {
    return (
      <section className="card flex items-center gap-3 p-4">
        <span className="grid size-12 shrink-0 place-items-center slot text-2xl" aria-hidden>🏆</span>
        <div>
          <h3 className="text-lg font-semibold">Hofbuch abgeschlossen</h3>
          <p className="text-sm text-bark-600">
            Du kennst jetzt alle Werkzeuge von Mosswood. Baut gemeinsam die Monumente des Tals fertig!
          </p>
        </div>
      </section>
    );
  }

  const { goal, reward } = quest;
  // Welches Gebäude hilft gerade weiter? Für den „Zeigen“-Knopf in der 3D-Ansicht.
  const focusType = goal.type === 'assign'
    ? goal.building
    : goal.type === 'collect'
      ? Object.entries(content.buildings).find(([, d]) => d.outputs[goal.resource ?? ''])?.[0]
      : goal.type === 'build'
        ? goal.buildings?.find((t) => !village.buildings.some((b) => b.type === t))
        : undefined;
  const rewardFeatures = reward.features ?? [];
  const rewardResources = Object.entries(reward.resources ?? {});

  return (
    <section className="card overflow-hidden" aria-label="Hofbuch">
      <div className="wood flex items-center justify-between gap-2 rounded-none border-x-0 border-t-0 px-4 py-1.5">
        <span className="text-outline font-display text-sm font-semibold tracking-wide">📖 Hofbuch</span>
        <span className="text-outline font-display text-xs font-semibold">Aufgabe {step + 1} von {total}</span>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <span className="grid size-14 shrink-0 place-items-center slot text-3xl" aria-hidden>{quest.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl leading-tight font-semibold">{quest.title}</h3>
          <p className="mt-0.5 text-sm text-bark-700">{quest.text}</p>
          <div className="mt-2 flex items-center gap-2">
            {goal.resource && <ResourceIcon resource={goal.resource} size={22} />}
            <div className="flex-1">
              <ProgressBar value={quest.progress} max={goal.amount} tone="honey" smooth label="Fortschritt der Aufgabe" />
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-bark-600">
              {quest.progress}/{goal.amount} {goalLabel(goal, names)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          {(rewardFeatures.length > 0 || rewardResources.length > 0) && (
            <div className="slot px-2.5 py-1.5 text-xs font-bold text-bark-700">
              <span className="block text-[10px] tracking-wider text-bark-500 uppercase">Belohnung</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {rewardFeatures.map((f) => (
                  <span key={f}>{content.features[f]?.icon} {content.features[f]?.name}</span>
                ))}
                {rewardResources.map(([r, n]) => (
                  <span key={r} className="inline-flex items-center gap-0.5">{n}<ResourceIcon resource={r} size={18} /></span>
                ))}
              </span>
            </div>
          )}
          {focusType && onShowBuilding && (
            <button className="btn-ghost px-3 py-1 text-xs" onClick={() => onShowBuilding(focusType)}>
              🔎 {content.buildings[focusType]?.name} zeigen
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** Platzhalter für Bereiche, die noch gesperrt sind. */
export function LockedFeature({ icon, title, unlockText, children }: {
  icon: string;
  title: string;
  unlockText: string;
  children?: ReactNode;
}) {
  return (
    <section className="card mx-auto max-w-xl p-6 text-center">
      <p className="text-5xl" aria-hidden>{icon}</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-bark-600">{children}</p>
      <p className="slot mx-auto mt-4 inline-block px-4 py-2 text-sm font-bold text-bark-700">🔒 {unlockText}</p>
    </section>
  );
}
