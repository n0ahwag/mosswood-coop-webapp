// Baukasten für Häuser und Kleinteile: Fachwerk, Ziegeldach, Fensterläden, Blumenkästen.
// Alle Teile nutzen die gemeinsamen Materialien mit Texturen und Relief.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { box, cyl, mats, roofSlab, sphere, type Mats } from './materials';
import { softDotTexture } from './textures';

type V3 = [number, number, number];
type MatKey = keyof Mats;

// ---------- Rauch aus dem Schornstein ----------

export function Smoke({ position, active = true, size = 1 }: { position: V3; active?: boolean; size?: number }) {
  const puffs = useRef<(THREE.Sprite | null)[]>([]);
  const strength = useRef(active ? 1 : 0);
  const map = softDotTexture();
  useFrame(({ clock }, delta) => {
    strength.current = THREE.MathUtils.damp(strength.current, active ? 1 : 0, 1.5, delta);
    const t = clock.elapsedTime;
    puffs.current.forEach((s, i) => {
      if (!s) return;
      const u = (t * 0.28 + i / puffs.current.length) % 1;
      s.position.set(Math.sin(u * 4 + i) * 0.14 + u * 0.4, u * 2.1 * size, Math.cos(u * 3 + i) * 0.1);
      s.scale.setScalar((0.3 + u * 0.9) * size);
      const mat = s.material as THREE.SpriteMaterial;
      mat.opacity = Math.min(u * 5, 1) * (1 - u) * 0.75 * strength.current;
      s.visible = mat.opacity > 0.01;
    });
  });
  return (
    <group position={position}>
      {Array.from({ length: 6 }, (_, i) => (
        <sprite key={i} ref={(s) => { puffs.current[i] = s; }}>
          <spriteMaterial map={map} color="#f4f1ec" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

// ---------- Kleinteile ----------

export function Window({
  position, lit = true, rotY = 0, shutters = 'woodGreen', w = 0.5, h = 0.56,
}: { position: V3; lit?: boolean; rotY?: number; shutters?: MatKey | null; w?: number; h?: number }) {
  const m = mats();
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={box(w + 0.1, h + 0.1, 0.08, 0.02)} material={m.timber} />
      <mesh geometry={box(w - 0.04, h - 0.04, 0.04, 0)} material={lit ? m.window : m.windowDim} position={[0, 0, 0.025]} />
      <mesh geometry={box(0.035, h - 0.04, 0.03, 0)} material={m.timber} position={[0, 0, 0.055]} />
      <mesh geometry={box(w - 0.04, 0.035, 0.03, 0)} material={m.timber} position={[0, 0.02, 0.055]} />
      <mesh geometry={box(w + 0.2, 0.06, 0.16, 0.02)} material={m.beam} position={[0, -h / 2 - 0.06, 0.06]} />
      {shutters &&
        [-1, 1].map((s) => (
          <mesh
            key={s}
            geometry={box(w * 0.52, h + 0.04, 0.04, 0.01)}
            material={m[shutters]}
            position={[s * (w * 0.78 + 0.06), 0, 0.06]}
            rotation={[0, s * 0.35, 0]}
          />
        ))}
    </group>
  );
}

const PETALS = ['#f48ba0', '#fbe27a', '#f9f6ff', '#e85d5d', '#c7a4f0'];

export function FlowerBox({ position, rotY = 0, width = 0.6 }: { position: V3; rotY?: number; width?: number }) {
  const m = mats();
  const flowers = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ x: (i / 4 - 0.5) * (width - 0.12), c: PETALS[(i * 3) % PETALS.length] })), [width]);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={box(width, 0.15, 0.2, 0.02)} material={m.woodDark} castShadow />
      {flowers.map((f, i) => (
        <group key={i} position={[f.x, 0.1, 0]}>
          <mesh geometry={sphere(0.075, 12, 8)} scale={[1, 0.8, 1]}>
            <meshStandardMaterial color="#5f9a3e" roughness={0.9} />
          </mesh>
          <mesh geometry={sphere(0.05, 10, 8)} position={[0, 0.07, 0.03]}>
            <meshStandardMaterial color={f.c} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Barrel({ position, scale = 1 }: { position: V3; scale?: number }) {
  const m = mats();
  const staves = useMemo(() => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return new THREE.Vector2(0.25 + Math.sin(t * Math.PI) * 0.05, t * 0.62);
    });
    const g = new THREE.LatheGeometry(pts, 24);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.7, uv.getY(i) * 0.62);
    return g;
  }, []);
  return (
    <group position={position} scale={scale}>
      <mesh geometry={staves} material={m.wood} castShadow />
      <mesh geometry={cyl(0.25, 0.25, 0.02, 24)} material={m.woodLight} position={[0, 0.61, 0]} />
      {[0.1, 0.52].map((y) => (
        <mesh key={y} geometry={cyl(0.29, 0.29, 0.045, 24, true)} material={m.iron} position={[0, y, 0]} />
      ))}
    </group>
  );
}

export function Pot({ position, scale = 1, color }: { position: V3; scale?: number; color?: string }) {
  const m = mats();
  const geo = useMemo(() => {
    const pts = [
      [0, 0], [0.16, 0], [0.24, 0.1], [0.27, 0.24], [0.2, 0.38], [0.13, 0.44], [0.16, 0.5], [0.14, 0.52],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 24);
  }, []);
  return (
    <mesh geometry={geo} material={color ? undefined : m.clay} position={position} scale={scale} castShadow>
      {color && <meshStandardMaterial color={color} roughness={0.8} />}
    </mesh>
  );
}

export function Log({ position, rotation = [0, 0, Math.PI / 2], length = 1.2, radius = 0.16 }: {
  position: V3;
  rotation?: V3;
  length?: number;
  radius?: number;
}) {
  const m = mats();
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={cyl(radius, radius, length, 16, true)} material={m.log} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cyl(radius * 0.98, radius * 0.98, 0.02, 16)} material={m.logEnd} position={[0, (s * length) / 2, 0]} />
      ))}
    </group>
  );
}

export function LogPile({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  const logs: V3[] = [[-0.34, 0.16, 0], [0, 0.16, 0], [0.34, 0.16, 0], [-0.17, 0.45, 0], [0.17, 0.45, 0], [0, 0.73, 0]];
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {logs.map((p, i) => (
        <Log key={i} position={p} rotation={[Math.PI / 2, 0, 0]} length={1.3 - (i % 2) * 0.08} />
      ))}
    </group>
  );
}

export function Fence({ from, to, posts = 4 }: { from: [number, number]; to: [number, number]; posts?: number }) {
  const m = mats();
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const rot = Math.atan2(dx, dz);
  return (
    <group position={[from[0], 0, from[1]]} rotation={[0, rot, 0]}>
      {Array.from({ length: posts }, (_, i) => (
        <group key={i} position={[0, 0, (i / (posts - 1)) * len]}>
          <mesh geometry={box(0.1, 0.62, 0.1, 0.02)} material={m.timber} position={[0, 0.31, 0]} castShadow />
          <mesh geometry={cyl(0.01, 0.075, 0.1, 4)} material={m.timber} position={[0, 0.67, 0]} rotation={[0, Math.PI / 4, 0]} />
        </group>
      ))}
      {[0.24, 0.46].map((y) => (
        <mesh key={y} geometry={box(0.04, 0.08, len, 0.015)} material={m.woodLight} position={[0, y, len / 2]} castShadow />
      ))}
    </group>
  );
}

// ---------- Das Haus ----------

export interface HouseProps {
  w?: number;
  d?: number;
  h?: number;
  roof?: MatKey;
  wall?: MatKey;
  timber?: boolean;
  chimney?: boolean;
  smoking?: boolean;
  smokeSize?: number;
  lit?: boolean;
  flowers?: boolean;
  shutters?: MatKey | null;
}

function gableShape(halfWidth: number, height: number) {
  const s = new THREE.Shape();
  s.moveTo(-halfWidth, 0);
  s.lineTo(halfWidth, 0);
  s.lineTo(0, height);
  s.closePath();
  return s;
}

export function House({
  w = 2.4, d = 2, h = 1.4, roof = 'roofRed', wall = 'plaster', timber = true, chimney = true,
  smoking = false, smokeSize = 1, lit = true, flowers = true, shutters = 'woodGreen',
}: HouseProps) {
  const m = mats();
  const base = 0.3;
  const roofH = h * 0.95;
  const overhang = 0.32;
  const top = base + h;
  const slope = useMemo(() => {
    const half = w / 2 + overhang;
    const angle = Math.atan2(roofH, w / 2);
    return { angle, length: half / Math.cos(angle) + 0.05 };
  }, [w, roofH]);
  const gable = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(gableShape(w / 2, roofH), { depth: d, bevelEnabled: false });
    // UVs der Giebelwand in Metern
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + pos.getZ(i), pos.getY(i));
    return g;
  }, [w, d, roofH]);

  const beam = 0.13;
  // Fachwerk: Ständer, Riegel und Streben auf den Längsseiten
  const frame: { p: V3; s: V3; r?: number }[] = [];
  if (timber) {
    for (const sz of [-1, 1]) {
      const z = (sz * d) / 2 + sz * 0.015;
      for (const fx of [-0.5, -0.17, 0.17, 0.5]) frame.push({ p: [fx * w, base + h / 2, z], s: [beam, h, 0.08] });
      frame.push({ p: [0, base + h * 0.5, z], s: [w, 0.1, 0.07] });
      frame.push({ p: [0, top - 0.05, z], s: [w + 0.12, 0.12, 0.09] });
      frame.push({ p: [0, base + 0.05, z], s: [w + 0.08, 0.1, 0.09] });
      // Streben (Andreaskreuz-Andeutung) außen
      for (const fx of [-1, 1]) {
        const len = Math.hypot(w * 0.33, h * 0.5);
        frame.push({ p: [fx * w * 0.335, base + h * 0.25, z], s: [0.08, len, 0.06], r: fx * Math.atan2(w * 0.33, h * 0.5) });
      }
    }
    for (const sx of [-1, 1]) {
      const x = (sx * w) / 2 + sx * 0.015;
      frame.push({ p: [x, base + h * 0.5, 0], s: [0.07, 0.1, d] });
      frame.push({ p: [x, top - 0.05, 0], s: [0.09, 0.12, d + 0.12] });
    }
  }

  return (
    <group>
      {/* Bruchsteinsockel */}
      <mesh geometry={box(w + 0.24, base, d + 0.24, 0.05)} material={m.stone} position={[0, base / 2, 0]} castShadow receiveShadow />
      {/* Wände */}
      <mesh geometry={box(w, h, d, 0.02)} material={m[wall]} position={[0, base + h / 2, 0]} castShadow receiveShadow />
      {frame.map((f, i) => (
        <mesh
          key={i}
          geometry={box(f.s[0], f.s[1], f.s[2], 0.015)}
          material={m.timber}
          position={f.p}
          rotation={f.r ? [0, 0, f.r] : undefined}
          castShadow
        />
      ))}
      {/* Giebeldreieck vorne und hinten */}
      <mesh geometry={gable} material={m[wall]} position={[0, top, -d / 2]} castShadow />
      {/* Dachflächen mit Ziegeln, Ortgang und First (Drehpunkt am First) */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[0, top + roofH, 0]} rotation={[0, 0, -sx * slope.angle]}>
          <mesh
            geometry={roofSlab(slope.length, 0.12, d + 0.62, sx < 0)}
            material={m[roof]}
            position={[(sx * slope.length) / 2 - sx * 0.03, 0.08, 0]}
            castShadow
            receiveShadow
          />
          {[-1, 1].map((sz) => (
            <mesh
              key={sz}
              geometry={box(slope.length, 0.18, 0.07, 0.02)}
              material={m.woodDark}
              position={[(sx * slope.length) / 2, 0.06, sz * (d / 2 + 0.31)]}
            />
          ))}
        </group>
      ))}
      <mesh geometry={cyl(0.1, 0.1, d + 0.72, 16)} material={m[roof]} position={[0, top + roofH + 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
      {/* Tür mit Rahmen, Klinke und Trittstein */}
      <group position={[0, base, d / 2 + 0.02]}>
        <mesh geometry={box(0.7, 1.02, 0.06, 0.02)} material={m.timber} position={[0, 0.51, 0]} />
        <mesh geometry={box(0.56, 0.92, 0.06, 0.015)} material={m.woodDark} position={[0, 0.46, 0.025]} />
        <mesh geometry={sphere(0.035, 10, 8)} material={m.gold} position={[0.18, 0.45, 0.08]} />
        <mesh geometry={box(0.8, 0.08, 0.36, 0.03)} material={m.stoneDark} position={[0, -base + 0.05, 0.22]} receiveShadow />
      </group>
      {/* Fenster vorne, hinten und seitlich */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Window position={[sx * w * 0.3, base + h * 0.64, d / 2 + 0.04]} lit={lit} shutters={shutters} />
          {flowers && <FlowerBox position={[sx * w * 0.3, base + h * 0.64 - 0.4, d / 2 + 0.13]} />}
          <Window position={[sx * w * 0.25, base + h * 0.64, -d / 2 - 0.04]} rotY={Math.PI} lit={lit} shutters={shutters} />
        </group>
      ))}
      <Window position={[w / 2 + 0.04, base + h * 0.62, 0]} rotY={Math.PI / 2} lit={lit} shutters={null} />
      <Window position={[-w / 2 - 0.04, base + h * 0.62, 0]} rotY={-Math.PI / 2} lit={lit} shutters={null} />
      {/* rundes Giebelfenster */}
      <mesh geometry={cyl(0.16, 0.16, 0.06, 20)} material={lit ? m.window : m.windowDim} position={[0, top + roofH * 0.38, d / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh position={[0, top + roofH * 0.38, d / 2 + 0.02]} material={m.timber}>
        <torusGeometry args={[0.17, 0.035, 8, 24]} />
      </mesh>
      {/* Schornstein */}
      {chimney && (
        <group position={[w * 0.26, top + roofH * 0.45, -d * 0.18]}>
          <mesh geometry={box(0.42, 1.1, 0.42, 0.03)} material={m.stone} position={[0, 0.38, 0]} castShadow />
          <mesh geometry={box(0.5, 0.1, 0.5, 0.02)} material={m.stoneDark} position={[0, 0.96, 0]} />
          <Smoke position={[0, 1.05, 0]} active={smoking} size={smokeSize} />
        </group>
      )}
    </group>
  );
}

/** Kleine Wohnhütte eines Dorfbewohners. */
export function Cottage({ occupied, resting, variant = 0 }: { occupied: boolean; resting: boolean; variant?: number }) {
  const roofs: MatKey[] = ['thatch', 'roofRed', 'roofSlate', 'roofMoss', 'roofDark'];
  const walls: MatKey[] = ['plasterWarm', 'plaster', 'plasterRose', 'plaster', 'plasterWarm'];
  const shutters: MatKey[] = ['woodGreen', 'woodBlue', 'woodRed', 'woodGreen', 'woodBlue'];
  const k = variant % roofs.length;
  return (
    <group scale={0.64}>
      <House w={2} d={1.8} h={1.25} roof={roofs[k]} wall={walls[k]} shutters={shutters[k]} smoking={occupied} lit={resting} smokeSize={0.8} />
    </group>
  );
}
