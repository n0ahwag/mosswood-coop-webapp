import { useState } from 'react';
import { useGame } from '../../game/GameProvider';
import { fx } from '../../lib/fx';
import type { Building, BuildingStatus, Villager } from '../../lib/types';
import { ProgressBar, ResourceList } from '../ui';
import { avatarFor, VILLAGER_MIME } from './VillagerCard';

const STATUS: Record<BuildingStatus, { text: string; className: string }> = {
  idle: { text: 'Unbesetzt', className: 'bg-parchment text-bark-500' },
  working: { text: 'In Betrieb', className: 'bg-moss-100 text-moss-700' },
  missingInputs: { text: 'Zutaten fehlen', className: 'bg-clay-200 text-clay-500' },
  full: { text: 'Vorrat voll', className: 'bg-honey-200 text-bark-700' },
};

export function BuildingCard({
  building, workers, selectedVillager, onAssign, onUnassign, onCollect,
}: {
  building: Building;
  workers: Villager[];
  selectedVillager: Villager | null;
  onAssign: (villagerId: string) => void;
  onUnassign: (villagerId: string) => void;
  onCollect: () => Promise<{ moved: Record<string, number> } | undefined>;
}) {
  const { content } = useGame();
  const def = content.buildings[building.type];
  const [hover, setHover] = useState(false);
  if (!def) return null;

  const freeSlots = def.slots - workers.length;
  const stockTotal = Object.values(building.stock).reduce((a, b) => a + b, 0);
  const canTake = selectedVillager && selectedVillager.buildingId !== building.id && freeSlots > 0;
  const status = STATUS[building.status];
  const stalled = workers.length > 0 && workers.every((w) => w.state !== 'WORKING');

  return (
    <article
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(VILLAGER_MIME) && freeSlots > 0) {
          e.preventDefault();
          e.stopPropagation();
          setHover(true);
        }
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setHover(false);
        const id = e.dataTransfer.getData(VILLAGER_MIME);
        if (id) onAssign(id);
      }}
      onClick={() => canTake && onAssign(selectedVillager.id)}
      className={`card flex flex-col gap-3 p-4 transition ${
        hover ? 'ring-4 ring-moss-300' : canTake ? 'cursor-pointer ring-4 ring-honey-200 hover:ring-honey-300' : ''
      }`}
    >
      <header className="flex items-start gap-3">
        <span className="slot grid size-12 shrink-0 place-items-center text-2xl" aria-hidden>
          {def.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg leading-tight font-semibold">{def.name}</h4>
            <span className={`chip ${status.className}`}>{status.text}</span>
          </div>
          <p className="text-xs text-bark-500">{def.description}</p>
        </div>
      </header>

      <div className="slot flex items-center gap-2 px-3 py-1 text-sm font-bold">
        {Object.keys(def.inputs).length > 0 && (
          <>
            <ResourceList items={def.inputs} content={content} />
            <span className="text-bark-500">→</span>
          </>
        )}
        <ResourceList items={def.outputs} content={content} />
        <span className="ml-auto text-xs text-bark-500">⏱ {def.durationSec} s</span>
      </div>

      <div>
        <ProgressBar
          value={building.progress}
          max={def.durationSec}
          tone={building.status === 'working' ? 'moss' : 'honey'}
          smooth={building.status === 'working'}
          label={`Fortschritt ${def.name}`}
        />
        {stalled && <p className="mt-1 text-[11px] font-bold text-clay-500">Die Arbeiter machen gerade Pause.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {workers.map((w) => (
          <button
            key={w.id}
            onClick={(e) => {
              e.stopPropagation();
              onUnassign(w.id);
            }}
            title={`${w.name} abziehen`}
            className="chip bg-moss-100 py-1 text-moss-700 hover:bg-clay-200 hover:text-clay-500"
          >
            {avatarFor(w)} {w.name} ✕
          </button>
        ))}
        {Array.from({ length: Math.max(0, freeSlots) }, (_, i) => (
          <span key={i} className="chip border-2 border-dashed border-bark-900/15 py-0.5 text-bark-500">
            + freier Platz
          </span>
        ))}
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 border-t-2 border-dashed border-bark-900/10 pt-3">
        <div className="text-xs font-bold text-bark-500">
          Vorrat <ResourceList items={building.stock} content={content} className="text-sm text-bark-900" />
          <span className="ml-1">/ {def.stockCap}</span>
        </div>
        <button
          className="btn-honey px-3 py-1.5 text-sm"
          disabled={stockTotal === 0}
          onClick={async (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            const res = await onCollect();
            const total = res ? Object.values(res.moved).reduce((a, b) => a + b, 0) : 0;
            if (total > 0) fx.burstAt(button, `+${total}`);
          }}
        >
          Einsammeln
        </button>
      </footer>
    </article>
  );
}
