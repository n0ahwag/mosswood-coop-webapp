// Ereignisbus für visuelles Feedback (Partikel, schwebende Texte),
// damit UI und 3D-Szene entkoppelt bleiben.
import type { Inventory } from './types';

export type FxEvent =
  | { type: 'collect'; buildingId: string; moved: Inventory }
  | { type: 'assign'; villagerId: string; buildingId: string | null }
  | { type: 'screen'; x: number; y: number; label?: string; tone?: 'gold' | 'green'; resource?: string; sparks?: boolean };

const bus = new EventTarget();

export const fx = {
  emit(event: FxEvent) {
    bus.dispatchEvent(new CustomEvent<FxEvent>('fx', { detail: event }));
  },
  on(handler: (event: FxEvent) => void) {
    const listener = (e: Event) => handler((e as CustomEvent<FxEvent>).detail);
    bus.addEventListener('fx', listener);
    return () => bus.removeEventListener('fx', listener);
  },
  /** Funkeln an der Position eines Elements (z. B. eines Buttons). */
  burstAt(el: Element | null, label?: string, tone: 'gold' | 'green' = 'gold') {
    if (!el) return;
    const r = el.getBoundingClientRect();
    fx.emit({ type: 'screen', x: r.left + r.width / 2, y: r.top + r.height / 2, label, tone });
  },
};
