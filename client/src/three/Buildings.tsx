import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { ResourceIcon } from '../components/icons/ResourceIcon';
import { ProgressBar } from '../components/ui';
import type { Building, BuildingDef } from '../lib/types';
import {
  Barrel, Cottage, Fence, House, Log, LogPile, Pot, Smoke,
} from './House';
import { useHtmlPortal } from './htmlPortal';
import {
  buildingRot, homeRot, mulberry32, PLOTS, TABLE_POS, TABLE_ROT, VILLAGE, type Vec2,
} from './layout';
import { box, cyl, mats, sphere } from './materials';
import { GroundShadow } from './Mountain';
import { C } from './palette';
import { tex } from './textures';

type V3 = [number, number, number];

const clothMats = new Map<string, THREE.MeshStandardMaterial>();
/** Stoff in einer Farbe (geteilt pro Farbe). */
export function clothMat(color: string) {
  let m = clothMats.get(color);
  if (!m) {
    const t = tex('cloth');
    m = new THREE.MeshStandardMaterial({ color, map: t.map, normalMap: t.normal, roughness: 0.95, side: THREE.DoubleSide });
    clothMats.set(color, m);
  }
  return m;
}

// ---------- Einzelne Werkstätten ----------

function LumberCamp({ working }: { working: boolean }) {
  const m = mats();
  return (
    <group>
      <group position={[0, 0, -0.75]}>
        <House w={2.3} d={1.8} h={1.2} wall="woodDark" roof="roofMoss" smoking={working} shutters="woodRed" />
      </group>
      <LogPile position={[1.7, 0, 0.55]} rotY={0.35} />
      {/* Hackklotz mit Axt */}
      <group position={[-1.35, 0, 0.85]}>
        <mesh geometry={cyl(0.34, 0.4, 0.42, 20)} material={m.log} position={[0, 0.21, 0]} castShadow />
        <mesh geometry={cyl(0.33, 0.33, 0.02, 20)} material={m.logEnd} position={[0, 0.43, 0]} />
        <group position={[0.05, 0.64, 0]} rotation={[0, 0.5, 0.35]}>
          <mesh geometry={box(0.06, 0.58, 0.06, 0.02)} material={m.beam} />
          <mesh geometry={box(0.24, 0.13, 0.04, 0.01)} material={m.metal} position={[0.08, 0.25, 0]} />
        </group>
      </group>
      {/* Sägebock */}
      <group position={[0.2, 0, 1.3]} rotation={[0, 0.3, 0]}>
        {[-0.35, 0.35].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh geometry={box(0.06, 0.6, 0.06, 0.01)} material={m.timber} position={[0, 0.27, 0.12]} rotation={[0.4, 0, 0]} />
            <mesh geometry={box(0.06, 0.6, 0.06, 0.01)} material={m.timber} position={[0, 0.27, -0.12]} rotation={[-0.4, 0, 0]} />
          </group>
        ))}
        <Log position={[0, 0.58, 0]} rotation={[0, 0, Math.PI / 2]} length={1.1} radius={0.12} />
      </group>
    </group>
  );
}

function Boulder({ position, scale, seed }: { position: V3; scale: V3; seed: number }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const rng = mulberry32(seed);
    const bumps = Array.from({ length: 6 }, () => new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize());
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      let k = 1;
      for (const b of bumps) k -= Math.max(0, v.dot(b) - 0.6) * 0.5;
      v.multiplyScalar(k);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, [seed]);
  return <mesh geometry={geo} material={mats().rock} position={position} scale={scale} castShadow receiveShadow />;
}

function Quarry({ working }: { working: boolean }) {
  const m = mats();
  const block = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (block.current) block.current.rotation.z = working ? Math.sin(clock.elapsedTime * 1.6) * 0.12 : 0;
  });
  return (
    <group>
      <Boulder position={[-0.75, 0.6, -1.0]} scale={[1.35, 1.1, 1.2]} seed={1} />
      <Boulder position={[0.8, 0.5, -0.9]} scale={[1.1, 0.95, 1.05]} seed={2} />
      <Boulder position={[0.05, 1.15, -1.35]} scale={[1.2, 1.15, 1]} seed={3} />
      <Boulder position={[-1.6, 0.35, -0.2]} scale={[0.6, 0.5, 0.6]} seed={4} />
      {/* behauene Blöcke */}
      {[[1.3, 0.22, 0.7], [1.78, 0.22, 0.32], [1.5, 0.64, 0.52]].map((p, i) => (
        <mesh key={i} geometry={box(0.46, 0.42, 0.46, 0.05)} material={m.stone} position={p as V3} rotation={[0, i * 0.4, 0]} castShadow />
      ))}
      {/* Holzkran */}
      <group position={[-1.2, 0, 0.8]}>
        <mesh geometry={box(0.14, 2.1, 0.14, 0.03)} material={m.timber} position={[0, 1.05, 0]} castShadow />
        <mesh geometry={box(0.1, 0.9, 0.1, 0.02)} material={m.timber} position={[0.25, 1.65, 0]} rotation={[0, 0, -0.75]} />
        <mesh geometry={box(1.1, 0.11, 0.11, 0.02)} material={m.timber} position={[0.45, 2.0, 0]} castShadow />
        <group ref={block} position={[0.92, 1.95, 0]}>
          <mesh geometry={cyl(0.015, 0.015, 0.9, 6)} material={m.rope} position={[0, -0.45, 0]} />
          <mesh geometry={box(0.36, 0.3, 0.36, 0.04)} material={m.stone} position={[0, -1.02, 0]} castShadow />
        </group>
      </group>
      {/* Lore mit Steinen */}
      <group position={[0.4, 0, 1.25]} rotation={[0, -0.4, 0]}>
        <mesh geometry={box(0.8, 0.35, 0.5, 0.04)} material={m.woodDark} position={[0, 0.38, 0]} castShadow />
        {[-0.28, 0.28].map((x) => [-0.27, 0.27].map((z) => (
          <mesh key={`${x}${z}`} geometry={cyl(0.12, 0.12, 0.05, 16)} material={m.iron} position={[x, 0.13, z]} rotation={[Math.PI / 2, 0, 0]} />
        )))}
        {[[-0.15, 0.6, 0], [0.12, 0.62, 0.05], [0, 0.66, -0.08]].map((p, i) => (
          <mesh key={i} geometry={sphere(0.13, 12, 8)} material={m.rock} position={p as V3} />
        ))}
      </group>
    </group>
  );
}

function ClayPit({ working }: { working: boolean }) {
  const m = mats();
  return (
    <group>
      <mesh geometry={cyl(1.5, 1.6, 0.08, 40)} material={m.clay} position={[0, 0.02, -0.35]} receiveShadow />
      <mesh geometry={cyl(1.18, 1.18, 0.04, 40)} material={m.clayWet} position={[0, 0.06, -0.35]} receiveShadow />
      {/* Bretterrand */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} geometry={box(0.85, 0.1, 0.12, 0.02)} material={m.wood} position={[Math.cos(a) * 1.5, 0.1, -0.35 + Math.sin(a) * 1.5]} rotation={[0, -a + Math.PI / 2, 0]} castShadow />
        );
      })}
      {/* Schaufel */}
      <group position={[0.4, 0.45, -0.2]} rotation={[0.3, 0, -0.25]}>
        <mesh geometry={box(0.05, 0.85, 0.05, 0.015)} material={m.beam} />
        <mesh geometry={box(0.22, 0.26, 0.03, 0.01)} material={m.metal} position={[0, -0.45, 0]} />
      </group>
      {/* Unterstand */}
      <group position={[1.55, 0, 0.55]}>
        {[[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]].map(([x, z], i) => (
          <mesh key={i} geometry={box(0.1, 1.25, 0.1, 0.02)} material={m.timber} position={[x, 0.62, z]} castShadow />
        ))}
        <mesh geometry={box(1.45, 0.16, 1.3, 0.04)} material={m.thatch} position={[0, 1.3, 0]} rotation={[0.12, 0, 0]} castShadow />
        <Pot position={[-0.2, 0, 0]} scale={1.1} />
        <Pot position={[0.25, 0, -0.15]} scale={0.85} />
      </group>
      <Pot position={[-1.5, 0, 0.9]} scale={1.2} />
      <Pot position={[-1.1, 0, 1.25]} scale={0.8} color={C.terracotta} />
      {working && (
        <mesh position={[0, 0.09, -0.35]} rotation={[Math.PI / 2, 0, 0]} material={m.clay}>
          <torusGeometry args={[0.6, 0.03, 8, 32]} />
        </mesh>
      )}
    </group>
  );
}

function BerryBush({ position, seed }: { position: V3; seed: number }) {
  const m = mats();
  const berries = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: 14 }, () => {
      const a = rng() * Math.PI * 2;
      const b = rng() * Math.PI * 0.45;
      return [Math.cos(a) * Math.cos(b) * 0.47, 0.42 + Math.sin(b) * 0.42, Math.sin(a) * Math.cos(b) * 0.47] as V3;
    });
  }, [seed]);
  const leafMat = useMemo(() => {
    const t = tex('leafy');
    return new THREE.MeshStandardMaterial({ color: C.leaf[seed % C.leaf.length], map: t.map, normalMap: t.normal, roughness: 0.85 });
  }, [seed]);
  return (
    <group position={position}>
      <mesh geometry={sphere(0.5, 24, 16)} material={leafMat} position={[0, 0.42, 0]} scale={[1, 0.85, 1]} castShadow receiveShadow />
      {berries.map((p, i) => (
        <mesh key={i} geometry={sphere(0.07, 10, 8)} position={p} material={i % 3 === 0 ? berryRed() : berryBlue()} />
      ))}
      <mesh geometry={cyl(0.05, 0.07, 0.2, 8)} material={m.log} position={[0, 0.08, 0]} />
    </group>
  );
}
let bb: THREE.MeshStandardMaterial | null = null;
let br: THREE.MeshStandardMaterial | null = null;
const berryBlue = () => (bb ??= new THREE.MeshStandardMaterial({ color: C.berry, roughness: 0.25, metalness: 0.05 }));
const berryRed = () => (br ??= new THREE.MeshStandardMaterial({ color: C.berryRed, roughness: 0.25, metalness: 0.05 }));

function BerryFarm() {
  const m = mats();
  const bushes: V3[] = [];
  for (const x of [-1.05, 0, 1.05]) for (const z of [-0.85, 0.45]) bushes.push([x, 0, z]);
  return (
    <group>
      <mesh geometry={box(3.5, 0.06, 2.9, 0.03)} material={m.soilDark} position={[0, 0.03, -0.2]} receiveShadow />
      {bushes.map((p, i) => <BerryBush key={i} position={p} seed={i + 3} />)}
      <Fence from={[-1.8, -1.65]} to={[1.8, -1.65]} posts={5} />
      <Fence from={[-1.8, -1.65]} to={[-1.8, 1.25]} posts={4} />
      <Fence from={[1.8, -1.65]} to={[1.8, 1.25]} posts={4} />
      <Fence from={[-1.8, 1.25]} to={[-0.55, 1.25]} posts={2} />
      <Fence from={[0.55, 1.25]} to={[1.8, 1.25]} posts={2} />
      {/* Korb voller Beeren */}
      <group position={[1.35, 0, 1.6]}>
        <mesh geometry={cyl(0.26, 0.2, 0.3, 20, true)} material={m.thatch} position={[0, 0.15, 0]} castShadow />
        <mesh geometry={cyl(0.24, 0.24, 0.02, 20)} material={m.woodDark} position={[0, 0.02, 0]} />
        {[[-0.08, 0], [0.07, 0.05], [0, -0.08], [0.1, -0.06], [-0.05, 0.1]].map(([x, z], i) => (
          <mesh key={i} geometry={sphere(0.08, 10, 8)} material={i % 2 ? berryRed() : berryBlue()} position={[x, 0.3, z]} />
        ))}
      </group>
    </group>
  );
}

function CropField({ kind, seed, working }: { kind: 'wheat' | 'flax'; seed: number; working: boolean }) {
  const m = mats();
  const stalks = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const sway = useRef<THREE.Group>(null);
  const cols = 15;
  const rows = 11;
  const items = useMemo(() => {
    const rng = mulberry32(seed);
    const out: { x: number; z: number; h: number; r: number }[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        out.push({
          x: -1.45 + (i / (cols - 1)) * 2.9 + (rng() - 0.5) * 0.08,
          z: -1.35 + (j / (rows - 1)) * 2.35 + (rng() - 0.5) * 0.08,
          h: 0.5 + rng() * 0.28,
          r: (rng() - 0.5) * 0.3,
        });
      }
    }
    return out;
  }, [seed]);
  const stalkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: kind === 'wheat' ? '#d7b04f' : '#7fae84', roughness: 0.85 }), [kind]);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: kind === 'wheat' ? '#f0cd67' : C.flaxFlower, roughness: 0.6 }), [kind]);

  useLayoutEffect(() => {
    const mt = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(it.r * 0.3, it.r * 4, it.r));
      mt.compose(new THREE.Vector3(it.x, 0.1 + it.h / 2, it.z), q, new THREE.Vector3(1, it.h / 0.6, 1));
      stalks.current?.setMatrixAt(i, mt);
      mt.compose(new THREE.Vector3(it.x + it.r * 0.3, 0.12 + it.h, it.z), q, new THREE.Vector3(1, kind === 'wheat' ? 1.6 : 1, 1));
      heads.current?.setMatrixAt(i, mt);
    });
    if (stalks.current) stalks.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  }, [items, kind]);

  useFrame(({ clock }) => {
    if (!sway.current) return;
    const t = clock.elapsedTime;
    sway.current.rotation.z = Math.sin(t * 1.3 + seed) * 0.025;
    sway.current.rotation.x = Math.sin(t * 0.9 + seed) * 0.015;
  });

  return (
    <group>
      <mesh geometry={box(3.4, 0.14, 2.9, 0.05)} material={m.soil} position={[0, 0.05, -0.2]} castShadow receiveShadow />
      <group ref={sway}>
        <instancedMesh ref={stalks} args={[undefined, stalkMat, items.length]} castShadow>
          <cylinderGeometry args={[0.012, 0.022, 0.6, 5]} />
        </instancedMesh>
        <instancedMesh ref={heads} args={[undefined, headMat, items.length]} castShadow>
          {kind === 'wheat' ? <capsuleGeometry args={[0.035, 0.1, 4, 8]} /> : <icosahedronGeometry args={[0.055, 1]} />}
        </instancedMesh>
      </group>
      {/* Vogelscheuche */}
      <group position={[1.85, 0, -1.1]} rotation={[0, -0.4, 0]}>
        <mesh geometry={box(0.07, 1.35, 0.07, 0.015)} material={m.timber} position={[0, 0.67, 0]} castShadow />
        <mesh geometry={box(0.85, 0.06, 0.06, 0.015)} material={m.timber} position={[0, 0.95, 0]} />
        <mesh geometry={box(0.38, 0.44, 0.2, 0.06)} material={clothMat(working ? C.shirt[1] : C.shirt[0])} position={[0, 0.86, 0]} castShadow />
        <mesh geometry={sphere(0.17, 16, 12)} material={m.thatch} position={[0, 1.28, 0]} castShadow />
        <mesh geometry={cyl(0.32, 0.32, 0.03, 20)} material={m.thatch} position={[0, 1.42, 0]} />
        <mesh geometry={cyl(0.13, 0.17, 0.16, 16)} material={m.thatch} position={[0, 1.5, 0]} />
      </group>
    </group>
  );
}

function Sawmill({ working }: { working: boolean }) {
  const m = mats();
  const blade = useRef<THREE.Mesh>(null);
  const speed = useRef(0);
  useFrame((_, delta) => {
    speed.current = THREE.MathUtils.damp(speed.current, working ? 9 : 0, 2, delta);
    if (blade.current) blade.current.rotation.y += speed.current * delta;
  });
  return (
    <group>
      <group position={[0, 0, -0.8]}>
        <House w={2.5} d={1.8} h={1.35} wall="wood" roof="roofDark" chimney={false} shutters="woodGreen" />
      </group>
      {/* offener Schuppen mit Sägebank */}
      <group position={[1.55, 0, 0.75]} rotation={[0, -0.25, 0]}>
        {[[-0.75, -0.45], [0.75, -0.45], [-0.75, 0.45], [0.75, 0.45]].map(([x, z], i) => (
          <mesh key={i} geometry={box(0.09, 1.3, 0.09, 0.02)} material={m.timber} position={[x, 0.65, z]} castShadow />
        ))}
        <mesh geometry={box(1.75, 0.08, 1.2, 0.02)} material={m.roofDark} position={[0, 1.35, 0]} rotation={[0.1, 0, 0]} castShadow />
        <mesh geometry={box(1.3, 0.12, 0.6, 0.03)} material={m.woodLight} position={[0, 0.42, 0]} castShadow />
        {[[-0.55, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]].map(([x, z], i) => (
          <mesh key={i} geometry={box(0.08, 0.36, 0.08, 0.015)} material={m.timber} position={[x, 0.18, z]} />
        ))}
        <Log position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]} length={1.2} radius={0.14} />
        <mesh ref={blade} geometry={cyl(0.32, 0.32, 0.02, 32)} material={m.metal} position={[0.1, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      {/* Plankenstapel */}
      <group position={[-1.55, 0, 0.75]} rotation={[0, 0.3, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} geometry={box(1.15, 0.08, 0.32, 0.015)} material={i % 2 ? m.woodLight : m.wood} position={[0, 0.06 + i * 0.09, 0]} rotation={[0, i % 2 ? 0.06 : -0.04, 0]} castShadow />
        ))}
      </group>
    </group>
  );
}

function BrickKiln({ working }: { working: boolean }) {
  const m = mats();
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const level = useRef(0);
  useFrame(({ clock }, delta) => {
    level.current = THREE.MathUtils.damp(level.current, working ? 1 : 0.1, 1.5, delta);
    if (glow.current) {
      glow.current.emissiveIntensity = level.current * (2.2 + Math.sin(clock.elapsedTime * 9) * 0.4 + Math.sin(clock.elapsedTime * 23) * 0.2);
    }
  });
  const dome = useMemo(() => {
    const g = new THREE.SphereGeometry(1.15, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 7.2, uv.getY(i) * 1.8);
    return g;
  }, []);
  return (
    <group>
      <group position={[0, 0, -0.45]}>
        <mesh geometry={cyl(1.32, 1.42, 0.32, 36)} material={m.stone} position={[0, 0.16, 0]} castShadow receiveShadow />
        <mesh geometry={dome} material={m.brick} position={[0, 0.32, 0]} castShadow receiveShadow />
        <mesh geometry={box(0.84, 0.8, 0.44, 0.05)} material={m.brick} position={[0, 0.66, 1.02]} castShadow />
        <mesh position={[0, 0.6, 1.25]}>
          <boxGeometry args={[0.48, 0.46, 0.04]} />
          <meshStandardMaterial ref={glow} color="#4a2312" emissive="#ff8a2a" emissiveIntensity={0.2} roughness={1} />
        </mesh>
        <mesh geometry={cyl(0.22, 0.26, 0.9, 20)} material={m.brick} position={[0.35, 1.5, -0.2]} castShadow />
        <mesh geometry={cyl(0.27, 0.27, 0.08, 20)} material={m.stoneDark} position={[0.35, 1.97, -0.2]} />
        <Smoke position={[0.35, 2.0, -0.2]} active={working} size={1.15} />
      </group>
      {/* Ziegelstapel */}
      <group position={[1.45, 0, 0.8]}>
        {Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 3 - row }, (_, k) => (
            <mesh key={`${row}-${k}`} geometry={box(0.28, 0.13, 0.46, 0.02)} material={m.brick} position={[(k - (2 - row) / 2) * 0.3, 0.07 + row * 0.14, 0]} castShadow />
          )),
        )}
      </group>
      <LogPile position={[-1.5, 0, 0.7]} rotY={-0.4} />
    </group>
  );
}

function Weavery({ working }: { working: boolean }) {
  const m = mats();
  const cloths = useRef<(THREE.Group | null)[]>([]);
  const sails = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    cloths.current.forEach((g, i) => {
      if (g) g.rotation.x = Math.sin(t * (working ? 3 : 1.6) + i * 1.3) * (working ? 0.28 : 0.12);
    });
    if (sails.current) sails.current.rotation.z += delta * (working ? 1.4 : 0.4);
  });
  return (
    <group>
      <group position={[0, 0, -0.7]}>
        <House w={2.4} d={1.9} h={1.5} wall="plasterRose" roof="roofSlate" smoking={working} smokeSize={0.8} shutters="woodBlue" />
        {/* kleines Windrad am Giebel */}
        <group position={[0, 2.55, 1.05]}>
          <mesh geometry={cyl(0.06, 0.06, 0.25, 12)} material={m.iron} rotation={[Math.PI / 2, 0, 0]} />
          <group ref={sails} position={[0, 0, 0.14]}>
            {[0, 1, 2, 3].map((i) => (
              <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
                <mesh geometry={box(0.05, 0.75, 0.03, 0.01)} material={m.beam} position={[0, 0.38, 0]} />
                <mesh geometry={box(0.22, 0.55, 0.01, 0)} material={clothMat('#f6efe0')} position={[0.12, 0.45, 0]} />
              </group>
            ))}
          </group>
        </group>
      </group>
      {/* Wäscheleine mit Stoffbahnen */}
      <group position={[1.75, 0, 0.1]} rotation={[0, Math.PI / 2, 0]}>
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} geometry={box(0.08, 1.5, 0.08, 0.02)} material={m.timber} position={[x, 0.75, 0]} castShadow />
        ))}
        <mesh geometry={cyl(0.01, 0.01, 1.9, 5)} material={m.rope} position={[0, 1.45, 0]} rotation={[0, 0, Math.PI / 2]} />
        {C.cloth.map((color, i) => (
          <group key={i} ref={(g) => { cloths.current[i] = g; }} position={[-0.68 + i * 0.45, 1.45, 0]}>
            <mesh geometry={box(0.38, 0.62, 0.015, 0)} material={clothMat(color)} position={[0, -0.32, 0]} castShadow />
          </group>
        ))}
      </group>
      {/* Stoffballen */}
      <group position={[-1.6, 0, 0.75]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={cyl(0.15, 0.15, 0.5, 20)} material={clothMat(C.cloth[i])} position={[(i - 1) * 0.34, 0.15 + (i === 1 ? 0.25 : 0), i === 1 ? 0 : 0.05]} rotation={[0, 0, Math.PI / 2]} castShadow />
        ))}
      </group>
    </group>
  );
}

function Kitchen({ working }: { working: boolean }) {
  const m = mats();
  const fire = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (fire.current) fire.current.emissiveIntensity = (working ? 2 : 0.2) * (0.85 + Math.sin(clock.elapsedTime * 11) * 0.15);
  });
  return (
    <group>
      <group position={[0, 0, -0.7]}>
        <House w={2.6} d={2} h={1.5} wall="plasterWarm" roof="roofRed" smoking={working} smokeSize={1.35} shutters="woodGreen" />
      </group>
      {/* Steinofen vor dem Haus */}
      <group position={[1.65, 0, 0.6]}>
        <mesh geometry={box(0.8, 0.5, 0.7, 0.05)} material={m.stone} position={[0, 0.25, 0]} castShadow />
        <mesh geometry={sphere(0.42, 24, 12, Math.PI / 2)} material={m.clay} position={[0, 0.5, 0]} castShadow />
        <mesh position={[0, 0.6, 0.36]}>
          <boxGeometry args={[0.26, 0.2, 0.04]} />
          <meshStandardMaterial ref={fire} color="#3a1a0c" emissive="#ff8a2a" emissiveIntensity={0.2} />
        </mesh>
      </group>
      <Barrel position={[-1.65, 0, 0.6]} />
      <Barrel position={[-1.95, 0, 0.05]} scale={0.85} />
      {/* Gemüsekiste */}
      <group position={[-0.9, 0, 1.15]}>
        <mesh geometry={box(0.6, 0.36, 0.45, 0.03)} material={m.woodLight} position={[0, 0.18, 0]} castShadow />
        {[[-0.15, 0.08, '#f08a3e'], [0.12, -0.05, '#e9c25a'], [0.02, 0.12, '#9ac17a'], [-0.05, -0.1, '#d85a4a']].map(([x, z, c], i) => (
          <mesh key={i} geometry={sphere(0.1, 14, 10)} position={[x as number, 0.42, z as number]}>
            <meshStandardMaterial color={c as string} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Esstisch, Hütten ----------

export function DiningTable() {
  const m = mats();
  return (
    <group position={[TABLE_POS[0], VILLAGE.y, TABLE_POS[1]]} rotation={[0, TABLE_ROT, 0]}>
      <GroundShadow radius={1.8} opacity={0.22} />
      <mesh geometry={box(2.3, 0.1, 0.85, 0.03)} material={m.woodLight} position={[0, 0.55, 0]} castShadow receiveShadow />
      {[[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]].map(([x, z], i) => (
        <mesh key={i} geometry={box(0.09, 0.52, 0.09, 0.02)} material={m.timber} position={[x, 0.26, z]} />
      ))}
      {[-0.72, 0.72].map((z) => (
        <mesh key={z} geometry={box(2.2, 0.08, 0.3, 0.02)} material={m.wood} position={[0, 0.3, z]} castShadow />
      ))}
      {/* Tischtuch-Läufer, Teller und Kuchen */}
      <mesh geometry={box(2.0, 0.01, 0.36, 0)} material={clothMat('#e27d6a')} position={[0, 0.61, 0]} />
      {[-0.6, 0.6].map((x) => (
        <group key={x} position={[x, 0.61, 0]}>
          <mesh geometry={cyl(0.2, 0.17, 0.04, 24)} material={m.white} />
          <mesh geometry={cyl(0.15, 0.16, 0.09, 24)} position={[0, 0.06, 0]}>
            <meshStandardMaterial color="#e3a548" roughness={0.7} />
          </mesh>
        </group>
      ))}
      <Lamp position={[0, 0.62, 0]} />
    </group>
  );
}

function Lamp({ position }: { position: V3 }) {
  const m = mats();
  return (
    <group position={position}>
      <mesh geometry={cyl(0.05, 0.06, 0.08, 12)} material={m.iron} position={[0, 0.04, 0]} />
      <mesh geometry={sphere(0.07, 14, 10)} material={m.lamp} position={[0, 0.14, 0]} />
    </group>
  );
}

export function Homes({ slots, occupiedResting }: { slots: Vec2[]; occupiedResting: boolean[] }) {
  const m = mats();
  return (
    <>
      {slots.map((p, i) => (
        <group key={i} position={[p[0], VILLAGE.y, p[1]]} rotation={[0, homeRot(p), 0]}>
          <GroundShadow radius={1.5} opacity={0.28} />
          <Cottage occupied resting={occupiedResting[i] ?? false} variant={i} />
          <mesh geometry={box(0.7, 0.08, 0.26, 0.02)} material={m.wood} position={[0.92, 0.2, 0.9]} castShadow />
          <mesh geometry={box(0.08, 0.2, 0.22, 0.02)} material={m.timber} position={[0.65, 0.1, 0.9]} />
          <mesh geometry={box(0.08, 0.2, 0.22, 0.02)} material={m.timber} position={[1.19, 0.1, 0.9]} />
        </group>
      ))}
    </>
  );
}

// ---------- Hülle mit Grundfläche, Auswahl und Schild ----------

export function BuildingModel({ type, working }: { type: string; working: boolean }) {
  switch (type) {
    case 'lumberCamp': return <LumberCamp working={working} />;
    case 'quarry': return <Quarry working={working} />;
    case 'clayPit': return <ClayPit working={working} />;
    case 'berryFarm': return <BerryFarm />;
    case 'wheatField': return <CropField kind="wheat" seed={11} working={working} />;
    case 'flaxField': return <CropField kind="flax" seed={23} working={working} />;
    case 'sawmill': return <Sawmill working={working} />;
    case 'brickKiln': return <BrickKiln working={working} />;
    case 'weavery': return <Weavery working={working} />;
    case 'kitchen': return <Kitchen working={working} />;
    default: return null;
  }
}

export function Ring({ radius, color, speed }: { radius: number; color: string; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * speed) * 0.03;
    ref.current.scale.set(s, s, 1);
  });
  return (
    <mesh ref={ref} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.07, 10, 64]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.4} />
    </mesh>
  );
}

/** Wächst beim ersten Erscheinen aus dem Boden (nach dem Bauen). */
export function GrowIn({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(active ? 0 : 1);
  useFrame((_, dt) => {
    if (!ref.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + dt / 0.9);
    const k = t.current;
    // federndes Hineinwachsen
    const s = 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5) * (1 - k);
    ref.current.scale.set(s, Math.max(0.01, k < 0.15 ? k / 0.15 * 0.3 : s), s);
  });
  return <group ref={ref} scale={active ? 0.01 : 1}>{children}</group>;
}

const STATUS_DOT: Record<Building['status'], string> = {
  idle: '#b9a98a',
  working: '#7bbf4a',
  missingInputs: '#d9724a',
  full: '#e9b949',
};

export function BuildingPlot({
  building, def, selected, canAssign, onClick, onCollect, justBuilt = false,
}: {
  building: Building;
  def: BuildingDef;
  selected: boolean;
  canAssign: boolean;
  onClick: (id: string) => void;
  onCollect: (id: string) => void;
  justBuilt?: boolean;
}) {
  const plot = PLOTS[building.type];
  const [hover, setHover] = useState(false);
  const portal = useHtmlPortal();
  if (!plot) return null;
  const working = building.status === 'working';
  const stockEntries = Object.entries(building.stock).filter(([, n]) => n > 0);

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(building.id);
  };

  return (
    <group position={[plot.pos[0], plot.y, plot.pos[1]]} rotation={[0, buildingRot(plot.pos), 0]}>
      {/* unsichtbare, flache Klickfläche (Bewohner davor bleiben anklickbar) */}
      <mesh position={[0, 0.05, 0]} onClick={click} visible={false}>
        <cylinderGeometry args={[plot.radius, plot.radius, 0.1, 24]} />
      </mesh>
      <GroundShadow radius={plot.radius * 1.05} opacity={hover ? 0.4 : 0.3} />
      {selected && <Ring radius={plot.radius} color={C.gold} speed={3} />}
      {!selected && canAssign && <Ring radius={plot.radius} color="#9be36b" speed={5} />}
      <group
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        <GrowIn active={justBuilt}>
          <BuildingModel type={building.type} working={working} />
        </GrowIn>
      </group>
      <Html portal={portal} position={[0, plot.labelHeight, 0]} center distanceFactor={11} zIndexRange={[30, 0]}>
        <div className={`scene-label ${selected ? 'is-selected' : ''}`} onClick={() => onClick(building.id)}>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_DOT[building.status] }} />
            <span>{def.name}</span>
            <span className="opacity-60">{building.workerIds.length}/{def.slots}</span>
          </div>
          <div className="mt-1 w-28">
            <ProgressBar value={building.progress} max={def.durationSec} tone={working ? 'moss' : 'honey'} smooth={working} />
          </div>
        </div>
        {stockEntries.length > 0 && (
          <button
            className="scene-collect"
            onClick={(e) => {
              e.stopPropagation();
              onCollect(building.id);
            }}
            title="Einsammeln"
          >
            {stockEntries.map(([res, n]) => (
              <span key={res} className="flex items-center gap-0.5">
                <ResourceIcon resource={res} size={22} />
                <span>{n}</span>
              </span>
            ))}
          </button>
        )}
      </Html>
    </group>
  );
}
