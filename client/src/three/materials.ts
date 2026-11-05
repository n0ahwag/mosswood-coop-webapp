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
    plaster: std({ texture: 'plaster', color: '#f8efdc', roughness: 0.92, relief: 0.4 }),
    plasterWarm: std({ texture: 'plaster', color: '#f6e2bb', roughness: 0.92, relief: 0.4 }),
    plasterRose: std({ texture: 'plaster', color: '#f5cfbd', roughness: 0.92, relief: 0.4 }),
    timber: std({ texture: 'grain', color: '#7e4f2c', roughness: 0.82, relief: 0.5 }),
    wood: std({ texture: 'planks', color: '#c4854b', roughness: 0.82, relief: 0.65 }),
    woodLight: std({ texture: 'planks', color: '#e0ab70', roughness: 0.82, relief: 0.65 }),
    woodDark: std({ texture: 'planks', color: '#945c35', roughness: 0.82, relief: 0.65 }),
    woodGreen: std({ texture: 'planks', color: '#5ea86f', roughness: 0.78, relief: 0.6 }),
    woodBlue: std({ texture: 'planks', color: '#5d9ccc', roughness: 0.78, relief: 0.6 }),
    woodRed: std({ texture: 'planks', color: '#d65e42', roughness: 0.78, relief: 0.6 }),
    beam: std({ texture: 'grain', color: '#cf9a5e', roughness: 0.82, relief: 0.5 }),
    log: std({ texture: 'bark', color: '#8d603c', roughness: 0.92, relief: 1 }),
    logEnd: std({ texture: 'grain', color: '#eac288', roughness: 0.88, relief: 0.25 }),
    stone: std({ texture: 'stoneWall', color: '#d9ccb6', roughness: 0.92, relief: 0.9 }),
    stoneDark: std({ texture: 'stoneWall', color: '#b3a691', roughness: 0.92, relief: 0.9 }),
    rock: std({ texture: 'rockDetail', color: '#c8b79b', roughness: 0.92, relief: 1 }),
    cobble: std({ texture: 'cobble', color: '#dcc79d', roughness: 0.92, relief: 0.85 }),
    roofRed: std({ texture: 'shingles', color: '#e06a3c', roughness: 0.7, relief: 0.95 }),
    roofDark: std({ texture: 'shingles', color: '#c25536', roughness: 0.7, relief: 0.95 }),
    roofSlate: std({ texture: 'shingles', color: '#5788b8', roughness: 0.6, relief: 0.95 }),
    roofMoss: std({ texture: 'shingles', color: '#7fae52', roughness: 0.75, relief: 0.95 }),
    thatch: std({ texture: 'thatch', color: '#e9bf62', roughness: 0.97, relief: 1.1 }),
    brick: std({ texture: 'bricks', color: '#ffffff', roughness: 0.9, relief: 1 }),
    clay: std({ texture: 'plaster', color: '#cc7f50', roughness: 0.88, relief: 0.6 }),
    clayWet: std({ texture: 'plaster', color: '#a25d38', roughness: 0.32, relief: 0.5 }),
    soil: std({ texture: 'soil', color: '#b17a4c', roughness: 0.97, relief: 1 }),
    soilDark: std({ texture: 'soil', color: '#91623f', roughness: 0.97, relief: 1 }),
    cloth: std({ texture: 'cloth', color: '#f3ead6', roughness: 0.95, relief: 0.4, side: THREE.DoubleSide }),
    leaf: std({ texture: 'leafy', color: '#ffffff', roughness: 0.8, relief: 0.7 }),
    metal: std({ color: '#9aa3a9', roughness: 0.35, metalness: 0.75 }),
    iron: std({ color: '#57504b', roughness: 0.48, metalness: 0.55 }),
    gold: std({ color: '#e8b84a', roughness: 0.28, metalness: 0.85 }),
    copper: std({ color: '#56b5a5', roughness: 0.42, metalness: 0.4 }),
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
