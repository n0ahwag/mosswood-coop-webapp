// Lageplan der schwebenden Insel. Einheiten: 1 = etwa ein Meter.
// Der Dorfplatz liegt im Ursprung, alle Gebäude schauen zu ihm.

export type Vec2 = [number, number];

export const ISLAND_RADIUS = 15;
export const PLAZA_RADIUS = 2.6;

export interface Plot {
  pos: Vec2;
  /** Abstand des Arbeitsplatzes vom Gebäudemittelpunkt Richtung Dorfplatz (0 = mitten im Feld). */
  work: number;
  /** Radius der Grundfläche, für Kollisionen der Deko. */
  radius: number;
  /** Höhe, in der das Namensschild schwebt. */
  labelHeight: number;
}

export const PLOTS: Record<string, Plot> = {
  lumberCamp: { pos: [-9, -5], work: 1.9, radius: 2.6, labelHeight: 3.6 },
  quarry: { pos: [8, -7], work: 2.1, radius: 2.7, labelHeight: 3.4 },
  clayPit: { pos: [9, 3], work: 1.8, radius: 2.4, labelHeight: 2.8 },
  berryFarm: { pos: [-8, 5], work: 0.6, radius: 2.5, labelHeight: 2.4 },
  wheatField: { pos: [-3, 9], work: 0.4, radius: 2.6, labelHeight: 2.4 },
  flaxField: { pos: [3, 9.5], work: 0.4, radius: 2.4, labelHeight: 2.4 },
  sawmill: { pos: [-4.5, -3], work: 1.9, radius: 2.3, labelHeight: 3.9 },
  brickKiln: { pos: [5, -2.5], work: 1.9, radius: 2.2, labelHeight: 3.6 },
  weavery: { pos: [4.5, 4], work: 1.9, radius: 2.3, labelHeight: 4 },
  kitchen: { pos: [-4, 3], work: 1.9, radius: 2.3, labelHeight: 4.1 },
  // Wahrzeichen ohne Arbeiter: Forschungsturm und Bahnhof (Fahrt ins Tal)
  researchLab: { pos: [-11.5, 0.5], work: 1.8, radius: 2.1, labelHeight: 5.5 },
  trainStation: { pos: [-7.8, -11.4], work: 0, radius: 2.4, labelHeight: 3.8 },
};

export const LANDMARKS = ['researchLab', 'trainStation'] as const;
export type LandmarkKey = (typeof LANDMARKS)[number];

export const HOME_SLOTS: Vec2[] = [
  [-2.4, -8],
  [0, -8.8],
  [2.4, -8],
  [-4.6, -9.6],
  [4.6, -9.6],
];

export const RIVER_POINTS: Vec2[] = [
  [12.3, -4],
  [11.2, -0.5],
  [11.6, 4.2],
  [8.6, 8.6],
  [6.2, 13.7],
];

/** Drehung um Y, sodass die lokale +Z-Achse (Vorderseite) zum Dorfplatz zeigt. */
export function facePlaza([x, z]: Vec2) {
  return Math.atan2(-x, -z);
}

function towardPlaza([x, z]: Vec2): Vec2 {
  const len = Math.hypot(x, z) || 1;
  return [-x / len, -z / len];
}

/** Standplatz des n-ten Arbeiters vor einem Gebäude. */
export function workSpot(type: string, index: number): Vec2 {
  const plot = PLOTS[type];
  if (!plot) return [0, 0];
  const [dx, dz] = towardPlaza(plot.pos);
  const side = (index - 0.5) * 1.1;
  return [
    plot.pos[0] + dx * plot.work - dz * side,
    plot.pos[1] + dz * plot.work + dx * side,
  ];
}

/** Langer Esstisch neben der Küche. */
export const TABLE_POS: Vec2 = [-6.4, 1];

/** Platz am Esstisch. */
export function tableSpot(index: number): Vec2 {
  const col = (index % 3) - 1;
  const row = index < 3 ? -1 : 1;
  return [TABLE_POS[0] + col * 0.75, TABLE_POS[1] + row * 0.7];
}

/** Platz vor der eigenen Hütte. */
export function homeSpot(index: number): Vec2 {
  const [x, z] = HOME_SLOTS[index % HOME_SLOTS.length];
  return [x, z + 1.2];
}

/** Platz rund um den Brunnen. */
export function plazaSpot(index: number): Vec2 {
  const a = (index / 5) * Math.PI * 2 + 0.4;
  return [Math.cos(a) * 1.8, Math.sin(a) * 1.8];
}

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
