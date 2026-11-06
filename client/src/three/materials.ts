// Gemeinsame Materialien und Grundformen für alle Modelle.
//
// Materialien werden nur einmal angelegt und überall geteilt (spart Shader und Speicher).
// Die Grundformen haben UV-Koordinaten in Metern; die Texturen wissen, wie groß eine
// Kachel in der Welt ist. So sieht ein Brett auf einer kleinen Kiste genauso groß aus
// wie auf einer Scheunenwand.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import './stylize';
import { tex, type TextureKind } from './textures';

type MatOptions = Omit<THREE.MeshStandardMaterialParameters, 'normalScale'> & { texture?: TextureKind; relief?: number };

/** Flächiger Low-Poly-Look: reine Farben, sichtbare Facetten, keine Muster. */
const FLAT = true;

function std({ texture, relief = 1, ...params }: MatOptions) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: FLAT, ...params });
  if (texture && !FLAT) {
    const t = tex(texture);
    m.map = t.map;
    m.normalMap = t.normal;
    m.normalScale = new THREE.Vector2(relief, relief);
  }
  return m;
}

function build() {
  // Klare, matte Flächenfarben mit ruhiger Sättigung (Texturen sind im flachen Look aus).
  return {
    plaster: std({ texture: 'plaster', color: '#f7ecd8', roughness: 0.9 }),
    plasterWarm: std({ texture: 'plaster', color: '#f2dcb2', roughness: 0.9 }),
    plasterRose: std({ texture: 'plaster', color: '#f0cbb6', roughness: 0.9 }),
    timber: std({ texture: 'grain', color: '#7d4f2e', roughness: 0.85 }),
    wood: std({ texture: 'planks', color: '#c98b55', roughness: 0.85 }),
    woodLight: std({ texture: 'planks', color: '#e0ad76', roughness: 0.85 }),
    woodDark: std({ texture: 'planks', color: '#9b663e', roughness: 0.85 }),
    woodGreen: std({ texture: 'planks', color: '#62ad4c', roughness: 0.8 }),
    woodBlue: std({ texture: 'planks', color: '#4f8bd6', roughness: 0.8 }),
    woodRed: std({ texture: 'planks', color: '#d65c43', roughness: 0.8 }),
    beam: std({ texture: 'grain', color: '#cf9a63', roughness: 0.85 }),
    log: std({ texture: 'bark', color: '#8e5f3c', roughness: 0.9 }),
    logEnd: std({ texture: 'grain', color: '#ecc790', roughness: 0.9 }),
    stone: std({ texture: 'stoneWall', color: '#d2cec6', roughness: 0.9 }),
    stoneDark: std({ texture: 'stoneWall', color: '#aca8a0', roughness: 0.9 }),
    rock: std({ texture: 'rockDetail', color: '#a9b0b9', roughness: 0.9 }),
    cobble: std({ texture: 'cobble', color: '#e0d6c2', roughness: 0.9 }),
    roofRed: std({ texture: 'shingles', color: '#d95b3e', roughness: 0.75 }),
    roofDark: std({ texture: 'shingles', color: '#bf4b34', roughness: 0.75 }),
    roofSlate: std({ texture: 'shingles', color: '#4580d6', roughness: 0.7 }),
    roofMoss: std({ texture: 'shingles', color: '#6cb24a', roughness: 0.75 }),
    thatch: std({ texture: 'thatch', color: '#efc251', roughness: 0.9 }),
    brick: std({ texture: 'bricks', color: '#c8664a', roughness: 0.9 }),
    clay: std({ texture: 'plaster', color: '#d27f52', roughness: 0.85 }),
    clayWet: std({ texture: 'plaster', color: '#a8603f', roughness: 0.35 }),
    soil: std({ texture: 'soil', color: '#a87550', roughness: 0.95 }),
    soilDark: std({ texture: 'soil', color: '#8b5e40', roughness: 0.95 }),
    cloth: std({ texture: 'cloth', color: '#f8f0e0', roughness: 0.9, side: THREE.DoubleSide }),
    leaf: std({ texture: 'leafy', color: '#7cbf45', roughness: 0.95 }),
    metal: std({ color: '#aeb8bf', roughness: 0.4, metalness: 0.6 }),
    iron: std({ color: '#5e5955', roughness: 0.5, metalness: 0.45 }),
    gold: std({ color: '#f0c046', roughness: 0.3, metalness: 0.75 }),
    copper: std({ color: '#5bbfac', roughness: 0.45, metalness: 0.3 }),
    rope: std({ color: '#e2cc98', roughness: 0.95 }),
    window: std({ color: '#ffe29a', emissive: '#ffc45a', emissiveIntensity: 0.8, roughness: 0.3 }),
    windowDim: std({ color: '#cfe2ee', emissive: '#ffc45a', emissiveIntensity: 0.1, roughness: 0.2, metalness: 0.05 }),
    lamp: std({ color: '#fff3c8', emissive: '#ffc85a', emissiveIntensity: 1.5, roughness: 0.4 }),
    white: std({ color: '#fbf8f2', roughness: 0.85 }),
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
