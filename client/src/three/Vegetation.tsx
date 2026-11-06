// Pflanzen und Steine auf dem Berg. Alles als InstancedMesh (wenige Draw-Calls),
// Bäume und Gras wiegen sich im Wind.

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QUALITY, worldTime } from './clock';
import { isFree } from './decor';
import { fbm2, groundAt, heightAt, mulberry32, PEAKS, type Vec2 } from './layout';
import { cyl, mats } from './materials';
import { tex } from './textures';

// ---------- Wind ----------

/** Fügt einem Material Windbewegung hinzu (nur für InstancedMesh). strength wächst mit der Höhe². */
function withWind(m: THREE.MeshStandardMaterial, strength: number, key: string) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float sway = sin(uTime * 1.2 + ip.x * 0.6 + ip.z * 0.4) * 0.6 + sin(uTime * 2.3 + ip.x * 1.7 - ip.z) * 0.3;
  float hh = max(0.0, position.y);
  transformed.x += sway * ${strength.toFixed(4)} * hh * hh;
  transformed.z += sway * ${(strength * 0.6).toFixed(4)} * hh * hh;
#endif`,
      );
  };
  m.customProgramCacheKey = () => `wind-${key}`;
  return m;
}

// ---------- Geometrien ----------

function displace(g: THREE.BufferGeometry, amount: number, freq: number, seed: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm2(v.x * freq + seed, v.z * freq + v.y * freq * 0.7, 3) - 0.5;
    v.addScaledVector(v.clone().normalize(), n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function paintGradient(g: THREE.BufferGeometry, bottom: string, top: string, minY: number, maxY: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const a = new THREE.Color(bottom);
  const b = new THREE.Color(top);
  const c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, THREE.MathUtils.clamp((pos.getY(i) - minY) / (maxY - minY), 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Verschweißt Nähte, damit die Normalen glatt werden (keine Facetten). */
function welded(g: THREE.BufferGeometry) {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  return mergeVertices(g, 1e-4);
}

/** Einfache UVs aus der Position (für kleinteilige Reliefmuster völlig ausreichend). */
function planarUv(g: THREE.BufferGeometry, s: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + pos.getZ(i) * 0.7) * s;
    uv[i * 2 + 1] = (pos.getY(i) + pos.getZ(i) * 0.3) * s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Tanne: vier gestapelte, leicht unregelmäßige Kegel. Fuß bei y = 0, Höhe etwa 3,4. */
function pineGeometry() {
  const layers = [
    { r: 1.05, h: 1.5, y: 1.05 },
    { r: 0.85, h: 1.3, y: 1.65 },
    { r: 0.62, h: 1.1, y: 2.2 },
    { r: 0.38, h: 0.85, y: 2.75 },
  ];
  const parts = layers.map((l, i) => {
    const g = welded(new THREE.ConeGeometry(l.r, l.h, 9, 2));
    g.translate(0, l.y, 0);
    displace(g, 0.18, 2.2, i * 3.1);
    return planarUv(g, 1.1);
  });
  const merged = mergeGeometries(parts)!;
  return paintGradient(merged, '#2f7f3c', '#6fb94a', 0.4, 3.2);
}

/** Laubbaum-Krone: mehrere verschmolzene, buckelige Kugeln. Mittelpunkt bei y = 0. */
function crownGeometry() {
  const blobs = [
    { p: [0, 0, 0], r: 0.95 },
    { p: [0.55, 0.25, 0.2], r: 0.7 },
    { p: [-0.5, 0.2, -0.25], r: 0.72 },
    { p: [0.05, 0.65, -0.1], r: 0.66 },
    { p: [-0.1, 0.15, 0.6], r: 0.6 },
  ];
  const parts = blobs.map((b, i) => {
    const g = welded(new THREE.IcosahedronGeometry(b.r, 1));
    g.translate(b.p[0], b.p[1], b.p[2]);
    displace(g, 0.22, 2.6, i * 5.3);
    return planarUv(g, 1.2);
  });
  const merged = mergeGeometries(parts)!;
  return paintGradient(merged, '#3d9533', '#8fcd4c', -0.8, 1.2);
}

/** Grasbüschel aus sieben gebogenen Halmen. Fuß bei y = 0, Höhe 1. */
function tuftGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const base = new THREE.Color('#6cb23e');
  const tip = new THREE.Color('#a2d460');
  const rng = mulberry32(77);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng();
    const lean = 0.15 + rng() * 0.3;
    const h = 0.65 + rng() * 0.35;
    const w = 0.045;
    const ox = Math.cos(a) * 0.08;
    const oz = Math.sin(a) * 0.08;
    const tx = ox + Math.cos(a) * lean;
    const tz = oz + Math.sin(a) * lean;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    positions.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, h, tz);
    colors.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  // Normalen nach oben biegen, damit die Halme wie eine Wiese beleuchtet werden
  const n = g.attributes.normal as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.set(n.getX(i) * 0.3, 1, n.getZ(i) * 0.3).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
  return g;
}

function boulderGeometry() {
  const g = welded(new THREE.IcosahedronGeometry(1, 3));
  displace(g, 0.45, 1.3, 4.2);
  g.scale(1, 0.7, 1);
  g.computeVertexNormals();
  return planarUv(g, 0.8);
}

// ---------- Platzierung ----------

interface Item {
  x: number;
  y: number;
  z: number;
  s: number;
  rot: number;
  color: THREE.Color;
}

function slopeAt(x: number, z: number) {
  const e = 0.35;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return new THREE.Vector3(-dx, 2 * e, -dz).normalize().y;
}

class SpacingGrid {
  private cells = new Map<string, Vec2[]>();
  constructor(private size: number) {}
  private key(x: number, z: number) {
    return `${Math.floor(x / this.size)}|${Math.floor(z / this.size)}`;
  }
  fits(p: Vec2, gap: number) {
    const cx = Math.floor(p[0] / this.size);
    const cz = Math.floor(p[1] / this.size);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const q of this.cells.get(`${cx + i}|${cz + j}`) ?? []) {
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) < gap) return false;
        }
      }
    }
    return true;
  }
  add(p: Vec2) {
    const k = this.key(p[0], p[1]);
    const list = this.cells.get(k) ?? [];
    list.push(p);
    this.cells.set(k, list);
  }
}

const EXTENT = 30;

function scatterTrees() {
  const rng = mulberry32(42);
  const grid = new SpacingGrid(2);
  const pines: Item[] = [];
  const leafy: Item[] = [];
  const forest = PEAKS.forest;
  const pineTint = ['#ffffff', '#f2f8ee', '#eaf3e4', '#f8fbf4'];
  const leafTint = ['#ffffff', '#f6fbea', '#eef6e0', '#fbf8e8', '#eaf4dc'];

  const attempt = (x: number, z: number, dense: boolean) => {
    const g = groundAt(x, z);
    if (g.h < 1.2) return;
    const up = slopeAt(x, z);
    if (up < 0.55) return;
    const p: Vec2 = [x, z];
    if (!isFree(p, 0.5)) return;
    const gap = dense ? 1.15 : 1.6 + (1 - up) * 1.5;
    if (!grid.fits(p, gap)) return;
    grid.add(p);
    const pine = dense ? rng() < 0.7 : g.flat < 0.4 ? rng() < 0.55 : rng() < 0.2;
    const s = (pine ? 0.62 + rng() * 0.55 : 0.75 + rng() * 0.5) * (g.flat < 0.3 ? 0.9 : 1);
    const item: Item = {
      x, y: g.h - 0.05, z, s, rot: rng() * Math.PI * 2,
      color: new THREE.Color((pine ? pineTint : leafTint)[Math.floor(rng() * 4)]),
    };
    (pine ? pines : leafy).push(item);
  };

  // dichter Wald auf dem Waldgipfel und seinen Hängen
  for (let i = 0; i < 900; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * (forest.r + 7);
    attempt(forest.pos[0] + Math.cos(a) * r, forest.pos[1] + Math.sin(a) * r, true);
  }
  // locker verteilt über das ganze Massiv
  for (let i = 0; i < 5200; i++) {
    attempt((rng() * 2 - 1) * EXTENT, (rng() * 2 - 1) * EXTENT, false);
  }
  return { pines, leafy };
}

function useInstances(ref: RefObject<THREE.InstancedMesh | null>, items: Item[], yScale = 1) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * yScale, it.s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, it.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, items, yScale]);
}

// ---------- Komponenten ----------

export function Trees() {
  const { pines, leafy } = useMemo(scatterTrees, []);
  return <TreeInstances pines={pines} leafy={leafy} />;
}

export type PlantItem = Item;

/** Zeichnet Tannen und Laubbäume an vorgegebenen Stellen (auch für das Tal). */
export function TreeInstances({ pines, leafy }: { pines: Item[]; leafy: Item[] }) {
  const pineGeo = useMemo(pineGeometry, []);
  const crownGeo = useMemo(crownGeometry, []);
  const leafMat = useMemo(() => {
    const t = tex('leafy');
    return withWind(new THREE.MeshStandardMaterial({ vertexColors: true, map: t.map, flatShading: true, roughness: 0.95 }), 0.006, 'leaf');
  }, []);
  const m = mats();

  const pineRef = useRef<THREE.InstancedMesh>(null);
  const pineTrunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  useInstances(pineRef, pines);
  useInstances(pineTrunkRef, pines);
  useInstances(crownRef, useMemo(() => leafy.map((t) => ({ ...t, y: t.y + 1.75 * t.s })), [leafy]));
  useInstances(trunkRef, leafy);

  const pineTrunk = useMemo(() => cyl(0.1, 0.16, 1.1, 10).clone().translate(0, 0.55, 0), []);
  const leafTrunk = useMemo(() => {
    const g = cyl(0.11, 0.19, 1.6, 12).clone().translate(0, 0.8, 0);
    return g;
  }, []);

  return (
    <group>
      <instancedMesh ref={pineRef} args={[pineGeo, leafMat, pines.length]} castShadow receiveShadow />
      <instancedMesh ref={pineTrunkRef} args={[pineTrunk, m.log, pines.length]} castShadow />
      <instancedMesh ref={crownRef} args={[crownGeo, leafMat, leafy.length]} castShadow receiveShadow />
      <instancedMesh ref={trunkRef} args={[leafTrunk, m.log, leafy.length]} castShadow />
    </group>
  );
}

export interface MeadowSpot {
  x: number;
  z: number;
  y: number;
  /** 0…1: wie üppig es hier wächst */
  density: number;
}

/** Wiese auf dem Berg: Gras nur auf flachen, freien Stellen über den Wolken. */
function mountainSpot(x: number, z: number): MeadowSpot | null {
  const g = groundAt(x, z);
  if (g.h < 1.4) return null;
  if (slopeAt(x, z) < 0.82) return null;
  if (!isFree([x, z], 0.05)) return null;
  return { x, z, y: g.h, density: 0.6 + g.flat * 0.4 };
}

export function Meadow({ spot = mountainSpot, extent = EXTENT, seed = 8 }: {
  spot?: (x: number, z: number) => MeadowSpot | null;
  extent?: number;
  seed?: number;
}) {
  const items = useMemo(() => {
    const rng = mulberry32(seed);
    const target = QUALITY === 'high' ? 700 : 350;
    const grass: Item[] = [];
    const flowers: Item[] = [];
    const bushes: Item[] = [];
    const grassTint = ['#ffffff', '#f4f9ea', '#eef6e0'];
    const flowerTint = ['#f2f0ea', '#f5d250', '#ee8aa4'];
    for (let i = 0; i < target * 4 && grass.length < target; i++) {
      const x = (rng() * 2 - 1) * extent;
      const z = (rng() * 2 - 1) * extent;
      const s = spot(x, z);
      if (!s) continue;
      // Flecken statt Gleichverteilung
      const patch = fbm2(x * 0.3, z * 0.3, 2);
      if (patch < 0.48 - s.density * 0.1) continue;
      const g = { h: s.y };
      grass.push({
        x, y: g.h - 0.02, z, s: 0.22 + rng() * 0.22, rot: rng() * Math.PI * 2,
        color: new THREE.Color(grassTint[Math.floor(rng() * grassTint.length)]),
      });
      if (rng() < 0.05) {
        flowers.push({
          x: x + 0.15, y: g.h + 0.12, z: z - 0.1, s: 0.6 + rng() * 0.5, rot: 0,
          color: new THREE.Color(flowerTint[Math.floor(rng() * flowerTint.length)]),
        });
      }
      if (rng() < 0.012) {
        bushes.push({ x, y: g.h + 0.15, z, s: 0.35 + rng() * 0.25, rot: rng() * 6, color: new THREE.Color('#ffffff') });
      }
    }
    return { grass, flowers, bushes };
  }, [spot, extent, seed]);

  const tuft = useMemo(tuftGeometry, []);
  const grassMat = useMemo(
    () => withWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 0.14, 'grass'),
    [],
  );
  const crownGeo = useMemo(crownGeometry, []);
  const leafMat = useMemo(() => {
    const t = tex('leafy');
    return new THREE.MeshStandardMaterial({ vertexColors: true, map: t.map, flatShading: true, roughness: 0.95 });
  }, []);

  const grassRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  useInstances(grassRef, items.grass);
  useInstances(flowerRef, items.flowers, 0.7);
  useInstances(bushRef, items.bushes, 0.75);

  return (
    <group>
      <instancedMesh ref={grassRef} args={[tuft, grassMat, items.grass.length]} receiveShadow />
      <instancedMesh ref={flowerRef} args={[undefined, undefined, items.flowers.length]}>
        <icosahedronGeometry args={[0.07, 1]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={bushRef} args={[crownGeo, leafMat, items.bushes.length]} castShadow receiveShadow />
    </group>
  );
}

export function Boulders() {
  const items = useMemo(() => {
    const rng = mulberry32(99);
    const grid = new SpacingGrid(2);
    const out: Item[] = [];
    const tints = ['#ffffff', '#e8e0d4', '#d6cfc4', '#f0e6d6'];
    for (let i = 0; i < 6000 && out.length < 220; i++) {
      const x = (rng() * 2 - 1) * EXTENT;
      const z = (rng() * 2 - 1) * EXTENT;
      const g = groundAt(x, z);
      if (g.h < 0.8) continue;
      const up = slopeAt(x, z);
      // gern am Fuß von Felswänden und am Plateaurand
      if (up > 0.95 && g.flat > 0.8 && rng() > 0.15) continue;
      if (!isFree([x, z], 0.3)) continue;
      if (!grid.fits([x, z], 1.2)) continue;
      grid.add([x, z]);
      const s = 0.2 + rng() * (g.flat > 0.5 ? 0.35 : 0.7);
      out.push({ x, y: g.h + s * 0.15, z, s, rot: rng() * 6, color: new THREE.Color(tints[Math.floor(rng() * tints.length)]) });
    }
    return out;
  }, []);
  const geo = useMemo(boulderGeometry, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances(ref, items);
  return <instancedMesh ref={ref} args={[geo, mats().rock, items.length]} castShadow receiveShadow />;
}
