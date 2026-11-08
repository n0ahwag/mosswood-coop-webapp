// Kleine verspielte Details: Wimpelketten über dem Dorfplatz, Vögel um die Gipfel,
// Schmetterlinge über den Wiesen.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clothMat } from './Buildings';
import { worldTime } from './clock';
import { heightAt, HOME_SLOTS, mulberry32, PLAZA_RADIUS, VILLAGE, type Vec3 } from './layout';
import { cyl, mats, sphere } from './materials';

const FLAG_COLORS = ['#ff7a6b', '#ffd25e', '#6ccff6', '#8ee07a', '#c99bf2', '#ffa64d'];

let flagGeo: THREE.BufferGeometry | null = null;
function pennant() {
  if (flagGeo) return flagGeo;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
  g.computeVertexNormals();
  flagGeo = g;
  return g;
}

/** Wimpelkette zwischen zwei Punkten mit leichtem Durchhang. */
export function Bunting({ from, to, sag = 0.5 }: { from: Vec3; to: Vec3; sag?: number }) {
  const m = mats();
  const flags = useRef<(THREE.Mesh | null)[]>([]);
  const { tube, points, dir } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const n = Math.max(4, Math.round(a.distanceTo(b) / 0.42));
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
    });
    return {
      tube: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 3, 0.012, 5),
      points: pts.slice(1, -1),
      dir: Math.atan2(b.x - a.x, b.z - a.z),
    };
  }, [from, to, sag]);
  useFrame(() => {
    const t = worldTime.value;
    flags.current.forEach((f, i) => {
      if (f) f.rotation.x = Math.sin(t * 3 + i * 0.9) * 0.35;
    });
  });
  return (
    <group>
      <mesh geometry={tube} material={m.rope} />
      {points.map((p, i) => (
        <group key={i} position={p} rotation={[0, dir + Math.PI / 2, 0]}>
          <mesh ref={(f) => { flags.current[i] = f; }} geometry={pennant()} material={clothMat(FLAG_COLORS[i % FLAG_COLORS.length])} castShadow />
        </group>
      ))}
    </group>
  );
}

function FlagPole({ position, color }: { position: Vec3; color: string }) {
  const m = mats();
  const flag = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (flag.current) flag.current.rotation.y = Math.sin(worldTime.value * 2.2 + position[0]) * 0.3;
  });
  return (
    <group position={position}>
      <mesh geometry={cyl(0.05, 0.07, 3.6, 12)} material={m.timber} position={[0, 1.8, 0]} castShadow />
      <mesh geometry={sphere(0.09, 12, 8)} material={m.gold} position={[0, 3.65, 0]} />
      <mesh ref={flag} position={[0, 3.3, 0]}>
        <boxGeometry args={[0.02, 0.4, 0.62]} />
        <primitive object={clothMat(color)} attach="material" />
      </mesh>
    </group>
  );
}

/** Fahnen und Wimpelketten rund um den Dorfplatz. */
export function VillageFestive() {
  const y = VILLAGE.y;
  const [cx, cz] = VILLAGE.pos;
  const poleAt = (a: number): Vec3 => [cx + Math.cos(a) * (PLAZA_RADIUS + 0.45), y, cz + Math.sin(a) * (PLAZA_RADIUS + 0.45)];
  // links und rechts am Platz (aus Kamerasicht), damit die Masten weder Brunnen noch Hütten verdecken
  const poleA = poleAt(Math.PI);
  const poleB = poleAt(0);
  const top = (p: Vec3): Vec3 => [p[0], p[1] + 3.45, p[2]];
  const home = (i: number): Vec3 => {
    const h = HOME_SLOTS[i];
    return [h[0], y + 1.55, h[1]];
  };
  return (
    <group>
      <FlagPole position={poleA} color={FLAG_COLORS[0]} />
      <FlagPole position={poleB} color={FLAG_COLORS[2]} />
      <Bunting from={top(poleA)} to={top(poleB)} sag={0.45} />
      <Bunting from={top(poleA)} to={home(3)} sag={0.3} />
      <Bunting from={top(poleB)} to={home(0)} sag={0.3} />
    </group>
  );
}

// ---------- Vögel ----------

function Bird({ seed }: { seed: number }) {
  const g = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const cfg = useMemo(() => {
    const rng = mulberry32(seed);
    return {
      r: 9 + rng() * 12,
      y: 11 + rng() * 6,
      speed: (0.12 + rng() * 0.1) * (rng() < 0.5 ? 1 : -1),
      phase: rng() * Math.PI * 2,
      cx: (rng() - 0.5) * 8,
      cz: (rng() - 0.5) * 8,
    };
  }, [seed]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fdfaf2', roughness: 0.7, side: THREE.DoubleSide }), []);
  useFrame(() => {
    const t = worldTime.value;
    const a = cfg.phase + t * cfg.speed;
    if (g.current) {
      g.current.position.set(cfg.cx + Math.cos(a) * cfg.r, cfg.y + Math.sin(t * 0.7 + seed) * 0.8, cfg.cz + Math.sin(a) * cfg.r);
      g.current.rotation.y = -a + (cfg.speed > 0 ? 0 : Math.PI);
    }
    const flap = Math.sin(t * 9 + seed) * 0.6;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });
  return (
    <group ref={g}>
      <mesh geometry={sphere(0.12, 10, 8)} material={mat} scale={[1, 0.8, 1.8]} />
      {/* Flügel drehen am Körper, deshalb sitzt jedes Flügel-Mesh um die halbe Breite versetzt in einer Gruppe */}
      <group ref={wingL} position={[0.06, 0, 0]}>
        <mesh material={mat} position={[0.27, 0, 0]}>
          <boxGeometry args={[0.55, 0.015, 0.22]} />
        </mesh>
      </group>
      <group ref={wingR} position={[-0.06, 0, 0]}>
        <mesh material={mat} position={[-0.27, 0, 0]}>
          <boxGeometry args={[0.55, 0.015, 0.22]} />
        </mesh>
      </group>
    </group>
  );
}

export function Birds({ count = 7 }: { count?: number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Bird key={i} seed={i * 97 + 13} />
      ))}
    </group>
  );
}

// ---------- Schmetterlinge ----------

function Butterfly({ seed, center }: { seed: number; center: [number, number] }) {
  const g = useRef<THREE.Group>(null);
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  const cfg = useMemo(() => {
    const rng = mulberry32(seed);
    return { a: rng() * 6, r: 1.2 + rng() * 2.2, s: 0.4 + rng() * 0.4, color: FLAG_COLORS[Math.floor(rng() * FLAG_COLORS.length)] };
  }, [seed]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.5, side: THREE.DoubleSide, emissive: cfg.color, emissiveIntensity: 0.15 }), [cfg.color]);
  useFrame(() => {
    const t = worldTime.value;
    const a = cfg.a + t * cfg.s;
    const x = center[0] + Math.cos(a) * cfg.r + Math.sin(t * 1.7 + seed) * 0.4;
    const z = center[1] + Math.sin(a * 1.3) * cfg.r;
    if (g.current) {
      g.current.position.set(x, heightAt(x, z) + 0.7 + Math.sin(t * 2.3 + seed) * 0.25, z);
      g.current.rotation.y = -a;
    }
    const flap = Math.sin(t * 16 + seed) * 0.9;
    if (l.current) l.current.rotation.z = 0.2 + flap;
    if (r.current) r.current.rotation.z = -0.2 - flap;
  });
  return (
    <group ref={g} scale={0.9}>
      <group ref={l}>
        <mesh material={mat} position={[0.09, 0, 0]}>
          <boxGeometry args={[0.18, 0.008, 0.14]} />
        </mesh>
      </group>
      <group ref={r}>
        <mesh material={mat} position={[-0.09, 0, 0]}>
          <boxGeometry args={[0.18, 0.008, 0.14]} />
        </mesh>
      </group>
    </group>
  );
}

export function Butterflies({ spots }: { spots: [number, number][] }) {
  return (
    <group>
      {spots.flatMap((c, i) => [0, 1].map((k) => <Butterfly key={`${i}-${k}`} seed={i * 31 + k * 7 + 3} center={c} />))}
    </group>
  );
}
