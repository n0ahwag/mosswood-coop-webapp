import { useGame } from '../../game/GameProvider';
import type { Building, Villager, VillagerState } from '../../lib/types';
import { ProgressBar } from '../ui';

export const VILLAGER_MIME = 'application/x-mosswood-villager';

export const STATE_LABEL: Record<VillagerState, { text: string; icon: string; className: string }> = {
  IDLE: { text: 'Wartet', icon: '💤', className: 'bg-parchment text-bark-600' },
  WORKING: { text: 'Arbeitet', icon: '🔨', className: 'bg-moss-100 text-moss-700' },
  HUNGRY: { text: 'Hungrig', icon: '😋', className: 'bg-clay-200 text-clay-500' },
  EATING: { text: 'Isst', icon: '🥣', className: 'bg-honey-200 text-bark-700' },
  TIRED: { text: 'Müde', icon: '🥱', className: 'bg-creek-200 text-creek-600' },
  RESTING: { text: 'Ruht', icon: '🛏️', className: 'bg-creek-200 text-creek-600' },
};

const AVATARS = ['🧑‍🌾', '👩‍🌾', '👨‍🌾', '🧑‍🍳', '🧑‍🔧'];

export function avatarFor(villager: Villager) {
  let hash = 0;
  for (const ch of villager.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

export function VillagerCard({
  villager, building, selected, onSelect, onUnassign,
}: {
  villager: Villager;
  building?: Building;
  selected: boolean;
  onSelect: () => void;
  onUnassign: () => void;
}) {
  const { content } = useGame();
  const state = STATE_LABEL[villager.state];
  const def = building ? content.buildings[building.type] : undefined;
  const starving = villager.state === 'HUNGRY';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(VILLAGER_MIME, villager.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={`cursor-grab rounded-2xl border-2 bg-white p-3 text-left transition select-none active:cursor-grabbing ${
        selected ? 'border-honey-400 shadow-lift ring-4 ring-honey-200' : 'border-bark-900/10 hover:border-moss-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-3xl ${villager.state === 'WORKING' ? 'animate-bob' : ''}`} aria-hidden>
          {avatarFor(villager)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight font-semibold">{villager.name}</div>
          <span className={`chip ${state.className}`}>{state.icon} {state.text}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] font-bold text-bark-500">
        <div className="flex items-center gap-2">
          <span className="w-12">Energie</span>
          <ProgressBar value={villager.energy} max={100} tone="creek" smooth label="Energie" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12">Satt</span>
          <ProgressBar value={villager.satiety} max={100} tone="honey" smooth label="Sättigung" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="truncate text-bark-600">
          {def ? `${def.icon} ${def.name}` : '🌳 Dorfplatz'}
        </span>
        {def && (
          <button
            className="rounded-lg px-1.5 text-bark-500 hover:bg-parchment hover:text-bark-900"
            onClick={(e) => {
              e.stopPropagation();
              onUnassign();
            }}
            aria-label={`${villager.name} zum Dorfplatz schicken`}
          >
            ✕
          </button>
        )}
      </div>
      {starving && (
        <p className="mt-2 text-[11px] font-bold text-clay-500">Kein Essen im Lager! Koch Mahlzeiten oder pflück Beeren.</p>
      )}
    </div>
  );
}
