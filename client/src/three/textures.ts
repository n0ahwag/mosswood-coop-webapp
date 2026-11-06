// Prozedurale Texturen: werden beim ersten Gebrauch einmal im Browser gezeichnet
// (keine Bilddateien), sind nahtlos kachelbar und bringen eine passende Reliefkarte
// (Normal Map) mit. Die meisten Texturen sind hell und fast farblos, damit das
// Material sie einfärben kann: ein Holzbrett-Muster passt so zu hellem und dunklem Holz.

import * as THREE from 'three';

// ---------- Rauschen ----------

function hash(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const wrap = (i: number, p: number) => ((i % p) + p) % p;

/** Kachelbares Wertrauschen mit Perioden px/py (in Gitterzellen). */
function vnoise(x: number, y: number, px: number, py: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const xa = wrap(x0, px);
  const xb = wrap(x0 + 1, px);
  const ya = wrap(y0, py);
  const yb = wrap(y0 + 1, py);
  const a = hash(xa, ya, seed);
  const b = hash(xb, ya, seed);
  const c = hash(xa, yb, seed);
  const d = hash(xb, yb, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fraktales Rauschen über die Kachel (u, v in 0…1). fx/fy: Grundfrequenz je Achse. */
function fbm(u: number, v: number, fx: number, fy: number, octaves: number, seed: number) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = fx;
  let py = fy;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(u * px, v * py, px, py, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    px *= 2;
    py *= 2;
  }
  return sum / norm;
}

/** Kachelbares Voronoi: Abstand zur nächsten und zweitnächsten Zelle plus Zell-Zufall. */
function voronoi(u: number, v: number, cells: number, seed: number, jitter = 0.85) {
  const x = u * cells;
  const y = v * cells;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i;
      const gy = cy + j;
      const wx = wrap(gx, cells);
      const wy = wrap(gy, cells);
      const px = gx + 0.5 + (hash(wx, wy, seed) - 0.5) * jitter;
      const py = gy + 0.5 + (hash(wx, wy, seed + 1) - 0.5) * jitter;
      const d = Math.hypot(x - px, y - py);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash(wx, wy, seed + 2);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, id };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------- Zeichnen ----------

type Pixel = { r: number; g: number; b: number; h: number };
type Shader = (u: number, v: number, out: Pixel) => void;

export interface TexturePair {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
}

interface PaintOptions {
  /** Helligkeit auf einen festen Mittelwert bringen, damit Materialien nicht abdunkeln. */
  normalize?: boolean;
  /** Kontrast um den Mittelwert (1 = unverändert, kleiner = ruhiger und verspielter). */
  contrast?: number;
}

// Mittlere Helligkeit der hellen Muster-Texturen (sRGB). Das Material färbt sie ein.
const TARGET_MEAN = 0.92;

// Flächiger Low-Poly-Look: keine Muster und kein Relief, nur reine Farbflächen.
// (Die Generatoren bleiben, falls später wieder etwas Struktur gewünscht ist.)
const DETAIL = 0;
const RELIEF = 0;

function paint(size: number, shader: Shader, normalStrength: number, tile: number, opts: PaintOptions = {}): TexturePair {
  const { normalize = true, contrast: rawContrast = 0.55 } = opts;
  const contrast = rawContrast * DETAIL;
  const color = document.createElement('canvas');
  color.width = color.height = size;
  const cctx = color.getContext('2d')!;
  const img = cctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  const rgb = new Float32Array(size * size * 3);
  const px: Pixel = { r: 1, g: 1, b: 1, h: 0 };
  let sum = 0;

  for (let y = 0; y < size; y++) {
    const v = 1 - (y + 0.5) / size; // Zeile 0 ist oben = v nahe 1 (Texturen werden gespiegelt geladen)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      px.r = px.g = px.b = 1;
      px.h = 0;
      shader(u, v, px);
      const i = y * size + x;
      heights[i] = px.h;
      rgb[i * 3] = px.r;
      rgb[i * 3 + 1] = px.g;
      rgb[i * 3 + 2] = px.b;
      sum += (px.r + px.g + px.b) / 3;
    }
  }
  const mean = sum / (size * size);
  const gain = normalize && mean > 0 ? TARGET_MEAN / mean : 1;
  const center = normalize ? TARGET_MEAN : mean;
  for (let i = 0; i < size * size; i++) {
    for (let k = 0; k < 3; k++) {
      const c = rgb[i * 3 + k] * gain;
      img.data[i * 4 + k] = clamp01(center + (c - center) * contrast) * 255;
    }
    img.data[i * 4 + 3] = 255;
  }
  cctx.putImageData(img, 0, 0);

  // Reliefkarte aus den Höhen (OpenGL-Konvention: Grün zeigt nach +v)
  const normal = document.createElement('canvas');
  normal.width = normal.height = size;
  const nctx = normal.getContext('2d')!;
  const nimg = nctx.createImageData(size, size);
  const s = normalStrength * RELIEF * size / 256;
  for (let y = 0; y < size; y++) {
    const yu = wrap(y - 1, size);
    const yd = wrap(y + 1, size);
    for (let x = 0; x < size; x++) {
      const xl = wrap(x - 1, size);
      const xr = wrap(x + 1, size);
      const dx = (heights[y * size + xr] - heights[y * size + xl]) * s;
      const dy = (heights[yd * size + x] - heights[yu * size + x]) * s;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nimg.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);

  const make = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.repeat.set(1 / tile, 1 / tile);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: make(color, true), normal: make(normal, false) };
}

const gray = (px: Pixel, l: number) => {
  px.r = px.g = px.b = l;
};

// ---------- Die einzelnen Muster ----------
// tile: wie viele Meter eine Kachel in der Welt abdeckt (die Geometrie hat UVs in Metern).

const GENERATORS = {
  /** Waagerechte Bretter mit Fugen, Stößen und Maserung. */
  planks: () =>
    paint(512, (u, v, px) => {
      const rows = 6;
      const r = v * rows;
      const row = Math.floor(r);
      const t = r - row;
      const off = hash(row, 3, 7);
      const bu = u * 2 + off;
      const board = Math.floor(bu);
      const bt = bu - board;
      const tone = 0.8 + hash(board & 1, row, 11) * 0.14 + (hash(wrap(board, 2), row, 5) - 0.5) * 0.06;
      const grain = fbm(u, v, 3, 48, 4, 21 + row);
      const rings = Math.sin((u * 18 + grain * 6 + hash(row, 1, 2) * 10) * Math.PI) * 0.5 + 0.5;
      let l = tone * (0.86 + grain * 0.2 + rings * 0.05);
      const edge = Math.min(t, 1 - t);
      const joint = Math.min(bt, 1 - bt);
      let h = 0.6 + grain * 0.15 + smooth(0, 0.08, edge) * 0.3;
      if (edge < 0.035) {
        l *= 0.45;
        h = 0.05;
      } else if (joint < 0.006) {
        l *= 0.55;
        h = 0.2;
      }
      // Nägel neben den Stößen
      const nail = Math.hypot((joint < 0.5 ? joint : 1 - joint) * 2.4 - 0.04, (t - 0.5) * 0.2) < 0.012;
      if (nail) {
        l *= 0.5;
        h += 0.1;
      }
      gray(px, l);
      px.r *= 1.02;
      px.b *= 0.96;
      px.h = h;
    }, 5, 1.2),

  /** Längsmaserung für Balken und Stämme (läuft entlang v). */
  grain: () =>
    paint(256, (u, v, px) => {
      const g = fbm(u, v, 24, 2, 4, 31);
      const streak = fbm(u, v, 64, 3, 2, 33);
      const l = 0.78 + g * 0.2 + streak * 0.08 - (Math.sin((u * 30 + g * 4) * Math.PI) > 0.92 ? 0.12 : 0);
      gray(px, l);
      px.h = g * 0.6 + streak * 0.4;
    }, 3, 1),

  /** Biberschwanz-Dachziegel mit runden Unterkanten. Reihen laufen entlang u, v zeigt zum First. */
  shingles: () =>
    paint(512, (u, v, px) => {
      const rows = 8;
      const cols = 6;
      const r = (1 - v) * rows; // im Bild nach unten = Richtung Traufe
      const shingleAt = (rowIndex: number, ly: number) => {
        const stagger = (rowIndex & 1) * 0.5;
        const cu = u * cols + stagger;
        const col = Math.floor(cu);
        const lx = cu - col - 0.5;
        // runde Unterkante: unten an den Ecken ausgespart
        const bottom = 1 - 0.32 * (1 - Math.sqrt(Math.max(0, 1 - (lx * 2) ** 2)));
        return { inside: ly <= bottom, lx, col, bottom };
      };
      let row = Math.floor(r);
      let ly = r - row;
      let s = shingleAt(row, ly);
      if (!s.inside) {
        // in der Ecke unter der Rundung sieht man den Ziegel der nächsten Reihe
        row += 1;
        ly -= 1;
        s = shingleAt(row, ly + 1e-3);
        ly = Math.max(ly + 1, 0) * 0.05; // oberes Ende des darunterliegenden Ziegels
      }
      const wr = wrap(row, rows);
      const wc = wrap(s.col, cols);
      const tone = 0.74 + hash(wc, wr, 41) * 0.22;
      const n = fbm(u, v, 12, 12, 3, 43);
      const gap = Math.abs(s.lx) > 0.47;
      let l = tone * (0.9 + n * 0.15) * (0.82 + ly * 0.22);
      let h = 0.15 + ly * 0.75 + n * 0.08;
      // weicher Schatten an der Kante des darüberliegenden Ziegels
      if (ly < 0.08) l *= 0.72 + ly * 3;
      if (gap) {
        l *= 0.45;
        h = 0.05;
      }
      gray(px, l);
      px.h = h;
    }, 6, 1),

  /** Strohdach: dichte Halme mit versetzten Lagen. */
  thatch: () =>
    paint(512, (u, v, px) => {
      const strands = fbm(u, v, 96, 3, 3, 51);
      const fine = fbm(u, v, 200, 6, 2, 53);
      const layers = 5;
      const lv = (1 - v) * layers + fbm(u, v, 6, 1, 2, 55) * 0.6;
      const lt = lv - Math.floor(lv);
      const l = (0.72 + strands * 0.28 + fine * 0.08) * (0.78 + lt * 0.26);
      gray(px, l);
      px.r *= 1.03;
      px.h = strands * 0.5 + lt * 0.5;
    }, 4, 1.4),

  /** Bruchsteinmauer mit unregelmäßigen Steinen und Mörtelfugen. */
  stoneWall: () => {
    const rowH = [0.28, 0.22, 0.27, 0.23];
    const rowsStart: number[] = [];
    rowH.reduce((acc, h) => {
      rowsStart.push(acc);
      return acc + h;
    }, 0);
    const splits = rowH.map((_, k) => {
      const n = 3 + Math.floor(hash(k, 0, 61) * 2.5);
      const base = hash(k, 1, 62);
      return Array.from({ length: n }, (_, i) => (base + i / n + (hash(k, i, 63) - 0.5) * 0.12) % 1).sort((a, b) => a - b);
    });
    return paint(512, (u, v, px) => {
      const w = 1 - v;
      let k = rowH.length - 1;
      for (let i = 0; i < rowH.length; i++) if (w < rowsStart[i] + rowH[i]) { k = i; break; }
      const ly = (w - rowsStart[k]) / rowH[k];
      const sp = splits[k];
      let idx = sp.findIndex((s) => s > u);
      if (idx === -1) idx = 0;
      const right = sp[idx];
      const left = sp[(idx - 1 + sp.length) % sp.length];
      const width = wrap(right - left + 1, 1) || 1;
      const lx = wrap(u - left, 1) / width;
      const ex = Math.min(lx, 1 - lx) * width * 4;
      const ey = Math.min(ly, 1 - ly) * rowH[k] * 4;
      const wobble = (fbm(u, v, 16, 16, 3, 65) - 0.5) * 0.05;
      const edge = Math.min(ex, ey) + wobble;
      const stone = hash(k, idx, 67);
      const speck = fbm(u, v, 48, 48, 3, 69);
      if (edge < 0.018) {
        gray(px, 0.62 + speck * 0.15);
        px.h = 0.05 + speck * 0.05;
        return;
      }
      const l = (0.66 + stone * 0.3) * (0.85 + speck * 0.25);
      gray(px, l);
      px.r *= 1 + (stone - 0.5) * 0.06;
      px.b *= 1 - (stone - 0.5) * 0.05;
      px.h = 0.35 + smooth(0, 0.12, edge) * 0.5 + speck * 0.12;
    }, 6, 1.5);
  },

  /** Kopfsteinpflaster (Voronoi). */
  cobble: () =>
    paint(512, (u, v, px) => {
      const c = voronoi(u, v, 9, 71);
      const edge = c.f2 - c.f1;
      const speck = fbm(u, v, 40, 40, 3, 73);
      if (edge < 0.07) {
        gray(px, 0.55 + speck * 0.2);
        px.r *= 1.03;
        px.h = 0.02;
        return;
      }
      gray(px, (0.7 + c.id * 0.28) * (0.88 + speck * 0.22));
      px.h = 0.3 + smooth(0.07, 0.35, edge) * 0.6 + speck * 0.08;
    }, 6, 1.8),

  /** Kalkputz: fast weiß mit weichen Flecken und feinem Korn. */
  plaster: () =>
    paint(256, (u, v, px) => {
      const blot = fbm(u, v, 3, 3, 4, 81);
      const grainN = fbm(u, v, 64, 64, 2, 83);
      gray(px, 0.86 + blot * 0.1 + grainN * 0.06);
      px.h = blot * 0.4 + grainN * 0.6;
    }, 1.5, 2),

  /** Ziegelmauer im Läuferverband, schon eingefärbt. */
  bricks: () =>
    paint(512, (u, v, px) => {
      const rows = 12;
      const r = v * rows;
      const row = Math.floor(r);
      const ly = r - row;
      const bu = u * 4 + (row & 1) * 0.5;
      const col = Math.floor(bu);
      const lx = bu - col;
      const speck = fbm(u, v, 48, 48, 3, 91);
      const mortar = ly < 0.1 || lx < 0.03;
      if (mortar) {
        px.r = 0.98 * (0.92 + speck * 0.1);
        px.g = 0.93 * (0.92 + speck * 0.1);
        px.b = 0.84 * (0.92 + speck * 0.1);
        px.h = 0.05;
        return;
      }
      const tone = hash(wrap(col, 4), wrap(row, rows), 93);
      const l = (0.85 + tone * 0.2) * (0.92 + speck * 0.12);
      px.r = 0.95 * l;
      px.g = 0.52 * l;
      px.b = 0.36 * l;
      px.h = 0.45 + speck * 0.2 + smooth(0, 0.1, Math.min(lx, 1 - lx, ly - 0.1, 1 - ly)) * 0.3;
    }, 4, 1, { normalize: false, contrast: 0.85 }),

  /** Rinde: senkrechte Furchen. */
  bark: () =>
    paint(256, (u, v, px) => {
      const ridges = fbm(u, v, 12, 2, 4, 101);
      const cracks = Math.abs(Math.sin((u * 10 + ridges * 3) * Math.PI));
      const l = 0.6 + ridges * 0.3 + cracks * 0.15;
      gray(px, l);
      px.h = cracks * 0.7 + ridges * 0.3;
    }, 6, 1),

  /** Feines Grasmuster für das Gelände (wird von oben projiziert). */
  grassDetail: () =>
    paint(512, (u, v, px) => {
      const blades = fbm(u, v, 128, 128, 2, 111);
      const tufts = fbm(u, v, 24, 24, 3, 113);
      const patches = fbm(u, v, 4, 4, 3, 115);
      gray(px, 0.8 + blades * 0.16 + tufts * 0.12 + (patches - 0.5) * 0.12);
      px.g *= 1.02;
      px.h = blades * 0.5 + tufts * 0.5;
    }, 3, 3),

  /** Fels mit Rissen, Schichten und Sprenkeln (seitlich projiziert). */
  rockDetail: () =>
    paint(512, (u, v, px) => {
      // waagerechte Gesteinsschichten mit feinen Rissen statt grober Platten
      const warp = fbm(u, v, 4, 4, 4, 123);
      const layer = v * 9 + warp * 2.2;
      const band = layer - Math.floor(layer);
      const strata = smooth(0, 0.12, band) * (1 - smooth(0.82, 1, band));
      const c = voronoi(u, v, 11, 121, 1);
      const crack = smooth(0, 0.035, c.f2 - c.f1);
      const speck = fbm(u, v, 64, 64, 3, 125);
      const blot = fbm(u, v, 6, 6, 3, 127);
      const l = (0.74 + blot * 0.2 + (hash(Math.floor(layer), 0, 129) - 0.5) * 0.12) * (0.84 + speck * 0.22) * (0.7 + strata * 0.3) * (0.8 + crack * 0.2);
      gray(px, l);
      px.r *= 1.02;
      px.h = strata * 0.55 + crack * 0.2 + speck * 0.25;
    }, 7, 4),

  /** Kleine runde Buckel – lässt Baumkronen und Büsche belaubt wirken. */
  leafy: () =>
    paint(256, (u, v, px) => {
      const c = voronoi(u, v, 10, 131, 1);
      const bump = 1 - smooth(0, 0.55, c.f1);
      gray(px, 0.82 + bump * 0.18 + c.id * 0.06);
      px.h = bump;
    }, 5, 0.9),

  /** Ackerfurchen für Felder (Furchen laufen entlang u). */
  soil: () =>
    paint(256, (u, v, px) => {
      const clumps = fbm(u, v, 24, 24, 3, 141);
      const furrow = Math.sin(v * 8 * Math.PI * 2) * 0.5 + 0.5;
      gray(px, (0.72 + clumps * 0.25) * (0.78 + furrow * 0.25));
      px.h = furrow * 0.7 + clumps * 0.3;
    }, 5, 2),

  /** Leinengewebe für Stoffe, Markisen und Segel. */
  cloth: () =>
    paint(256, (u, v, px) => {
      const warp = Math.sin(u * 64 * Math.PI * 2) * 0.5 + 0.5;
      const weft = Math.sin(v * 64 * Math.PI * 2) * 0.5 + 0.5;
      const check = (Math.floor(u * 64) + Math.floor(v * 64)) & 1;
      const n = fbm(u, v, 8, 8, 2, 151);
      gray(px, 0.86 + (check ? warp : weft) * 0.1 + n * 0.06);
      px.h = check ? warp : weft;
    }, 2, 0.5),
} as const;

export type TextureKind = keyof typeof GENERATORS;

const cache = new Map<TextureKind, TexturePair>();

/** Liefert ein Textur-Paar (Farbe + Relief); wird beim ersten Aufruf gezeichnet. */
export function tex(kind: TextureKind): TexturePair {
  let t = cache.get(kind);
  if (!t) {
    t = GENERATORS[kind]();
    cache.set(kind, t);
  }
  return t;
}

/** Weicher runder Fleck (für Wolken, Kontaktschatten, Lichtschein). */
let softDot: THREE.CanvasTexture | null = null;
export function softDotTexture() {
  if (softDot) return softDot;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  softDot = new THREE.CanvasTexture(c);
  softDot.colorSpace = THREE.SRGBColorSpace;
  return softDot;
}
