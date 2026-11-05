import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ResourceIcon } from '../components/icons/ResourceIcon';
import { ProgressBar } from '../components/ui';
import type { Building, BuildingDef } from '../lib/types';
import {
  Barrel, Cottage, Fence, House, Log, LogPile, Pot, Smoke,
} from './House';
import { useHtmlPortal } from './htmlPortal';
import { facePlaza, mulberry32, PLOTS, TABLE_POS, type Vec2 } from './layout';
import { C } from './palette';

type V3 = [number, number, number];

// ---------- Einzelne Werkstätten ----------

function LumberCamp({ working }: { working: boolean }) {
  return (
    <group>
      <group position={[0, 0, -0.7]}>
        <House w={2.2} d={1.7} h={1.15} roof={C.thatch} smoking={working} />
      </group>
      <LogPile position={[1.65, 0, 0.6]} rotY={0.35} />
      <group position={[-1.35, 0, 0.9]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.38, 0.4, 10]} />
          <meshStandardMaterial color={C.trunk} roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.41, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.02, 10]} />
          <meshStandardMaterial color={C.woodLight} roughness={1} />
        </mesh>
        <group position={[0.05, 0.62, 0]} rotation={[0, 0.5, 0.35]}>
          <mesh>
            <boxGeometry args={[0.06, 0.55, 0.06]} />
            <meshStandardMaterial color={C.wood} />
          </mesh>
          <mesh position={[0.08, 0.24, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.04]} />
            <meshStandardMaterial color="#9aa3a8" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Quarry({ working }: { working: boolean }) {
  const block = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (block.current) block.current.rotation.z = working ? Math.sin(clock.elapsedTime * 1.6) * 0.12 : 0;
  });
  const boulders: { p: V3; s: number }[] = [
    { p: [-0.7, 0.6, -0.9], s: 1.25 },
    { p: [0.75, 0.5, -0.8], s: 1.05 },
    { p: [0, 1.05, -1.2], s: 1.15 },
    { p: [-1.5, 0.35, -0.2], s: 0.6 },
  ];
  return (
    <group>
      {boulders.map((b, i) => (
        <mesh key={i} position={b.p} scale={[b.s, b.s * 0.85, b.s]} rotation={[0, i, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={i % 2 ? C.stone : C.stoneDark} roughness={1} flatShading />
        </mesh>
      ))}
      {/* behauene Blöcke */}
      {[[1.3, 0.22, 0.7], [1.75, 0.22, 0.35], [1.5, 0.62, 0.55]].map((p, i) => (
        <mesh key={i} position={p as V3} rotation={[0, i * 0.4, 0]} castShadow>
          <boxGeometry args={[0.45, 0.42, 0.45]} />
          <meshStandardMaterial color={C.stone} roughness={1} />
        </mesh>
      ))}
      {/* kleiner Holzkran */}
      <group position={[-1.2, 0, 0.8]}>
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[0.12, 2, 0.12]} />
          <meshStandardMaterial color={C.wood} roughness={1} />
        </mesh>
        <mesh position={[0.45, 1.95, 0]} castShadow>
          <boxGeometry args={[1.05, 0.1, 0.1]} />
          <meshStandardMaterial color={C.wood} roughness={1} />
        </mesh>
        <group ref={block} position={[0.9, 1.9, 0]}>
          <mesh position={[0, -0.45, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.9, 4]} />
            <meshStandardMaterial color="#d8c7a0" />
          </mesh>
          <mesh position={[0, -1.02, 0]} castShadow>
            <boxGeometry args={[0.36, 0.3, 0.36]} />
            <meshStandardMaterial color={C.stone} roughness={1} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function ClayPit({ working }: { working: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.02, -0.35]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.55, 0.06, 20]} />
        <meshStandardMaterial color={C.clay} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.045, -0.35]} receiveShadow>
        <cylinderGeometry args={[1.15, 1.15, 0.03, 20]} />
        <meshStandardMaterial color={C.clayWet} roughness={0.55} />
      </mesh>
      {/* Schaufel */}
      <group position={[0.4, 0.4, -0.2]} rotation={[0.3, 0, -0.25]}>
        <mesh>
          <boxGeometry args={[0.05, 0.8, 0.05]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[0.2, 0.24, 0.03]} />
          <meshStandardMaterial color="#9aa3a8" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      {/* Unterstand */}
      <group position={[1.5, 0, 0.5]}>
        {[[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.6, z]} castShadow>
            <boxGeometry args={[0.08, 1.2, 0.08]} />
            <meshStandardMaterial color={C.wood} roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 1.25, 0]} rotation={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[1.35, 0.12, 1.2]} />
          <meshStandardMaterial color={C.thatch} roughness={1} flatShading />
        </mesh>
        <Pot position={[-0.2, 0, 0]} scale={1.1} />
        <Pot position={[0.25, 0, -0.15]} scale={0.85} color={C.clayWet} />
      </group>
      <Pot position={[-1.45, 0, 0.9]} scale={1.2} />
      <Pot position={[-1.05, 0, 1.25]} scale={0.8} color={C.terracotta} />
      {working && (
        <mesh position={[0, 0.07, -0.35]}>
          <torusGeometry args={[0.6, 0.03, 6, 20]} />
          <meshStandardMaterial color={C.clay} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

function Bush({ position, seed }: { position: V3; seed: number }) {
  const berries = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: 9 }, () => {
      const a = rng() * Math.PI * 2;
      const b = rng() * Math.PI * 0.45;
      return [Math.cos(a) * Math.cos(b) * 0.44, 0.45 + Math.sin(b) * 0.4, Math.sin(a) * Math.cos(b) * 0.44] as V3;
    });
  }, [seed]);
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.47, 1]} />
        <meshStandardMaterial color={C.leaf[seed % C.leaf.length]} roughness={0.9} flatShading />
      </mesh>
      {berries.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.075, 8, 6]} />
          <meshStandardMaterial color={i % 3 === 0 ? C.berryRed : C.berry} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function BerryFarm() {
  const bushes: V3[] = [];
  for (const x of [-1.05, 0, 1.05]) for (const z of [-0.85, 0.45]) bushes.push([x, 0, z]);
  return (
    <group>
      <mesh position={[0, 0.012, -0.2]} receiveShadow>
        <boxGeometry args={[3.5, 0.02, 2.9]} />
        <meshStandardMaterial color={C.grassDark} roughness={1} />
      </mesh>
      {bushes.map((p, i) => <Bush key={i} position={p} seed={i + 3} />)}
      <Fence from={[-1.8, -1.65]} to={[1.8, -1.65]} posts={5} />
      <Fence from={[-1.8, -1.65]} to={[-1.8, 1.25]} posts={4} />
      <Fence from={[1.8, -1.65]} to={[1.8, 1.25]} posts={4} />
      <Fence from={[-1.8, 1.25]} to={[-0.55, 1.25]} posts={2} />
      <Fence from={[0.55, 1.25]} to={[1.8, 1.25]} posts={2} />
      <group position={[1.35, 0, 1.6]}>
        <mesh position={[0, 0.14, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.2, 0.28, 10]} />
          <meshStandardMaterial color={C.woodLight} roughness={1} />
        </mesh>
        {[[-0.08, 0], [0.07, 0.05], [0, -0.08]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.3, z]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshStandardMaterial color={C.berry} roughness={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function CropField({
  color, flowerColor, seed, working,
}: { color: string; flowerColor?: string; seed: number; working: boolean }) {
  const stalks = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const sway = useRef<THREE.Group>(null);
  const cols = 11;
  const rows = 9;
  const items = useMemo(() => {
    const rng = mulberry32(seed);
    const out: { x: number; z: number; h: number; r: number }[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        out.push({
          x: -1.4 + (i / (cols - 1)) * 2.8 + (rng() - 0.5) * 0.12,
          z: -1.3 + (j / (rows - 1)) * 2.3 + (rng() - 0.5) * 0.12,
          h: 0.45 + rng() * 0.3,
          r: (rng() - 0.5) * 0.3,
        });
      }
    }
    return out;
  }, [seed]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(it.r * 0.3, 0, it.r));
      m.compose(new THREE.Vector3(it.x, 0.1 + it.h / 2, it.z), q, new THREE.Vector3(1, it.h / 0.6, 1));
      stalks.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(it.x + it.r * 0.3, 0.1 + it.h + 0.02, it.z), q, new THREE.Vector3(1, 1, 1));
      flowers.current?.setMatrixAt(i, m);
    });
    if (stalks.current) stalks.current.instanceMatrix.needsUpdate = true;
    if (flowers.current) flowers.current.instanceMatrix.needsUpdate = true;
  }, [items]);

  useFrame(({ clock }) => {
    if (!sway.current) return;
    const t = clock.elapsedTime;
    sway.current.rotation.z = Math.sin(t * 1.3 + seed) * 0.025;
    sway.current.rotation.x = Math.sin(t * 0.9 + seed) * 0.015;
  });

  return (
    <group>
      <mesh position={[0, 0.05, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[3.3, 0.1, 2.8]} />
        <meshStandardMaterial color={C.dirt} roughness={1} />
      </mesh>
      {Array.from({ length: rows }, (_, j) => (
        <mesh key={j} position={[0, 0.105, -1.3 + (j / (rows - 1)) * 2.3]}>
          <boxGeometry args={[3.1, 0.02, 0.12]} />
          <meshStandardMaterial color={C.dirtDark} roughness={1} />
        </mesh>
      ))}
      <group ref={sway}>
        <instancedMesh ref={stalks} args={[undefined, undefined, items.length]} castShadow>
          <coneGeometry args={[0.05, 0.6, 4]} />
          <meshStandardMaterial color={color} roughness={0.9} flatShading />
        </instancedMesh>
        <instancedMesh ref={flowers} args={[undefined, undefined, items.length]}>
          <icosahedronGeometry args={[0.055, 0]} />
          <meshStandardMaterial color={flowerColor ?? color} roughness={0.7} flatShading />
        </instancedMesh>
      </group>
      {/* Vogelscheuche */}
      <group position={[1.85, 0, -1.1]} rotation={[0, -0.4, 0]}>
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[0.07, 1.3, 0.07]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.8, 0.06, 0.06]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.36, 0.42, 0.18]} />
          <meshStandardMaterial color={working ? C.shirt[1] : C.shirt[0]} roughness={1} />
        </mesh>
        <mesh position={[0, 1.27, 0]} castShadow>
          <sphereGeometry args={[0.17, 10, 8]} />
          <meshStandardMaterial color={C.thatch} roughness={1} />
        </mesh>
        <mesh position={[0, 1.42, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.03, 12]} />
          <meshStandardMaterial color={C.hat[0]} roughness={1} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.13, 0.16, 0.15, 12]} />
          <meshStandardMaterial color={C.hat[0]} roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

function Sawmill({ working }: { working: boolean }) {
  const blade = useRef<THREE.Mesh>(null);
  const speed = useRef(0);
  useFrame((_, delta) => {
    speed.current = THREE.MathUtils.damp(speed.current, working ? 9 : 0, 2, delta);
    if (blade.current) blade.current.rotation.y += speed.current * delta;
  });
  return (
    <group>
      <group position={[0, 0, -0.8]}>
        <House w={2.4} d={1.8} h={1.3} roof={C.terracotta} chimney={false} />
      </group>
      {/* Sägebank */}
      <group position={[1.55, 0, 0.75]} rotation={[0, -0.25, 0]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.3, 0.12, 0.6]} />
          <meshStandardMaterial color={C.woodLight} roughness={1} />
        </mesh>
        {[[-0.55, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.18, z]} castShadow>
            <boxGeometry args={[0.08, 0.36, 0.08]} />
            <meshStandardMaterial color={C.wood} />
          </mesh>
        ))}
        <Log position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]} length={1.2} radius={0.14} />
        <mesh ref={blade} position={[0.1, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.025, 16]} />
          <meshStandardMaterial color="#c9d1d6" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {/* Plankenstapel */}
      <group position={[-1.55, 0, 0.75]} rotation={[0, 0.3, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.06 + i * 0.1, 0]} rotation={[0, i % 2 ? 0.06 : -0.04, 0]} castShadow>
            <boxGeometry args={[1.1, 0.08, 0.34]} />
            <meshStandardMaterial color={i % 2 ? C.woodLight : '#d9a66d'} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function BrickKiln({ working }: { working: boolean }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const level = useRef(0);
  useFrame(({ clock }, delta) => {
    level.current = THREE.MathUtils.damp(level.current, working ? 1 : 0.1, 1.5, delta);
    if (glow.current) {
      glow.current.emissiveIntensity = level.current * (1.6 + Math.sin(clock.elapsedTime * 9) * 0.35 + Math.sin(clock.elapsedTime * 23) * 0.15);
    }
  });
  return (
    <group>
      <group position={[0, 0, -0.45]}>
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.3, 1.4, 0.3, 18]} />
          <meshStandardMaterial color={C.stone} roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <sphereGeometry args={[1.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={C.clay} roughness={1} flatShading />
        </mesh>
        {/* Ofenöffnung */}
        <mesh position={[0, 0.62, 1.02]} castShadow>
          <boxGeometry args={[0.8, 0.75, 0.4]} />
          <meshStandardMaterial color={C.brick} roughness={1} />
        </mesh>
        <mesh position={[0, 0.58, 1.2]}>
          <boxGeometry args={[0.48, 0.46, 0.06]} />
          <meshStandardMaterial ref={glow} color="#5a2a14" emissive="#ff8a2a" emissiveIntensity={0.2} roughness={1} />
        </mesh>
        <mesh position={[0.35, 1.45, -0.2]} castShadow>
          <cylinderGeometry args={[0.2, 0.24, 0.8, 10]} />
          <meshStandardMaterial color={C.brick} roughness={1} />
        </mesh>
        <Smoke position={[0.35, 1.9, -0.2]} active={working} size={1.1} />
      </group>
      {/* Ziegelstapel */}
      <group position={[1.45, 0, 0.8]}>
        {Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 3 - row }, (_, k) => (
            <mesh key={`${row}-${k}`} position={[(k - (2 - row) / 2) * 0.3, 0.07 + row * 0.14, 0]} castShadow>
              <boxGeometry args={[0.28, 0.13, 0.46]} />
              <meshStandardMaterial color={row % 2 ? '#b8553a' : C.brick} roughness={1} />
            </mesh>
          )),
        )}
      </group>
      <LogPile position={[-1.5, 0, 0.7]} rotY={-0.4} />
    </group>
  );
}

function Weavery({ working }: { working: boolean }) {
  const cloths = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cloths.current.forEach((m, i) => {
      if (m) m.rotation.x = Math.sin(t * (working ? 3 : 1.6) + i * 1.3) * (working ? 0.28 : 0.12);
    });
  });
  return (
    <group>
      <group position={[0, 0, -0.7]}>
        <House w={2.4} d={1.9} h={1.5} wall={C.plasterWarm} roof={C.terracottaDark} smoking={working} smokeSize={0.8} />
      </group>
      {/* Wäscheleine mit Stoffbahnen */}
      <group position={[1.75, 0, 0.1]} rotation={[0, Math.PI / 2, 0]}>
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} position={[x, 0.75, 0]} castShadow>
            <boxGeometry args={[0.08, 1.5, 0.08]} />
            <meshStandardMaterial color={C.wood} />
          </mesh>
        ))}
        <mesh position={[0, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 1.9, 4]} />
          <meshStandardMaterial color="#efe3c4" />
        </mesh>
        {C.cloth.map((color, i) => (
          <group key={i} ref={(g) => { cloths.current[i] = g; }} position={[-0.68 + i * 0.45, 1.45, 0]}>
            <mesh position={[0, -0.32, 0]} castShadow>
              <boxGeometry args={[0.38, 0.62, 0.02]} />
              <meshStandardMaterial color={color} roughness={1} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Stoffballen */}
      <group position={[-1.6, 0, 0.75]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(i - 1) * 0.34, 0.15 + (i === 1 ? 0.25 : 0), i === 1 ? 0 : 0.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.5, 10]} />
            <meshStandardMaterial color={C.cloth[i]} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Kitchen({ working }: { working: boolean }) {
  return (
    <group>
      <group position={[0, 0, -0.7]}>
        <House w={2.6} d={2} h={1.5} roof={C.terracotta} smoking={working} smokeSize={1.35} />
      </group>
      <Barrel position={[-1.65, 0, 0.6]} />
      <Barrel position={[-1.95, 0, 0.05]} scale={0.85} />
      <group position={[1.6, 0, 0.7]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.5]} />
          <meshStandardMaterial color={C.woodLight} roughness={1} />
        </mesh>
        {[[-0.15, 0.08, '#f08a3e'], [0.12, -0.05, '#e9c25a'], [0.02, 0.12, '#9ac17a']].map(([x, z, c], i) => (
          <mesh key={i} position={[x as number, 0.46, z as number]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color={c as string} roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Esstisch, Hütten ----------

export function DiningTable() {
  return (
    <group position={[TABLE_POS[0], 0, TABLE_POS[1]]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.1, 0.8]} />
        <meshStandardMaterial color={C.woodLight} roughness={1} />
      </mesh>
      {[[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.25, z]}>
          <boxGeometry args={[0.08, 0.5, 0.08]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
      ))}
      {[-0.7, 0.7].map((z) => (
        <mesh key={z} position={[0, 0.26, z]} castShadow>
          <boxGeometry args={[2.2, 0.08, 0.3]} />
          <meshStandardMaterial color={C.wood} roughness={1} />
        </mesh>
      ))}
      {[-0.6, 0.6].map((x) => (
        <group key={x} position={[x, 0.56, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.18, 0.06, 14]} />
            <meshStandardMaterial color="#f4ecdb" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.15, 0.17, 0.08, 14]} />
            <meshStandardMaterial color="#e3a548" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Homes({ slots, occupiedResting }: { slots: Vec2[]; occupiedResting: boolean[] }) {
  return (
    <>
      {slots.map((p, i) => (
        <group key={i} position={[p[0], 0, p[1]]} rotation={[0, facePlaza(p), 0]}>
          <Cottage occupied resting={occupiedResting[i] ?? false} />
          <mesh position={[0.9, 0.18, 0.9]} castShadow>
            <boxGeometry args={[0.7, 0.08, 0.26]} />
            <meshStandardMaterial color={C.wood} roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------- Hülle mit Grundfläche, Auswahl und Schild ----------

function BuildingModel({ type, working }: { type: string; working: boolean }) {
  switch (type) {
    case 'lumberCamp': return <LumberCamp working={working} />;
    case 'quarry': return <Quarry working={working} />;
    case 'clayPit': return <ClayPit working={working} />;
    case 'berryFarm': return <BerryFarm />;
    case 'wheatField': return <CropField color={C.wheat} seed={11} working={working} />;
    case 'flaxField': return <CropField color={C.flax} flowerColor={C.flaxFlower} seed={23} working={working} />;
    case 'sawmill': return <Sawmill working={working} />;
    case 'brickKiln': return <BrickKiln working={working} />;
    case 'weavery': return <Weavery working={working} />;
    case 'kitchen': return <Kitchen working={working} />;
    default: return null;
  }
}

function Ring({ radius, color, speed }: { radius: number; color: string; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * speed) * 0.03;
    ref.current.scale.set(s, s, 1);
  });
  return (
    <mesh ref={ref} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.08, 8, 48]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.4} />
    </mesh>
  );
}

const STATUS_DOT: Record<Building['status'], string> = {
  idle: '#b9a98a',
  working: '#7bbf4a',
  missingInputs: '#d9724a',
  full: '#e9b949',
};

export function BuildingPlot({
  building, def, selected, canAssign, onClick, onCollect,
}: {
  building: Building;
  def: BuildingDef;
  selected: boolean;
  canAssign: boolean;
  onClick: (id: string) => void;
  onCollect: (id: string) => void;
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
    <group position={[plot.pos[0], 0, plot.pos[1]]} rotation={[0, facePlaza(plot.pos), 0]}>
      <mesh position={[0, 0.006, 0]} receiveShadow onClick={click}>
        <cylinderGeometry args={[plot.radius, plot.radius, 0.012, 36]} />
        <meshStandardMaterial color={hover ? C.grassLight : '#9acb62'} roughness={1} />
      </mesh>
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
        <BuildingModel type={building.type} working={working} />
      </group>
      <Html portal={portal} position={[0, plot.labelHeight, 0]} center distanceFactor={9} zIndexRange={[30, 0]}>
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
