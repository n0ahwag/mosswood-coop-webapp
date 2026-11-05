import { useEffect, useState } from 'react';
import { fx } from '../lib/fx';
import { ResourceIcon } from './icons/ResourceIcon';

interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
}
interface Label {
  id: number;
  x: number;
  y: number;
  text: string;
  resource?: string;
}

const GOLD = ['#f6d77e', '#fff3c4', '#e9b949', '#ffffff'];
const GREEN = ['#9be36b', '#d9f5b8', '#6c9f3a', '#ffffff'];

/** Funkeln und schwebende Häkchen über der ganzen Seite. */
export function FxOverlay() {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(
    () =>
      fx.on((e) => {
        if (e.type !== 'screen') return;
        const palette = e.tone === 'green' ? GREEN : GOLD;
        const now = Date.now();
        const burst = e.sparks === false ? [] : Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
          const r = 30 + Math.random() * 34;
          return {
            id: now + i + Math.random(),
            x: e.x,
            y: e.y,
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r - 18,
            color: palette[i % palette.length],
          };
        });
        setSparks((s) => [...s, ...burst]);
        const label = { id: now + Math.random(), x: e.x, y: e.y - 18, text: e.label ?? '✔', resource: e.resource };
        setLabels((l) => [...l, label]);
        setTimeout(() => {
          setSparks((s) => s.filter((p) => !burst.includes(p)));
          setLabels((l) => l.filter((x) => x.id !== label.id));
        }, 1200);
      }),
    [],
  );

  return (
    <div aria-hidden>
      {sparks.map((s) => (
        <span
          key={s.id}
          className="fx-spark"
          style={{
            left: s.x - 5,
            top: s.y - 5,
            background: s.color,
            boxShadow: `0 0 6px ${s.color}`,
            ['--dx' as string]: `${s.dx}px`,
            ['--dy' as string]: `${s.dy}px`,
          }}
        />
      ))}
      {labels.map((l) => (
        <span key={l.id} className="fx-label" style={{ left: l.x, top: l.y }}>
          {l.text}
          {l.resource && <ResourceIcon resource={l.resource} size={28} />}
        </span>
      ))}
    </div>
  );
}
