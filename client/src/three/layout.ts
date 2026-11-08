// Lageplan des Bergdorfs. Einheiten: 1 = etwa ein Meter, y = 0 ist die Wolkendecke.
//
// Das Dorf liegt auf einem Bergmassiv mit mehreren Gipfeln. Jeder Gipfel ist ein flaches
// Plateau mit steilen Felswänden; Hängebrücken und Felstreppen verbinden sie.
// Die Höhe des Geländes an jeder Stelle liefert heightAt(); Bewohner laufen über
// planRoute() von Gipfel zu Gipfel.

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

// ---------- Bildschirm-Koordinaten ----------
// Entworfen ist der Plan aus Sicht der Startkamera: sx nach rechts, dp in die Tiefe.
const RIGHT: Vec2 = [0.7809, -0.6247];
const FAR: Vec2 = [-0.6247, -0.7809];
const S = (sx: number, dp: number): Vec2 => [RIGHT[0] * sx + FAR[0] * dp, RIGHT[1] * sx + FAR[1] * dp];

// ---------- Gipfel ----------

export interface Peak {
  key: string;
  pos: Vec2;
  /** Höhe des Plateaus */
  y: number;
  /** Mindestradius des flachen Plateaus */
  r: number;
  name: string;
}

const peak = (key: string, name: string, at: Vec2, y: number, r: number): Peak => ({ key, name, pos: at, y, r });

export const PEAKS: Record<string, Peak> = {
  village: peak('village', 'Dorfgipfel', S(0, 0), 6.0, 7.4),
  forest: peak('forest', 'Waldgipfel', S(-12.8, 5.3), 7.2, 5.2),
  research: peak('research', 'Sternwarte', S(-3.5, 14), 11.0, 2.6),
  quarry: peak('quarry', 'Felsgipfel', S(9.5, 9.5), 9.0, 3.4),
  clay: peak('clay', 'Seeterrasse', S(13.8, -2.1), 4.5, 5.2),
  // vorne rechts neben der Flachsterrasse: die Brücke dorthin läuft quer durchs Bild
  weavery: peak('weavery', 'Windkuppe', S(13.5, -11.5), 3.2, 2.8),
  berry: peak('berry', 'Beerenhang', S(-9.5, -7.5), 4.3, 3.1),
  wheat: peak('wheat', 'Sonnenterrasse', S(-2.5, -11.5), 3.4, 3.4),
  flax: peak('flax', 'Flachsterrasse', S(5, -12.5), 2.6, 3.1),
  station: peak('station', 'Bahnsteig', S(-16.5, -2), 3.0, 2.8),
};
const PEAK_LIST = Object.values(PEAKS);

export const VILLAGE = PEAKS.village;
export const PLAZA_RADIUS = 2.6;

// ---------- Verbindungen ----------

export interface Connection {
  a: string;
  b: string;
  kind: 'bridge' | 'stairs';
  /** Start- und Endpunkt auf den Plateaus */
  from: Vec3;
  to: Vec3;
}

function connect(a: string, b: string, kind: Connection['kind']): Connection {
  const pa = PEAKS[a];
  const pb = PEAKS[b];
  const dx = pb.pos[0] - pa.pos[0];
  const dz = pb.pos[1] - pa.pos[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const inset = 0.35;
  return {
    a, b, kind,
    from: [pa.pos[0] + ux * (pa.r - inset), pa.y, pa.pos[1] + uz * (pa.r - inset)],
    to: [pb.pos[0] - ux * (pb.r - inset), pb.y, pb.pos[1] - uz * (pb.r - inset)],
  };
}

export const CONNECTIONS: Connection[] = [
  connect('village', 'forest', 'bridge'),
  connect('village', 'research', 'stairs'),
  connect('village', 'quarry', 'stairs'),
  connect('village', 'clay', 'stairs'),
  connect('flax', 'weavery', 'bridge'),
  connect('village', 'berry', 'stairs'),
  connect('berry', 'wheat', 'stairs'),
  connect('wheat', 'flax', 'stairs'),
  connect('berry', 'station', 'bridge'),
];

/** Durchhang der Hängebrücke an der Stelle t (0…1). */
export const bridgeSag = (len: number) => Math.min(0.9, len * 0.09);

/** Punkt auf einer Verbindung (Laufhöhe). */
export function connectionPoint(c: Connection, t: number): Vec3 {
  const x = c.from[0] + (c.to[0] - c.from[0]) * t;
  const z = c.from[2] + (c.to[2] - c.from[2]) * t;
  let y = c.from[1] + (c.to[1] - c.from[1]) * t;
  if (c.kind === 'bridge') {
    const len = Math.hypot(c.to[0] - c.from[0], c.to[2] - c.from[2]);
    y += 0.12 - bridgeSag(len) * 4 * t * (1 - t);
  } else {
    y += 0.08;
  }
  return [x, y, z];
}

// ---------- Gebäude ----------

export interface Plot {
  pos: Vec2;
  /** Plateau-Höhe */
  y: number;
  peak: string;
  /** Abstand des Arbeitsplatzes vom Gebäudemittelpunkt Richtung Dorf (0 = mitten im Feld). */
  work: number;
  /** Radius der Grundfläche, für Kollisionen der Deko. */
  radius: number;
  /** Höhe des Namensschilds über dem Plateau */
  labelHeight: number;
}

function plot(peakKey: string, at: Vec2, work: number, radius: number, labelHeight: number): Plot {
  return { pos: at, y: PEAKS[peakKey].y, peak: peakKey, work, radius, labelHeight };
}

export const PLOTS: Record<string, Plot> = {
  berryFarm: plot('berry', PEAKS.berry.pos, 0.6, 2.5, 2.6),
  // Holzfäller und Sägewerk seitlich weit genug auseinander, damit das Sägewerk die Hütte nicht verdeckt
  lumberCamp: plot('forest', S(-15.4, 6.6), 1.9, 2.6, 3.8),
  sawmill: plot('forest', S(-10.6, 3.4), 1.9, 2.3, 4.1),
  // Arbeitsplatz am vorderen Feldrand, nicht zwischen den Halmen
  wheatField: plot('wheat', PEAKS.wheat.pos, 1.7, 2.6, 2.6),
  // vorne rechts am Platz: verdeckt so weder den Brunnen noch wartende Bewohner
  kitchen: plot('village', S(4.0, -4.2), 1.9, 2.3, 4.3),
  quarry: plot('quarry', PEAKS.quarry.pos, 2.1, 2.7, 3.6),
  researchLab: plot('research', PEAKS.research.pos, 1.8, 2.1, 6.2),
  // Tonkuhle vorne links, Ziegelei hinten rechts: seitlich versetzt, damit keine die andere verdeckt
  clayPit: plot('clay', S(11.0, -3.2), 1.8, 2.4, 3.0),
  brickKiln: plot('clay', S(15.4, 1.2), 1.9, 2.2, 3.8),
  trainStation: plot('station', PEAKS.station.pos, 0, 2.4, 3.9),
  flaxField: plot('flax', PEAKS.flax.pos, 1.6, 2.4, 2.6),
  weavery: plot('weavery', S(13.9, -11.5), 1.9, 2.3, 4.2),
};

export const LANDMARKS = ['researchLab', 'trainStation'] as const;
export type LandmarkKey = (typeof LANDMARKS)[number];

/** Bergsee auf der Seeterrasse (bei der Tonkuhle). */
export const LAKE = { pos: S(16.2, -3.3), r: 1.35, y: PEAKS.clay.y - 0.12 };

// Hütten und Tisch sind (in Bildschirm-Koordinaten) so gesetzt, dass aus Kamerasicht nichts
// hintereinander steht: keine Hütte hinter dem Rathaus, nichts vor Brunnen, Treppen oder Brücken.
export const HOME_SLOTS: Vec2[] = [S(1.0, 6.0), S(-4.2, -5.4), S(3.4, 5.8), S(-2.2, -4.0), S(6.0, 2.8)];

/** Langer Esstisch vorne am Dorfplatz (niedrig, verdeckt nichts dahinter). */
export const TABLE_POS: Vec2 = S(0.4, -6.2);

/** Drehung um Y, sodass die lokale +Z-Achse (Vorderseite) zum Dorfplatz zeigt. */
export function facePlaza([x, z]: Vec2) {
  return Math.atan2(-x, -z);
}

/** Blickrichtung des Tisches (die Bänke stehen quer zur Mitte). */
export const TABLE_ROT = facePlaza(TABLE_POS) + Math.PI / 2;

// ---------- Sichtachse ----------
// Die Kamera schaut immer aus derselben Richtung (siehe MapCamera). Damit nichts verdeckt wird,
// zeigen Gebäude ihre Vorderseite zur Kamera, und Arbeiter stehen auf der Kameraseite.

/** Waagerechte Richtung vom Gelände zur Kamera (Gegenteil von FAR). */
export const TO_CAMERA: Vec2 = [-FAR[0], -FAR[1]];
/** Richtung zur Kamera inkl. Höhe, normiert (gleich wie VIEW_DIR in MapCamera). */
export const VIEW_TO_CAMERA: Vec3 = (() => {
  const v: Vec3 = [14, 15, 17.5];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();
const CAMERA_ROT = Math.atan2(TO_CAMERA[0], TO_CAMERA[1]);

/** Bildschirm-Koordinaten eines Punkts: x nach rechts, Tiefe (größer = weiter weg). */
export const toScreen = ([x, z]: Vec2): Vec2 => [x * RIGHT[0] + z * RIGHT[1], x * FAR[0] + z * FAR[1]];

/**
 * Drehung eines Gebäudes: Vorderseite zur Kamera, höchstens leicht (±23°) zum Dorfplatz geneigt.
 * So sieht man jede Tür, und der Arbeitsplatz davor liegt nie hinter dem Gebäude.
 */
export function buildingRot(pos: Vec2) {
  let d = facePlaza(pos) - CAMERA_ROT;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return CAMERA_ROT + Math.max(-0.4, Math.min(0.4, d));
}

/** Standplatz des n-ten Arbeiters vor einem Gebäude (immer auf der Kameraseite). */
export function workSpot(type: string, index: number): Vec2 {
  const p = PLOTS[type];
  if (!p) return [0, 0];
  const r = buildingRot(p.pos);
  const dx = Math.sin(r);
  const dz = Math.cos(r);
  const side = (index - 0.5) * 1.1;
  return [p.pos[0] + dx * p.work - dz * side, p.pos[1] + dz * p.work + dx * side];
}

/** Platz am Esstisch. */
export function tableSpot(index: number): Vec2 {
  const col = (index % 3) - 1;
  const row = index < 3 ? -1 : 1;
  const c = Math.cos(TABLE_ROT);
  const s = Math.sin(TABLE_ROT);
  const lx = col * 0.75;
  const lz = row * 0.7;
  return [TABLE_POS[0] + lx * c + lz * s, TABLE_POS[1] - lx * s + lz * c];
}

/** Platz vor der eigenen Hütte (auf der Kameraseite, wie bei den Gebäuden). */
export function homeSpot(index: number): Vec2 {
  const [x, z] = HOME_SLOTS[index % HOME_SLOTS.length];
  const r = buildingRot([x, z]);
  return [x + Math.sin(r) * 1.15, z + Math.cos(r) * 1.15];
}

/** Hütten stehen wie die Gebäude mit der Tür zur Kamera. */
export const homeRot = (p: Vec2) => buildingRot(p);

/** Wartende Bewohner rund um den Brunnen, nie direkt dahinter (aus Kamerasicht). */
const PLAZA_SPOTS: Vec2[] = [S(-0.8, -1.95), S(0.8, -1.95), S(1.45, -0.9), S(-1.45, 1.35), S(1.45, 1.35)];
export function plazaSpot(index: number): Vec2 {
  const [x, z] = PLAZA_SPOTS[index % PLAZA_SPOTS.length];
  return [x + VILLAGE.pos[0], z + VILLAGE.pos[1]];
}

// ---------- Zufall ----------

/** Deterministischer Zufall, damit die Deko bei jedem Laden gleich aussieht. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function distToSegment([px, pz]: Vec2, [ax, az]: Vec2, [bx, bz]: Vec2) {
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2));
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

// ---------- Gelände ----------

function hash2(ix: number, iz: number) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise2(x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0);
  const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1);
  const d = hash2(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export function fbm2(x: number, z: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f + i * 31.7, z * f - i * 17.3);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Weiches Maximum: verrundet den Fuß der Felswände. */
function smax(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Plateau-Radius in Richtung (dx, dz): leicht unregelmäßig, nie kleiner als r. */
function rimRadius(p: Peak, dx: number, dz: number) {
  const a = Math.atan2(dz, dx);
  const seed = p.pos[0] * 1.7 + p.pos[1] * 0.9;
  return p.r * (1 + 0.045 * (1 + Math.sin(3 * a + seed)) + 0.025 * (1 + Math.sin(7 * a + seed * 2.3)));
}

const CLIFF = 2.1;
const cliffDrop = (t: number) => (t <= 0 ? 0 : CLIFF * t * Math.sqrt(t) + t * 0.6);

const STAIRS = CONNECTIONS.filter((c) => c.kind === 'stairs');
const RIDGE_HALF_WIDTH = 0.85;

export interface GroundInfo {
  /** Höhe des Geländes */
  h: number;
  /** 1 = flaches Plateau/Treppe, 0 = freies Gelände */
  flat: number;
}

/** Höhe und „Plateau-Anteil“ an einer Stelle. */
export function groundAt(x: number, z: number): GroundInfo {
  const d0 = Math.hypot(x, z);
  // breites Massiv, das unter die Wolken abfällt
  let h = 3.6 * (1 - smoothstep(0, 24, d0)) - 3.2 * smoothstep(14, 34, d0) + (fbm2(x * 0.06, z * 0.06, 3) - 0.5) * 4;
  let flat = 0;

  for (const p of PEAK_LIST) {
    const dx = x - p.pos[0];
    const dz = z - p.pos[1];
    const d = Math.hypot(dx, dz);
    if (d > p.r * 1.12 + 9) continue;
    const rr = rimRadius(p, dx, dz);
    h = smax(h, p.y - cliffDrop(d - rr), 1.4);
    flat = Math.max(flat, 1 - smoothstep(rr - 0.6, rr + 0.5, d));
  }
  for (const c of STAIRS) {
    const ax = c.from[0];
    const az = c.from[2];
    const vx = c.to[0] - ax;
    const vz = c.to[2] - az;
    const len2 = vx * vx + vz * vz;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2));
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
    if (d > 8) continue;
    const y = c.from[1] + (c.to[1] - c.from[1]) * t;
    h = smax(h, y - cliffDrop(d - RIDGE_HALF_WIDTH), 0.8);
    flat = Math.max(flat, 1 - smoothstep(RIDGE_HALF_WIDTH - 0.2, RIDGE_HALF_WIDTH + 0.5, d));
  }

  // Felsstruktur nur auf den Hängen, Plateaus bleiben flach
  const rough = (fbm2(x * 0.35, z * 0.35, 4) - 0.5) * 1.6 + (fbm2(x * 1.3, z * 1.3, 2) - 0.5) * 0.35;
  h += rough * (1 - flat) + (fbm2(x * 0.9, z * 0.9, 2) - 0.5) * 0.04 * flat;

  // Bergsee: flache Mulde
  const dl = Math.hypot(x - LAKE.pos[0], z - LAKE.pos[1]);
  if (dl < LAKE.r + 0.8) h -= 0.45 * (1 - smoothstep(LAKE.r - 0.5, LAKE.r + 0.6, dl));

  return { h, flat };
}

export const heightAt = (x: number, z: number) => groundAt(x, z).h;

/** Auf welchem Gipfel liegt ein Punkt? */
export function peakAt(x: number, z: number): Peak | undefined {
  let best: Peak | undefined;
  let bestD = Infinity;
  for (const p of PEAK_LIST) {
    const d = Math.hypot(x - p.pos[0], z - p.pos[1]) - p.r;
    if (d < 0.6 && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

// ---------- Wegesuche für die Bewohner ----------

export interface RoutePoint {
  p: Vec3;
  /** Ende einer Brücke oder Treppe: hier darf ein neuer Weg beginnen. */
  landing?: boolean;
}

function neighbours(key: string) {
  return CONNECTIONS.filter((c) => c.a === key || c.b === key).map((c) => ({ c, other: c.a === key ? c.b : c.a }));
}

function findConnections(from: string, to: string) {
  const prev = new Map<string, { key: string; c: Connection }>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const k = queue.shift()!;
    if (k === to) break;
    for (const { c, other } of neighbours(k)) {
      if (seen.has(other)) continue;
      seen.add(other);
      prev.set(other, { key: k, c });
      queue.push(other);
    }
  }
  if (!seen.has(to)) return null;
  const steps: { c: Connection; forward: boolean }[] = [];
  let k = to;
  while (k !== from) {
    const step = prev.get(k)!;
    steps.unshift({ c: step.c, forward: step.c.a === step.key });
    k = step.key;
  }
  return steps;
}

const ground3 = ([x, z]: Vec2): Vec3 => [x, heightAt(x, z), z];

/** Auf dem Dorfplatz am Brunnen vorbei statt durch ihn hindurch laufen. */
function aroundPlaza(from: Vec2, to: Vec2): Vec2[] {
  const [cx, cz] = VILLAGE.pos;
  if (distToSegment([cx, cz], from, to) > PLAZA_RADIUS - 0.6) return [];
  const a1 = Math.atan2(from[1] - cz, from[0] - cx);
  const a2 = Math.atan2(to[1] - cz, to[0] - cx);
  let da = a2 - a1;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const r = PLAZA_RADIUS - 0.35;
  const steps = Math.max(1, Math.ceil(Math.abs(da) / 0.5));
  return Array.from({ length: steps - 1 }, (_, i) => {
    const a = a1 + (da * (i + 1)) / steps;
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r] as Vec2;
  });
}

/** Weg von einer Position zu einem Zielpunkt, über Brücken und Treppen. */
export function planRoute(from: Vec3, to: Vec2): RoutePoint[] {
  const start = peakAt(from[0], from[2]);
  const goal = peakAt(to[0], to[1]);
  const out: RoutePoint[] = [];
  let cursor: Vec2 = [from[0], from[2]];
  const walkTo = (target: Vec2) => {
    for (const p of aroundPlaza(cursor, target)) out.push({ p: ground3(p) });
    out.push({ p: ground3(target) });
    cursor = target;
  };

  if (start && goal && start.key !== goal.key) {
    const steps = findConnections(start.key, goal.key);
    for (const { c, forward } of steps ?? []) {
      const a = forward ? c.from : c.to;
      walkTo([a[0], a[2]]);
      const len = Math.hypot(c.to[0] - c.from[0], c.to[2] - c.from[2]);
      const n = Math.max(2, Math.ceil(len / 0.35));
      for (let i = 1; i <= n; i++) {
        const t = forward ? i / n : 1 - i / n;
        out.push({ p: connectionPoint(c, t), landing: i === n });
      }
      const b = forward ? c.to : c.from;
      cursor = [b[0], b[2]];
    }
  }
  walkTo(to);
  return out;
}
