// Bauplatz: was das Gebäude kann, was es kostet und ob man es schon bauen darf.

import { useState, type MouseEvent } from 'react';
import { useGame } from '../../game/GameProvider';
import { lacking } from '../../game/progression';
import { fx } from '../../lib/fx';
import type { BuildPlan } from '../../lib/types';
import { CostChips, ResourceList } from '../ui';

export function BuildPlanCard({
  plan, highlight = false, onBuilt, compact = false,
}: {
  plan: BuildPlan;
  highlight?: boolean;
  onBuilt?: (buildingId: string, type: string) => void;
  compact?: boolean;
}) {
  const { content, village, actions } = useGame();
  const [busy, setBusy] = useState(false);
  const def = content.buildings[plan.type];
  if (!def || !village) return null;

  const missingNames = plan.missing.map((m) => content.buildings[m]?.name ?? m);
  const lack = lacking(village.inventory, plan.cost);
  const feature = def.feature ? content.features[def.feature] : undefined;

  const build = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const button = e.currentTarget;
    setBusy(true);
    const res = await actions.build(plan.type);
    setBusy(false);
    if (res) {
      fx.burstAt(button, '🔨 Gebaut!', 'green');
      onBuilt?.(res.buildingId, plan.type);
    }
  };

  return (
    <article
      className={`card flex flex-col gap-2.5 p-4 ${highlight ? 'ring-4 ring-gold-300' : ''} ${plan.available ? '' : 'opacity-80'}`}
    >
      <header className="flex items-start gap-3">
        <span className={`slot grid size-12 shrink-0 place-items-center text-2xl ${plan.available ? '' : 'grayscale-[60%]'}`} aria-hidden>
          {def.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg leading-tight font-semibold">{def.name}</h4>
            {plan.affordable ? (
              <span className="chip animate-bob bg-gold-300 text-bark-900">🔨 Baubar</span>
            ) : plan.available ? (
              <span className="chip bg-parchment text-bark-600">Bauplatz frei</span>
            ) : (
              <span className="chip bg-parchment text-bark-500">🔒 Gesperrt</span>
            )}
          </div>
          {!compact && <p className="text-xs text-bark-500">{def.description}</p>}
        </div>
      </header>

      {feature ? (
        <div className="slot px-3 py-1.5 text-sm font-bold text-bark-700">
          Öffnet: {feature.icon} {feature.name}
        </div>
      ) : (
        <div className="slot flex items-center gap-2 px-3 py-1 text-sm font-bold">
          {Object.keys(def.inputs).length > 0 && (
            <>
              <ResourceList items={def.inputs} content={content} />
              <span className="text-bark-500">→</span>
            </>
          )}
          <ResourceList items={def.outputs} content={content} />
          <span className="ml-auto text-xs text-bark-500">👥 {def.slots}</span>
        </div>
      )}

      {missingNames.length > 0 && (
        <p className="text-xs font-bold text-clay-500">Benötigt zuerst: {missingNames.join(', ')}</p>
      )}

      <footer className="mt-auto flex items-center justify-between gap-2 border-t-2 border-dashed border-bark-900/10 pt-2.5">
        <div className="min-w-0">
          <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-bark-500 uppercase">Baukosten</span>
          <CostChips cost={plan.cost} inventory={village.inventory} />
        </div>
        <button className="btn-primary shrink-0 px-3 py-1.5 text-sm" disabled={!plan.affordable || busy} onClick={build}>
          🔨 Bauen
        </button>
      </footer>
      {plan.available && lack.length > 0 && (
        <p className="-mt-1 text-[11px] font-bold text-bark-500">
          Es fehlen noch {lack.map(([r, n]) => `${n} ${content.resources[r]?.name ?? r}`).join(', ')}.
        </p>
      )}
    </article>
  );
}
