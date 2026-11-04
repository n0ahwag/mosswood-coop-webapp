import { useEffect, useRef, useState } from 'react';
import type { GameContent, Inventory } from '../lib/types';

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
    moss: 'bg-moss-400',
    honey: 'bg-honey-400',
    clay: 'bg-clay-400',
    creek: 'bg-creek-400',
  } as const;

  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-bark-900/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full ${colors[tone]} ${animate ? 'transition-[width] duration-[2000ms] ease-linear' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ResourceList({
  items, content, className = '',
}: {
  items: Inventory;
  content: GameContent;
  className?: string;
}) {
  const entries = Object.entries(items);
  if (entries.length === 0) return <span className={className}>–</span>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {entries.map(([res, n]) => (
        <span key={res} title={content.resources[res]?.name ?? res} className="whitespace-nowrap">
          {n} {content.resources[res]?.icon ?? res}
        </span>
      ))}
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
