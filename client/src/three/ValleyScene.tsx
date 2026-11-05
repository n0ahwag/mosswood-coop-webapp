// Das gemeinsame Tal in 3D: ein grünes Becken zwischen Hügeln, durch das der Silberbach
// in den Hafensee fließt. Monumente wachsen mit dem Fortschritt, am Hafen legt das
// Handelsschiff an, rundherum liegen die Höfe der Nachbarn.

import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import type { TradeShip, ValleyMember, ValleyProject } from '../lib/types';
import { clothMat } from './Buildings';
import { QUALITY, WorldClock, worldTime } from './clock';
import { Cottage, Fence } from './House';
import { HtmlPortalContext, useHtmlPortal, useHudOffset } from './htmlPortal';
import { Beacon, TrainStation } from './Landmarks';
import { distToSegment, fbm2, hashString, mulberry32, type Vec2 } from './layout';
import { box, cyl, mats, sphere } from './materials';
import { GroundShadow, Lantern, makeTerrainMaterial } from './Mountain';
import { C } from './palette';
import { DistantMountains, Lights, SKY, SkyDome } from './Sky';
import { tex } from './textures';
import { Meadow, TreeInstances, type MeadowSpot, type PlantItem } from './Vegetation';

const RIVER: Vec2[] = [[-28, -13], [-21, -10], [-12, -6], [-4, -2.5], [3, 3], [6, 10], [6, 15.5]];
export const SPOTS = {
  mossBridge: [-4, -2.5] as Vec2,
  greatLibrary: [-10, 6] as Vec2,
  lanternFestival: [10, -3] as Vec2,
  harbor: [6, 18] as Vec2,
  station: [0, -18.5] as Vec2,
};
const HARBOR_R = 4.6;
const FARM_ANGLES = [-130, -60, -25, 10, 40, 110, 150, 180].map((d) => (d * Math.PI) / 180);
const farmPos = (i: number): Vec2 => [Math.cos(FARM_ANGLES[i % 8]) * 17, Math.sin(FARM_ANGLES[i % 8]) * 17];
const projectSpot = (key: string): Vec2 => (SPOTS as Record<string, Vec2>)[key] ?? [0, 0];

const FLAT_SPOTS: [Vec2, number][] = [
  [[0, 0], 3.4],
  [SPOTS.mossBridge, 3.2], [SPOTS.greatLibrary, 4.2], [SPOTS.lanternFestival, 4.2], [SPOTS.station, 4],
  ...Array.from({ length: 8 }, (_, i) => [farmPos(i), 2.8] as [Vec2, number]),
];
const MAIN_PATHS: [Vec2, Vec2][] = [SPOTS.mossBridge, SPOTS.greatLibrary, SPOTS.lanternFestival, SPOTS.harbor, SPOTS.station].map((e) => [[0, 0], e] as [Vec2, Vec2]);
const farmPaths = (n: number): [Vec2, Vec2][] => Array.from({ length: Math.min(8, n) }, (_, i) => [[0, 0], farmPos(i)] as [Vec2, Vec2]);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function distToRiver(p: Vec2) {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) best = Math.min(best, distToSegment(p, RIVER[i], RIVER[i + 1]));
  return best;
}
const distTo = (paths: [Vec2, Vec2][], p: Vec2) => paths.reduce((m, [a, b]) => Math.min(m, distToSegment(p, a, b)), Infinity);
const distToPaths = (p: Vec2) => distTo(MAIN_PATHS, p);

/** Höhe des Talbodens: flach in der Mitte, Hügel am Rand, Bachbett und Hafensee eingetieft. */
function valleyHeight(x: number, z: number) {
  const d = Math.hypot(x, z);
  let flat = 0;
  for (const [p, r] of FLAT_SPOTS) flat = Math.max(flat, 1 - smoothstep(r, r + 2.5, Math.hypot(x - p[0], z - p[1])));
  let h = (fbm2(x * 0.09, z * 0.09, 3) - 0.5) * 0.9 * (1 - flat);
  h += smoothstep(21, 40, d) * (6 + fbm2(x * 0.05 + 3, z * 0.05, 3) * 10);
  const river = distToRiver([x, z]);
  h -= 0.55 * (1 - smoothstep(0.9, 1.9, river));
  const harbor = Math.hypot(x - SPOTS.harbor[0], z - SPOTS.harbor[1]);
  h -= 0.7 * (1 - smoothstep(HARBOR_R - 0.6, HARBOR_R + 1.2, harbor));
  return h;
}

function valleyGeometry(size: number, seg: number, farms: number) {
  const farmLanes = farmPaths(farms);
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, valleyHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const n = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#84c24e');
  const grassB = new THREE.Color('#b6e062');
  const meadow = new THREE.Color('#d8e27a');
  const rock = new THREE.Color('#dcc6a4');
  const sand = new THREE.Color('#f3deac');
  const path = new THREE.Color('#f4deae');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    c.copy(grassA).lerp(grassB, fbm2(x * 0.1, z * 0.1, 3) * 1.2).lerp(meadow, Math.max(0, fbm2(x * 0.3, z * 0.3, 2) - 0.6));
    c.lerp(rock, 1 - smoothstep(0.65, 0.85, n.getY(i)));
    const shore = Math.min(distToRiver([x, z]), Math.hypot(x - SPOTS.harbor[0], z - SPOTS.harbor[1]) - HARBOR_R + 1.2);
    c.lerp(sand, (1 - smoothstep(1.2, 2.2, shore)) * 0.8);
    const main = 1 - smoothstep(0.35, 0.7, distToPaths([x, z]));
    const lane = (1 - smoothstep(0.2, 0.5, distTo(farmLanes, [x, z]))) * 0.7;
    const p = Math.max(main, lane);
    if (p > 0 && y > -0.2) c.lerp(path, p * 0.85);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function Ground({ farms }: { farms: number }) {
  const inner = useMemo(() => valleyGeometry(84, QUALITY === 'high' ? 300 : 210, farms), [farms]);
  const mat = useMemo(() => makeTerrainMaterial(false), []);
  return <mesh geometry={inner} material={mat} receiveShadow />;
}

function Water() {
  const mat = useMemo(() => {
    const n = tex('leafy').normal.clone();
    n.repeat.set(0.5, 0.5);
    n.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: '#4fb0c6', roughness: 0.05, metalness: 0.2, normalMap: n, normalScale: new THREE.Vector2(0.3, 0.3) });
  }, []);
  useFrame(() => {
    mat.normalMap?.offset.set(worldTime.value * 0.03, worldTime.value * 0.02);
  });
  const river = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = 120;
    const p: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = curve.getPointAt(i / n);
      const t = curve.getTangentAt(i / n);
      const w = 1.25;
      p.push(a.x - t.z * w, -0.22, a.z + t.x * w, a.x + t.z * w, -0.22, a.z - t.x * w);
      if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={river} material={mat} receiveShadow />
      <mesh position={[SPOTS.harbor[0], -0.22, SPOTS.harbor[1]]} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow>
        <circleGeometry args={[HARBOR_R + 0.8, 48]} />
      </mesh>
    </group>
  );
}

function useValleyPlants(farms: number) {
  return useMemo(() => {
    const rnd = mulberry32(4242);
    const pines: PlantItem[] = [];
    const leafy: PlantItem[] = [];
    const placed: Vec2[] = [];
    const blocked: [Vec2, number][] = [
      ...FLAT_SPOTS.slice(0, 5),
      [SPOTS.harbor, HARBOR_R + 1.5],
      ...Array.from({ length: Math.max(farms, 8) }, (_, i) => [farmPos(i), 3] as [Vec2, number]),
    ];
    for (let tries = 0; tries < 9000 && pines.length + leafy.length < 320; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 38;
      const p: Vec2 = [Math.cos(a) * r, Math.sin(a) * r];
      if (blocked.some(([b, br]) => Math.hypot(p[0] - b[0], p[1] - b[1]) < br)) continue;
      if (distToPaths(p) < 1.3 || distToRiver(p) < 2.2) continue;
      const outer = r > 21;
      const gap = outer ? 1.5 : 2.6;
      if (placed.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < gap)) continue;
      // in der Mitte nur einzelne Bäume, außen dichte Wälder auf den Hügeln
      if (!outer && rnd() < 0.55) continue;
      placed.push(p);
      const pine = outer ? rnd() < 0.7 : rnd() < 0.25;
      const item: PlantItem = {
        x: p[0], y: valleyHeight(p[0], p[1]) - 0.05, z: p[1],
        s: (pine ? 0.75 : 0.85) + rnd() * 0.55, rot: rnd() * 6,
        color: new THREE.Color(['#ffffff', '#eef6dc', '#e2efcc', '#fff4dc'][Math.floor(rnd() * 4)]),
      };
      (pine ? pines : leafy).push(item);
    }
    return { pines, leafy };
  }, [farms]);
}

function valleySpot(x: number, z: number): MeadowSpot | null {
  const d = Math.hypot(x, z);
  if (d > 36) return null;
  if (distToPaths([x, z]) < 0.7 || distToRiver([x, z]) < 1.8) return null;
  if (Math.hypot(x - SPOTS.harbor[0], z - SPOTS.harbor[1]) < HARBOR_R + 1.2) return null;
  for (const [p, r] of FLAT_SPOTS.slice(0, 5)) if (Math.hypot(x - p[0], z - p[1]) < r) return null;
  for (let i = 0; i < 8; i++) {
    const f = farmPos(i);
    if (Math.hypot(x - f[0], z - f[1]) < 2.4) return null;
  }
  return { x, z, y: valleyHeight(x, z), density: 0.8 };
}

function Clickable({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {children}
    </group>
  );
}

// ---------- Monumente ----------

function Scaffold({ w, d, h }: { w: number; d: number; h: number }) {
  const m = mats();
  const corners: Vec2[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={i} geometry={box(0.12, h, 0.12, 0.02)} material={m.beam} position={[x, h / 2, z]} castShadow />
      ))}
      {[0.35, 0.7].map((f) => (
        <group key={f}>
          <mesh geometry={box(w, 0.08, 0.1, 0.015)} material={m.woodLight} position={[0, h * f, -d / 2]} />
          <mesh geometry={box(w, 0.08, 0.1, 0.015)} material={m.woodLight} position={[0, h * f, d / 2]} />
          <mesh geometry={box(0.1, 0.08, d, 0.015)} material={m.woodLight} position={[-w / 2, h * f, 0]} />
        </group>
      ))}
    </group>
  );
}

function MossBridge({ p }: { p: number }) {
  const m = mats();
  const segs = 11;
  const built = Math.round(p * segs);
  return (
    <group rotation={[0, -0.55, 0]}>
      {[-2.5, 2.5].map((x) => (
        <mesh key={x} geometry={box(1.3, 1.0, 2.2, 0.08)} material={m.stone} position={[x, 0.3, 0]} castShadow receiveShadow />
      ))}
      {Array.from({ length: built }, (_, i) => {
        const t = (i + 0.5) / segs;
        const x = -2 + t * 4;
        const y = 0.55 + Math.sin(t * Math.PI) * 0.9;
        return (
          <mesh key={i} geometry={box(0.4, 0.3, 1.9, 0.05)} material={m.stone} position={[x, y, 0]} rotation={[0, 0, -Math.cos(t * Math.PI) * 0.6]} castShadow receiveShadow />
        );
      })}
      {p >= 1 && (
        <>
          {[-0.95, 0.95].map((z) => (
            <group key={z}>
              {Array.from({ length: 6 }, (_, i) => {
                const t = i / 5;
                return (
                  <mesh key={i} geometry={box(0.14, 0.5, 0.14, 0.03)} material={m.stoneDark} position={[-2 + t * 4, 0.9 + Math.sin(t * Math.PI) * 0.9, z]} />
                );
              })}
            </group>
          ))}
          {/* Moospolster */}
          {[-1.2, 0.4, 1.5].map((x, i) => (
            <mesh key={x} geometry={sphere(0.25, 16, 10)} position={[x, 0.78 + Math.sin(((x + 2) / 4) * Math.PI) * 0.9, (i - 1) * 0.5]} scale={[1.4, 0.4, 1]}>
              <meshStandardMaterial color="#6f9f3f" roughness={1} />
            </mesh>
          ))}
        </>
      )}
      {p < 1 && <Scaffold w={4.4} d={2.4} h={2.2} />}
    </group>
  );
}

function Library({ p }: { p: number }) {
  const m = mats();
  const h = 0.3 + p * 2.6;
  const done = p >= 1;
  const roofAngle = Math.atan2(1.6, 2.3);
  const roofLen = 2.8 / Math.cos(roofAngle);
  return (
    <group>
      <mesh geometry={box(5.6, 0.36, 4.4, 0.06)} material={m.stoneDark} position={[0, 0.18, 0]} receiveShadow castShadow />
      <mesh geometry={box(4.6, h, 3.4, 0.03)} material={m.plaster} position={[0, 0.36 + h / 2, 0]} castShadow receiveShadow />
      {[-1.8, -0.6, 0.6, 1.8].map((x) => (
        <mesh key={x} geometry={cyl(0.18, 0.21, h, 20)} material={m.stone} position={[x, 0.36 + h / 2, 1.9]} castShadow />
      ))}
      {done && (
        <>
          <mesh geometry={box(5.0, 0.2, 3.9, 0.04)} material={m.stone} position={[0, 3.36, 0]} castShadow />
          {[-1, 1].map((sx) => (
            <group key={sx} position={[0, 3.46 + 1.6, 0]} rotation={[0, 0, -sx * roofAngle]}>
              <mesh geometry={box(roofLen, 0.14, 4.1, 0.02)} material={m.roofSlate} position={[(sx * roofLen) / 2, 0.07, 0]} castShadow />
            </group>
          ))}
          {[-1.2, 0, 1.2].map((x) => (
            <mesh key={x} geometry={box(0.5, 0.85, 0.06, 0.02)} material={m.window} position={[x, 1.9, 1.72]} />
          ))}
          <mesh geometry={cyl(0.4, 0.4, 0.08, 24)} material={m.gold} position={[0, 4.1, 2.0]} rotation={[Math.PI / 2, 0, 0]} />
        </>
      )}
      {!done && <Scaffold w={5.2} d={4} h={h + 0.8} />}
      {!done && (
        <group position={[3.3, 0, 1.6]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={box(0.8, 0.2, 0.5, 0.03)} material={i % 2 ? m.brick : m.woodLight} position={[0, 0.12 + i * 0.22, 0]} castShadow />
          ))}
        </group>
      )}
    </group>
  );
}

function LanternFestival({ p }: { p: number }) {
  const m = mats();
  const lanterns = Math.round(p * 14);
  const tables = Math.min(3, Math.ceil(p * 3));
  const ref = useRef<THREE.Group>(null);
  const glow = useMemo(() => C.cloth.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: p >= 1 ? 1.1 : 0.4, roughness: 0.6 })), [p]);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((l, i) => {
      l.position.y = 2.3 + Math.sin(clock.elapsedTime * 1.5 + i) * 0.06;
    });
  });
  return (
    <group>
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} geometry={cyl(0.08, 0.1, 2.6, 14)} material={m.timber} position={[x, 1.3, 0]} castShadow />
      ))}
      <mesh geometry={cyl(0.012, 0.012, 6.4, 5)} material={m.rope} position={[0, 2.48, 0]} rotation={[0, 0, Math.PI / 2]} />
      <group ref={ref}>
        {Array.from({ length: lanterns }, (_, i) => (
          <mesh key={i} geometry={sphere(0.17, 16, 12)} material={glow[i % glow.length]} position={[-3 + (i / 13) * 6, 2.3, 0]} scale={[1, 1.25, 1]} />
        ))}
      </group>
      {Array.from({ length: tables }, (_, i) => (
        <group key={i} position={[0, 0, -1.4 + i * 1.4]}>
          <mesh geometry={box(3.6, 0.1, 0.72, 0.03)} material={m.woodLight} position={[0, 0.55, 0.6]} castShadow />
          <mesh geometry={box(3.4, 0.01, 0.4, 0)} material={clothMat(C.cloth[i % 4])} position={[0, 0.61, 0.6]} />
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} geometry={box(0.1, 0.55, 0.5, 0.02)} material={m.timber} position={[x, 0.27, 0.6]} />
          ))}
        </group>
      ))}
      {p >= 1 && <Lantern position={[0, 0, -2.4]} />}
      {p < 1 && <Scaffold w={1.2} d={1.2} h={1.6} />}
    </group>
  );
}

function Monument({
  project, selected, highlight, onSelect,
}: {
  project: ValleyProject;
  selected: boolean;
  highlight: boolean;
  onSelect: (key: string) => void;
}) {
  const portal = useHtmlPortal();
  const spot = projectSpot(project.key);
  const req = Object.entries(project.requirements);
  const total = req.reduce((s, [, n]) => s + n, 0);
  const cur = req.reduce((s, [r, n]) => s + Math.min(n, project.progress[r] ?? 0), 0);
  const p = project.status === 'COMPLETED' ? 1 : total ? cur / total : 0;
  const model = project.key === 'mossBridge' ? <MossBridge p={p} /> : project.key === 'greatLibrary' ? <Library p={p} /> : <LanternFestival p={p} />;

  return (
    <group position={[spot[0], 0, spot[1]]}>
      <GroundShadow radius={3.4} opacity={selected ? 0.38 : 0.26} />
      <mesh position={[0, 0.05, 0]} onClick={(e) => { e.stopPropagation(); onSelect(project.key); }} visible={false}>
        <cylinderGeometry args={[3.4, 3.4, 0.1, 24]} />
      </mesh>
      <Clickable onClick={() => onSelect(project.key)}>{model}</Clickable>
      <Html portal={portal} position={[0, 5, 0]} center distanceFactor={18} zIndexRange={[30, 0]}>
        <button className={`scene-label text-center ${selected || highlight ? 'is-selected' : ''}`} onClick={() => onSelect(project.key)}>
          <div className="whitespace-nowrap">{project.icon} {project.name}</div>
          <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-bark-900/15">
            <div className="h-full rounded-full bg-moss-400" style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <div className="mt-0.5 text-[11px] font-bold whitespace-nowrap text-bark-500">
            {p >= 1 ? '✓ Vollendet' : `${Math.round(p * 100)} % · Tippen zum Einzahlen`}
          </div>
        </button>
      </Html>
    </group>
  );
}

// ---------- Hafen und Schiff ----------

function Ship() {
  const m = mats();
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = -0.1 + Math.sin(clock.elapsedTime * 1.3) * 0.06;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.03;
  });
  const hull = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2, 0.75);
    s.quadraticCurveTo(0.4, 0.82, 2.5, 0.75);
    s.quadraticCurveTo(2.0, 0.1, 1.5, 0);
    s.lineTo(-1.5, 0);
    s.quadraticCurveTo(-1.9, 0.3, -2, 0.75);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 16 });
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + pos.getZ(i), pos.getY(i));
    return g;
  }, []);
  const sail = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.6, 2.0, 8, 8);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(((pos.getY(i) + 1) / 2) * Math.PI) * 0.25);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group ref={ref}>
      <mesh geometry={hull} material={m.woodDark} position={[0, 0, -0.75]} castShadow />
      <mesh geometry={box(4.0, 0.08, 1.45, 0.02)} material={m.woodLight} position={[0.25, 0.8, 0]} />
      <mesh geometry={cyl(0.07, 0.09, 2.9, 14)} material={m.timber} position={[0.1, 2.2, 0]} castShadow />
      <mesh geometry={sail} material={clothMat('#fbf3df')} position={[0.15, 2.3, 0]} rotation={[0, Math.PI / 2, 0]} castShadow />
      <mesh position={[0.1, 3.75, 0]} geometry={box(0.5, 0.26, 0.01, 0)} material={clothMat(C.cloth[0])} />
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} geometry={box(0.5, 0.42, 0.5, 0.04)} material={m.wood} position={[x, 1.05, 0]} castShadow />
      ))}
    </group>
  );
}

function Harbor({ ship, lockedHint, selected, highlight, onSelect }: {
  ship: TradeShip | null;
  lockedHint?: string;
  selected: boolean;
  highlight: boolean;
  onSelect: () => void;
}) {
  const m = mats();
  const portal = useHtmlPortal();
  const docked = ship?.status === 'DOCKED' && new Date(ship.departsAt).getTime() > Date.now();
  return (
    <group position={[SPOTS.harbor[0], 0, SPOTS.harbor[1]]}>
      {/* Steg mit Pfählen */}
      <mesh geometry={box(3.2, 0.14, 1.2, 0.03)} material={m.wood} position={[-3.4, 0.15, -1]} castShadow receiveShadow />
      {[-4.8, -3.4, -2.0].map((x) => [-1.5, -0.5].map((z) => (
        <mesh key={`${x}${z}`} geometry={cyl(0.09, 0.1, 0.9, 12)} material={m.log} position={[x, -0.15, z]} />
      )))}
      <Clickable onClick={onSelect}>
        {docked ? (
          <group position={[0, 0, 0.4]} rotation={[0, 0.4, 0]}>
            <Ship />
          </group>
        ) : (
          <group position={[-3.4, 0.22, -1]}>
            <mesh geometry={box(0.6, 0.6, 0.6, 0.05)} material={m.woodLight} position={[0, 0.3, 0]} castShadow />
            <mesh geometry={box(0.45, 0.45, 0.45, 0.04)} material={m.wood} position={[0.6, 0.23, 0.1]} castShadow />
          </group>
        )}
      </Clickable>
      <Html portal={portal} position={[0, 4.6, 0]} center distanceFactor={18} zIndexRange={[30, 0]}>
        <button className={`scene-label text-center ${selected || highlight ? 'is-selected' : ''}`} onClick={onSelect}>
          <div className="whitespace-nowrap">{lockedHint ? '🔒' : '⛵'} Hafen</div>
          <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">
            {lockedHint ?? (docked ? 'Schiff liegt an · Tippen zum Beladen' : 'Schiff ist unterwegs')}
          </div>
        </button>
      </Html>
    </group>
  );
}

// ---------- Höfe und Bahnhof ----------

function Farm({ member, index, isMe }: { member: ValleyMember; index: number; isMe: boolean }) {
  const m = mats();
  const portal = useHtmlPortal();
  const [x, z] = farmPos(index);
  const rot = Math.atan2(-x, -z);
  const h = hashString(member.id);
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <GroundShadow radius={1.6} />
      <Cottage occupied={member.online} resting={false} variant={h % 5} />
      <mesh geometry={box(1.3, 0.12, 1.4, 0.04)} material={m.soil} position={[1.55, 0.06, 0.6]} receiveShadow />
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i} geometry={sphere(0.14, 12, 8)} position={[1.15 + (i % 2) * 0.8, 0.2, 0.25 + Math.floor(i / 2) * 0.7]}>
          <meshStandardMaterial color={C.leaf[(h + i) % C.leaf.length]} roughness={0.9} />
        </mesh>
      ))}
      <Fence from={[-1.4, 1.3]} to={[0.6, 1.3]} posts={3} />
      <Html portal={portal} position={[0, 2.8, 0]} center distanceFactor={18} zIndexRange={[20, 0]}>
        <div className={`scene-label pointer-events-none text-center ${isMe ? 'is-selected' : 'opacity-90'}`}>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className={`size-2 rounded-full ${member.online ? 'bg-moss-500' : 'bg-bark-900/25'}`} />
            {member.displayName}{isMe ? ' (du)' : ''}
          </div>
        </div>
      </Html>
    </group>
  );
}

function Station({ highlight, onClick }: { highlight: boolean; onClick: () => void }) {
  const portal = useHtmlPortal();
  const [departing, setDeparting] = useState(0);
  const go = () => {
    setDeparting(Date.now());
    onClick();
  };
  return (
    <group position={[SPOTS.station[0], 0, SPOTS.station[1]]}>
      <GroundShadow radius={3.2} />
      <Clickable onClick={go}>
        <TrainStation departing={departing} />
      </Clickable>
      <Html portal={portal} position={[0, 3.8, 0]} center distanceFactor={18} zIndexRange={[30, 0]}>
        <button className={`scene-label text-center ${highlight ? 'is-selected' : ''}`} onClick={go}>
          <div className="whitespace-nowrap">🚂 Bahnhof</div>
          <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">Zurück zum Hof</div>
        </button>
      </Html>
    </group>
  );
}

function Plaza() {
  const m = mats();
  return (
    <group>
      <mesh geometry={cyl(2.8, 2.9, 0.12, 48)} material={m.cobble} position={[0, 0.02, 0]} receiveShadow />
      <mesh geometry={cyl(0.7, 0.8, 0.5, 28)} material={m.stone} position={[0, 0.3, 0]} castShadow />
      <mesh geometry={sphere(0.5, 24, 16, Math.PI / 2)} position={[0, 0.55, 0]}>
        <meshStandardMaterial color="#77a94a" roughness={0.9} />
      </mesh>
      <Lantern position={[2.1, 0, 1.1]} />
      <Lantern position={[-2.1, 0, -1.1]} />
    </group>
  );
}

function AdaptiveCamera() {
  const { camera, size } = useThree();
  const aspect = size.height ? size.width / size.height : 1.5;
  useEffect(() => {
    const k = aspect < 1.2 ? Math.min(2, 1.25 / aspect) : 1;
    camera.position.set(22 * k, 26 * k, 31 * k);
    camera.lookAt(0, 0, 1);
  }, [aspect, camera]);
  useHudOffset();
  return null;
}

// ---------- Szene ----------

export type ValleySelection = { kind: 'project'; key: string } | { kind: 'ship' } | null;

export default function ValleyScene({
  active, projects, ship, shipLockedHint, members, meId, selection, guide, onSelect, onStation,
}: {
  active: boolean;
  /** Gesetzt, solange das Handelsschiff noch gesperrt ist. */
  shipLockedHint?: string;
  projects: ValleyProject[];
  ship: TradeShip | null;
  members: ValleyMember[];
  meId: string;
  selection: ValleySelection;
  guide: { kind: 'project'; key: string } | { kind: 'ship' } | { kind: 'station' } | null;
  onSelect: (s: ValleySelection) => void;
  onStation: () => void;
}) {
  const portalRef = useRef<HTMLDivElement>(null);
  const plants = useValleyPlants(members.length);
  const beacon: Vec2 | null = !guide
    ? null
    : guide.kind === 'project' ? projectSpot(guide.key) : guide.kind === 'ship' ? SPOTS.harbor : SPOTS.station;

  return (
    <div ref={portalRef} className="relative h-full w-full">
      <HtmlPortalContext.Provider value={portalRef as RefObject<HTMLElement>}>
        <Canvas
          frameloop={active ? 'always' : 'never'}
          shadows
          dpr={QUALITY === 'high' ? [1, 2] : [1, 1.5]}
          camera={{ position: [22, 26, 31], fov: 34, near: 0.5, far: 1200 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.2;
          }}
          onPointerMissed={() => onSelect(null)}
        >
          <WorldClock />
          <AdaptiveCamera />
          <Lights shadowSize={34} target={[0, 0, 0]} />
          <fog attach="fog" args={[SKY.fog, 70, 260]} />
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={14}
            maxDistance={85}
            minPolarAngle={0.4}
            maxPolarAngle={1.2}
            target={[0, 0, 1]}
          />

          <SkyDome />
          <DistantMountains count={16} minR={75} maxR={130} seed={21} />
          <Ground farms={members.length} />
          <Water />
          <Plaza />
          <TreeInstances pines={plants.pines} leafy={plants.leafy} />
          <Meadow spot={valleySpot} extent={36} seed={12} />

          {projects.map((p) => (
            <Monument
              key={p.id}
              project={p}
              selected={selection?.kind === 'project' && selection.key === p.key}
              highlight={guide?.kind === 'project' && guide.key === p.key}
              onSelect={(key) => onSelect({ kind: 'project', key })}
            />
          ))}
          <Harbor
            ship={ship}
            lockedHint={shipLockedHint}
            selected={selection?.kind === 'ship'}
            highlight={guide?.kind === 'ship'}
            onSelect={() => onSelect({ kind: 'ship' })}
          />
          {members.slice(0, 8).map((m, i) => <Farm key={m.id} member={m} index={i} isMe={m.id === meId} />)}
          <Station highlight={guide?.kind === 'station'} onClick={onStation} />
          {beacon && <Beacon position={beacon} height={6} />}
        </Canvas>
      </HtmlPortalContext.Provider>
    </div>
  );
}
