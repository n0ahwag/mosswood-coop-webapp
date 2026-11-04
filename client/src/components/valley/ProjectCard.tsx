import { useGame } from '../../game/GameProvider';
import type { ValleyProject } from '../../lib/types';
import { ProgressBar } from '../ui';
import { DepositControl } from './DepositControl';

export function ProjectCard({ project }: { project: ValleyProject }) {
  const { content, village, actions } = useGame();
  const req = Object.entries(project.requirements);
  const total = req.reduce((s, [, n]) => s + n, 0);
  const current = req.reduce((s, [r, n]) => s + Math.min(n, project.progress[r] ?? 0), 0);
  const pct = total ? Math.round((current / total) * 100) : 0;
  const done = project.status === 'COMPLETED';

  return (
    <article className={`card p-5 ${done ? 'opacity-80' : ''}`}>
      <header className="flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-honey-200 text-3xl" aria-hidden>
          {project.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xl font-semibold">{project.name}</h4>
            {done ? (
              <span className="chip bg-moss-100 text-moss-700">✓ Vollendet</span>
            ) : (
              <span className="chip bg-parchment text-bark-600">{pct} %</span>
            )}
          </div>
          <p className="text-sm text-bark-600">{project.description}</p>
          <p className="mt-1 text-xs font-bold text-bark-500">
            Belohnung für alle: ⭐ {project.reward.prestige} · 🏵️ {project.reward.seals}
          </p>
        </div>
      </header>

      <div className="mt-4">
        <ProgressBar value={current} max={total} tone={done ? 'moss' : 'honey'} smooth label={`Gesamtfortschritt ${project.name}`} />
      </div>

      <ul className="mt-4 space-y-3">
        {req.map(([resource, required]) => {
          const res = content.resources[resource];
          const have = project.progress[resource] ?? 0;
          const missing = Math.max(0, required - have);
          return (
            <li key={resource} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm font-bold">
                  <span>{res?.icon} {res?.name ?? resource}</span>
                  <span className="tabular-nums text-bark-600">{have} / {required}</span>
                </div>
                <ProgressBar value={have} max={required} tone="moss" smooth />
              </div>
              {!done && missing > 0 && (
                <DepositControl
                  available={village?.inventory[resource] ?? 0}
                  missing={missing}
                  onDeposit={(amount) => actions.contribute(project.id, resource, amount)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {project.contributors.length > 0 && (
        <footer className="mt-4 border-t-2 border-dashed border-bark-900/10 pt-3 text-xs font-semibold text-bark-600">
          Fleißige Hände:{' '}
          {project.contributors.slice(0, 5).map((c, i) => (
            <span key={c.userId}>
              {i > 0 && ', '}
              {c.displayName} ({c.amount})
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}
