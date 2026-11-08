// Fußwege auf den Plateaus und Platzprüfung für Bäume, Steine und Gras.

import {
  CONNECTIONS, connectionPoint, distToSegment, heightAt, HOME_SLOTS, homeSpot, LAKE, PEAKS, PLAZA_RADIUS, plazaSpot, PLOTS,
  TABLE_POS, tableSpot, toScreen, VIEW_TO_CAMERA, VILLAGE, workSpot, type Vec2, type Vec3,
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

// ---------- Sichtlinien ----------
// Die Kamera schaut immer aus derselben Richtung. Bäume, Büsche und Felsbrocken dürfen nur dort
// stehen, wo sie aus dieser Richtung nichts Wichtiges verdecken: Gebäude, Hütten, Tisch, Brunnen,
// die Standplätze der Bewohner sowie Brücken und Treppen.

/** Ungefähre Höhe der Modelle (Buildings.tsx, Landmarks.tsx). */
const MODEL_HEIGHT: Record<string, number> = {
  berryFarm: 1.2, wheatField: 1.2, flaxField: 1.2, clayPit: 1.6, quarry: 2.6,
  lumberCamp: 3.4, sawmill: 3.4, kitchen: 3.8, weavery: 3.8, brickKiln: 2.8,
  researchLab: 6.4, trainStation: 3.4, townHall: 5.2,
};

interface KeyPoint {
  p: Vec3;
  /** Bildschirm-x, für die schnelle Vorauswahl */
  sx: number;
}

let keyPoints: KeyPoint[] | null = null;

/** Punkte, die immer sichtbar bleiben sollen (sortiert nach Bildschirm-x). */
function sightKeyPoints(): KeyPoint[] {
  if (keyPoints) return keyPoints;
  const pts: Vec3[] = [];
  const footprint = (pos: Vec2, r: number, y: number, h: number) => {
    for (const fx of [-0.7, 0, 0.7]) for (const fz of [-0.7, 0, 0.7]) for (const fy of [0.15, 0.55, 0.95]) {
      pts.push([pos[0] + fx * r, y + fy * h, pos[1] + fz * r]);
    }
  };
  const person = (s: Vec2) => {
    const y = heightAt(s[0], s[1]);
    pts.push([s[0], y + 0.4, s[1]], [s[0], y + 1.2, s[1]]);
  };
  for (const [type, plot] of Object.entries(PLOTS)) {
    footprint(plot.pos, plot.radius * 0.8, plot.y, MODEL_HEIGHT[type] ?? 3.5);
    person(workSpot(type, 0));
    person(workSpot(type, 1));
  }
  HOME_SLOTS.forEach((h, i) => {
    footprint(h, 0.85, VILLAGE.y, 2.4);
    person(homeSpot(i));
  });
  footprint(TABLE_POS, 1.1, VILLAGE.y, 1);
  for (let i = 0; i < 6; i++) person(tableSpot(i));
  for (let i = 0; i < 5; i++) person(plazaSpot(i));
  footprint(VILLAGE.pos, 0.9, VILLAGE.y, 2.1);
  for (const c of CONNECTIONS) {
    for (let t = 0.05; t < 1; t += 0.1) {
      const q = connectionPoint(c, t);
      pts.push([q[0], q[1] + 0.6, q[2]]);
    }
  }
  keyPoints = pts.map((p) => ({ p, sx: toScreen([p[0], p[2]])[0] })).sort((a, b) => a.sx - b.sx);
  return keyPoints;
}

/** Läuft der Sichtstrahl von q zur Kamera durch den Zylinder (Mitte c, Radius r, Höhe y0…y1)? */
function rayHitsCylinder(q: Vec3, c: Vec2, r: number, y0: number, y1: number) {
  const [dx3, dy3, dz3] = VIEW_TO_CAMERA;
  const ox = q[0] - c[0];
  const oz = q[2] - c[1];
  const a = dx3 * dx3 + dz3 * dz3;
  const b = 2 * (ox * dx3 + oz * dz3);
  const cc = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return false;
  const t0 = Math.max(0.05, (-b - Math.sqrt(disc)) / (2 * a));
  const t1 = (-b + Math.sqrt(disc)) / (2 * a);
  if (t1 < t0) return false;
  const ya = q[1] + dy3 * t0;
  const yb = q[1] + dy3 * t1;
  return Math.min(ya, yb) < y1 && Math.max(ya, yb) > y0;
}

/**
 * Würde ein Objekt (Zylinder um p, Radius r, vom Boden baseY bis baseY + height) aus
 * Kamerasicht etwas Wichtiges verdecken?
 */
export function blocksView(p: Vec2, baseY: number, height: number, r: number) {
  const pts = sightKeyPoints();
  const sx = toScreen(p)[0];
  // binäre Suche nach dem ersten Punkt, der seitlich nah genug liegt
  let lo = 0;
  let hi = pts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].sx < sx - r - 0.1) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < pts.length && pts[i].sx <= sx + r + 0.1; i++) {
    if (rayHitsCylinder(pts[i].p, p, r, baseY, baseY + height)) return true;
  }
  return false;
}
