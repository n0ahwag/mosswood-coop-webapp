// Fußwege auf den Plateaus und Platzprüfung für Bäume, Steine und Gras.

import {
  CONNECTIONS, distToSegment, HOME_SLOTS, LAKE, PEAKS, PLAZA_RADIUS, PLOTS, TABLE_POS, VILLAGE, workSpot,
  type Vec2,
} from './layout';

const plazaEdge = (toward: Vec2): Vec2 => {
  const [cx, cz] = VILLAGE.pos;
  const dx = toward[0] - cx;
  const dz = toward[1] - cz;
  const len = Math.hypot(dx, dz) || 1;
  return [cx + (dx / len) * (PLAZA_RADIUS + 0.2), cz + (dz / len) * (PLAZA_RADIUS + 0.2)];
};

/** Trampelpfade als Strecken (werden ins Gelände gemalt). */
export const PATH_SEGMENTS: [Vec2, Vec2][] = (() => {
  const out: [Vec2, Vec2][] = [];
  const hubOf = (peakKey: string, toward: Vec2): Vec2 =>
    peakKey === 'village' ? plazaEdge(toward) : PEAKS[peakKey].pos;

  // von jeder Brücke/Treppe zur Mitte des Gipfels
  for (const c of CONNECTIONS) {
    const a: Vec2 = [c.from[0], c.from[2]];
    const b: Vec2 = [c.to[0], c.to[2]];
    out.push([a, hubOf(c.a, a)]);
    out.push([b, hubOf(c.b, b)]);
  }
  // zu jedem Arbeitsplatz
  for (const [type, plot] of Object.entries(PLOTS)) {
    const spot = workSpot(type, 0);
    const hub = hubOf(plot.peak, spot);
    if (Math.hypot(spot[0] - hub[0], spot[1] - hub[1]) > 0.5) out.push([hub, spot]);
  }
  for (const h of HOME_SLOTS) out.push([plazaEdge(h), h]);
  out.push([plazaEdge(TABLE_POS), TABLE_POS]);
  return out;
})();

export function distToPath(p: Vec2) {
  let best = Infinity;
  for (const [a, b] of PATH_SEGMENTS) best = Math.min(best, distToSegment(p, a, b));
  return best;
}

/** Ist hier Platz für Deko? gap: Mindestabstand zu Gebäuden, Wegen usw. */
export function isFree(p: Vec2, gap = 0.6) {
  const [cx, cz] = VILLAGE.pos;
  if (Math.hypot(p[0] - cx, p[1] - cz) < PLAZA_RADIUS + 0.5 + gap) return false;
  for (const plot of Object.values(PLOTS)) {
    if (Math.hypot(p[0] - plot.pos[0], p[1] - plot.pos[1]) < plot.radius + gap) return false;
  }
  for (const h of HOME_SLOTS) if (Math.hypot(p[0] - h[0], p[1] - h[1]) < 1.3 + gap) return false;
  if (Math.hypot(p[0] - TABLE_POS[0], p[1] - TABLE_POS[1]) < 1.6 + gap) return false;
  if (Math.hypot(p[0] - LAKE.pos[0], p[1] - LAKE.pos[1]) < LAKE.r + 0.4 + gap) return false;
  for (const c of CONNECTIONS) {
    if (distToSegment(p, [c.from[0], c.from[2]], [c.to[0], c.to[2]]) < 1.0 + gap) return false;
  }
  if (distToPath(p) < 0.55 + gap * 0.5) return false;
  return true;
}
