import { useEffect, useRef, useState } from 'react';
import type { GameContent, Inventory } from '../lib/types';
import { ResourceIcon } from './icons/ResourceIcon';

export function ProgressBar({
  value, max, tone = 'moss', smooth = false, label,
}: {
  value: number;
  max: number;
  tone?: 'moss' | 'honey' | 'clay' | 'creek';
  smooth?: boolean;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  // Nur beim Vorwärtslaufen animieren, sonst springt der Balken beim Zyklusende sichtbar zurück.
  const prev = useRef(pct);
  const animate = smooth && pct >= prev.current;
  useEffect(() => {
    prev.current = pct;
  }, [pct]);

  const colors = {
    moss: 'bg-[#6cbf3c]',
    honey: 'bg-[#f5b52e]',
    clay: 'bg-[#e0634c]',
    creek: 'bg-[#4697e2]',
  } as const;

  return (
    <div
      className="h-3.5 w-full overflow-hidden rounded-full bg-[#3a2f26]/80 shadow-[inset_0_2px_2px_rgba(0,0,0,0.35)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full shadow-[inset_0_2px_0_rgba(255,255,255,0.35)] ${colors[tone]} ${animate ? 'transition-[width] duration-[2000ms] ease-linear' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ResourceList({
  items, content, className = '', iconSize = 22,
}: {
  items: Inventory;
  content: GameContent;
  className?: string;
  iconSize?: number;
}) {
  const entries = Object.entries(items);
  if (entries.length === 0) return <span className={className}>–</span>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {entries.map(([res, n]) => (
        <span key={res} title={content.resources[res]?.name ?? res} className="inline-flex items-center gap-0.5 whitespace-nowrap">
          {n}
          <ResourceIcon resource={res} size={iconSize} />
        </span>
      ))}
    </span>
  );
}

/** Kosten als Chips „Haben/Brauchen“: grün, wenn genug im Lager ist, sonst rot. */
export function CostChips({ cost, inventory, size = 18 }: { cost: Inventory; inventory: Inventory; size?: number }) {
  return (
    <span className="flex flex-wrap gap-1">
      {Object.entries(cost).map(([r, n]) => {
        const have = inventory[r] ?? 0;
        return (
          <span
            key={r}
            className={`chip gap-0.5 tabular-nums ${have >= n ? 'bg-moss-100 text-moss-800' : 'bg-clay-200 text-clay-500'}`}
          >
            <ResourceIcon resource={r} size={size} />
            {Math.min(have, n)}/{n}
          </span>
        );
      })}
    </span>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m.toString().padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${sec.toString().padStart(2, '0')} s`;
  return `${sec} s`;
}
