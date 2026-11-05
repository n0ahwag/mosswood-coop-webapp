import { useGame } from '../../game/GameProvider';
import type { Inventory } from '../../lib/types';
import { ResourceIcon } from '../icons/ResourceIcon';

export function InventoryBar({ inventory, cap }: { inventory: Inventory; cap: number }) {
  const { content } = useGame();
  return (
    <div className="card grid grid-cols-5 gap-1.5 p-2 sm:gap-2 sm:p-3 xl:grid-cols-10">
      {Object.entries(content.resources).map(([key, res]) => {
        const amount = inventory[key] ?? 0;
        const full = amount >= cap;
        return (
          <div
            key={key}
            title={`${res.name}: ${amount} / ${cap}`}
            aria-label={`${res.name}: ${amount} von ${cap}`}
            className={`slot flex flex-col items-center gap-0.5 px-1 py-1.5 sm:flex-row sm:gap-2 sm:px-2 ${full ? 'border-clay-400! bg-clay-200!' : ''}`}
          >
            <ResourceIcon resource={key} size={30} className="sm:h-[34px] sm:w-[34px]" />
            <div className="min-w-0 text-center leading-tight sm:text-left">
              <div className="font-display text-base font-semibold tabular-nums sm:text-lg">{amount}</div>
              <div className="hidden truncate text-[11px] font-bold text-bark-500 sm:block">{res.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
