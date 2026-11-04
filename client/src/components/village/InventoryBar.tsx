import { useGame } from '../../game/GameProvider';
import type { Inventory } from '../../lib/types';

export function InventoryBar({ inventory, cap }: { inventory: Inventory; cap: number }) {
  const { content } = useGame();
  return (
    <div className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-5 xl:grid-cols-10">
      {Object.entries(content.resources).map(([key, res]) => {
        const amount = inventory[key] ?? 0;
        const full = amount >= cap;
        return (
          <div
            key={key}
            title={`${res.name}: ${amount} / ${cap}`}
            className={`flex items-center gap-2 rounded-2xl px-2.5 py-1.5 ${
              full ? 'bg-clay-200' : res.tier === 'raw' ? 'bg-parchment' : 'bg-honey-200'
            }`}
          >
            <span className="text-xl" aria-hidden>{res.icon}</span>
            <div className="min-w-0 leading-tight">
              <div className="font-display text-lg font-semibold tabular-nums">{amount}</div>
              <div className="truncate text-[11px] font-bold text-bark-500">{res.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
