// Gemeinsame Materialien und Grundformen für alle Modelle.
//
// Materialien werden nur einmal angelegt und überall geteilt (spart Shader und Speicher).
// Die Grundformen haben UV-Koordinaten in Metern; die Texturen wissen, wie groß eine
// Kachel in der Welt ist. So sieht ein Brett auf einer kleinen Kiste genauso groß aus
// wie auf einer Scheunenwand.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tex, type TextureKind } from './textures';

type MatOptions = Omit<THREE.MeshStandardMaterialParameters, 'normalScale'> & { texture?: TextureKind; relief?: number };

function std({ texture, relief = 1, ...params }: MatOptions) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...params });
  if (texture) {
    const t = tex(texture);
    m.map = t.map;
    m.normalMap = t.normal;
    m.normalScale = new THREE.Vector2(relief, relief);
  }
  return m;
}

function build() {
  return {
    plaster: std({ texture: 'plaster', color: '#f7efdd', roughness: 0.95, relief: 0.5 }),
    plasterWarm: std({ texture: 'plaster', color: '#f2dfbb', roughness: 0.95, relief: 0.5 }),
    plasterRose: std({ texture: 'plaster', color: '#f1d2c4', roughness: 0.95, relief: 0.5 }),
    timber: std({ texture: 'grain', color: '#6b4528', roughness: 0.85, relief: 0.6 }),
    wood: std({ texture: 'planks', color: '#b47a44', roughness: 0.85, relief: 0.8 }),
    woodLight: std({ texture: 'planks', color: '#d6a46c', roughness: 0.85, relief: 0.8 }),
    woodDark: std({ texture: 'planks', color: '#7c5131', roughness: 0.85, relief: 0.8 }),
    woodGreen: std({ texture: 'planks', color: '#6f9a74', roughness: 0.8, relief: 0.7 }),
    woodBlue: std({ texture: 'planks', color: '#6f95b3', roughness: 0.8, relief: 0.7 }),
    woodRed: std({ texture: 'planks', color: '#c0583d', roughness: 0.8, relief: 0.7 }),
    beam: std({ texture: 'grain', color: '#c08d58', roughness: 0.85, relief: 0.6 }),
    log: std({ texture: 'bark', color: '#7d5535', roughness: 0.95, relief: 1.2 }),
    logEnd: std({ texture: 'grain', color: '#e2b77c', roughness: 0.9, relief: 0.3 }),
    stone: std({ texture: 'stoneWall', color: '#cfc4b3', roughness: 0.95, relief: 1.1 }),
    stoneDark: std({ texture: 'stoneWall', color: '#9e9384', roughness: 0.95, relief: 1.1 }),
    rock: std({ texture: 'rockDetail', color: '#b2a796', roughness: 0.95, relief: 1.2 }),
    cobble: std({ texture: 'cobble', color: '#d3c19c', roughness: 0.95, relief: 1 }),
    roofRed: std({ texture: 'shingles', color: '#cf6a3f', roughness: 0.75, relief: 1.1 }),
    roofDark: std({ texture: 'shingles', color: '#a9502f', roughness: 0.75, relief: 1.1 }),
    roofSlate: std({ texture: 'shingles', color: '#61788b', roughness: 0.6, relief: 1.1 }),
    roofMoss: std({ texture: 'shingles', color: '#8a9a5b', roughness: 0.8, relief: 1.1 }),
    thatch: std({ texture: 'thatch', color: '#dcb465', roughness: 1, relief: 1.3 }),
    brick: std({ texture: 'bricks', color: '#ffffff', roughness: 0.9, relief: 1 }),
    clay: std({ texture: 'plaster', color: '#b9754b', roughness: 0.9, relief: 0.8 }),
    clayWet: std({ texture: 'plaster', color: '#8c5232', roughness: 0.35, relief: 0.6 }),
    soil: std({ texture: 'soil', color: '#9c6a43', roughness: 1, relief: 1.2 }),
    soilDark: std({ texture: 'soil', color: '#7a5133', roughness: 1, relief: 1.2 }),
    cloth: std({ texture: 'cloth', color: '#f3ead6', roughness: 0.95, relief: 0.4, side: THREE.DoubleSide }),
    leaf: std({ texture: 'leafy', color: '#ffffff', roughness: 0.85, relief: 1.1 }),
    metal: std({ color: '#9aa3a9', roughness: 0.35, metalness: 0.75 }),
    iron: std({ color: '#45403c', roughness: 0.5, metalness: 0.6 }),
    gold: std({ color: '#e8b84a', roughness: 0.28, metalness: 0.85 }),
    copper: std({ color: '#5f9c95', roughness: 0.45, metalness: 0.5 }),
    rope: std({ color: '#d9c597', roughness: 1 }),
    window: std({ color: '#ffd98a', emissive: '#ffbf5a', emissiveIntensity: 0.9, roughness: 0.25 }),
    windowDim: std({ color: '#c9d9e0', emissive: '#ffbf5a', emissiveIntensity: 0.12, roughness: 0.15, metalness: 0.1 }),
    lamp: std({ color: '#fff1c4', emissive: '#ffc766', emissiveIntensity: 1.6, roughness: 0.4 }),
    white: std({ color: '#f8f4ec', roughness: 0.8 }),
  };
}

export type Mats = ReturnType<typeof build>;
let shared: Mats | null = null;

/** Die gemeinsamen Materialien (werden beim ersten Aufruf angelegt). */
export function mats(): Mats {
  shared ??= build();
  return shared;
}

// ---------- Grundformen mit UVs in Metern ----------

const geoCache = new Map<string, THREE.BufferGeometry>();
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

/** Quader mit leicht gerundeten Kanten. UVs in Metern. */
export function box(w: number, h: number, d: number, radius = 0.03) {
  return cached(`box|${r3(w)}|${r3(h)}|${r3(d)}|${r3(radius)}`, () => {
    const rad = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
    const g = rad > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, rad) : new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const perFace = uv.count / 6;
    // Reihenfolge der Seiten: +x, -x, +y, -y, +z, -z
    const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < uv.count; i++) {
      const [su, sv] = dims[Math.min(5, Math.floor(i / perFace))];
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    return g;
  });
}

/** Zylinder bzw. Kegelstumpf. UVs in Metern (u rundherum, v nach oben). */
export function cyl(rTop: number, rBottom: number, h: number, segments = 24, open = false) {
  return cached(`cyl|${r3(rTop)}|${r3(rBottom)}|${r3(h)}|${segments}|${open}`, () => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const torso = (segments + 1) * 2;
    const circ = Math.PI * (rTop + rBottom);
    for (let i = 0; i < uv.count; i++) {
      if (i < torso) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
      else uv.setXY(i, uv.getX(i) * Math.max(rTop, rBottom) * 2, uv.getY(i) * Math.max(rTop, rBottom) * 2);
    }
    return g;
  });
}

/**
 * Dachfläche: flacher Quader, dessen Oberseite so gemappt ist, dass die Ziegelreihen
 * parallel zum First laufen. flip=true für die linke Dachseite.
 */
export function roofSlab(length: number, thickness: number, depth: number, flip: boolean) {
  return cached(`roof|${r3(length)}|${r3(thickness)}|${r3(depth)}|${flip}`, () => {
    const g = new THREE.BoxGeometry(length, thickness, depth);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const x = pos.getX(i);
      uv.setXY(i, pos.getZ(i), (flip ? x : -x) + length / 2);
    }
    return g;
  });
}

/** Kugel bzw. Halbkugel mit genug Segmenten für glatte Rundungen. */
export function sphere(r: number, wSeg = 32, hSeg = 20, thetaLength = Math.PI) {
  return cached(`sph|${r3(r)}|${wSeg}|${hSeg}|${r3(thetaLength)}`, () => {
    const g = new THREE.SphereGeometry(r, wSeg, hSeg, 0, Math.PI * 2, 0, thetaLength);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * Math.PI * r);
    return g;
  });
}
