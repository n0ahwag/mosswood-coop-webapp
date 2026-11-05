import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import {
  distToSegment, HOME_SLOTS, ISLAND_RADIUS, mulberry32, PLAZA_RADIUS, PLOTS, RIVER_POINTS,
  TABLE_POS, type Vec2,
} from './layout';
import { C } from './palette';

// ---------- Fluss-Hilfen ----------

const riverCurve = new THREE.CatmullRomCurve3(
  RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);
const riverSamples: Vec2[] = Array.from({ length: 48 }, (_, i) => {
  const p = riverCurve.getPointAt(i / 47);
  return [p.x, p.z];
});

export function distToRiver(p: Vec2) {
  let best = Infinity;
  for (let i = 0; i < riverSamples.length - 1; i++) {
    best = Math.min(best, distToSegment(p, riverSamples[i], riverSamples[i + 1]));
  }
  return best;
}

function ribbon(width: number, y: number, segments = 90) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = riverCurve.getPointAt(t);
    const tan = riverCurve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    // an Quelle und Mündung etwas schmaler
    const w = (width / 2) * (0.75 + 0.25 * Math.sin(Math.min(1, t * 6) * Math.PI * 0.5));
    positions.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
    uvs.push(0, t, 1, t);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Insel ----------

export function Island() {
  const hangingRocks = useMemo(() => {
    const rng = mulberry32(7);
    return Array.from({ length: 14 }, () => {
      const a = rng() * Math.PI * 2;
      const r = 8 + rng() * 5;
      return {
        pos: [Math.cos(a) * r, -2.6 - rng() * 2.5, Math.sin(a) * r] as [number, number, number],
        scale: 0.8 + rng() * 1.6,
        rot: rng() * Math.PI,
      };
    });
  }, []);

  return (
    <group>
      {/* Wiese */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS, 0.6, 64]} />
        <meshStandardMaterial color={C.grass} roughness={1} />
      </mesh>
      {/* Grasrand */}
      <mesh position={[0, -0.62, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS + 0.25, ISLAND_RADIUS + 0.1, 0.35, 40]} />
        <meshStandardMaterial color={C.grassDark} roughness={1} flatShading />
      </mesh>
      {/* Erdkante */}
      <mesh position={[0, -1.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS + 0.05, ISLAND_RADIUS - 1.4, 1.8, 26]} />
        <meshStandardMaterial color={C.dirt} roughness={1} flatShading />
      </mesh>
      {/* Felsunterseite */}
      <mesh position={[0, -6, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[ISLAND_RADIUS - 1.4, 7, 13, 3]} />
        <meshStandardMaterial color={C.rockUnder} roughness={1} flatShading />
      </mesh>
      {hangingRocks.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={[r.rot, r.rot * 2, 0]} scale={r.scale} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={i % 2 ? C.dirtDark : C.rockUnder} roughness={1} flatShading />
        </mesh>
      ))}
      <Hills />
    </group>
  );
}

function Hills() {
  const hills: { pos: [number, number, number]; scale: [number, number, number] }[] = [
    { pos: [-12.6, -0.55, 0.8], scale: [3.2, 1.3, 2.8] },
    { pos: [0.8, -0.6, -12.8], scale: [4.2, 1.2, 2] },
    { pos: [12.4, -0.6, -9.5], scale: [2.4, 1.1, 2.2] },
    { pos: [-9.5, -0.6, 10.5], scale: [3, 1.1, 2.2] },
  ];
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} position={h.pos} scale={h.scale} receiveShadow castShadow>
          <sphereGeometry args={[1, 20, 12]} />
          <meshStandardMaterial color={i % 2 ? C.grassLight : C.grass} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

// ---------- Fluss, Teich, Wasserfall ----------

export function River() {
  const bank = useMemo(() => ribbon(2.6, 0.012), []);
  const water = useMemo(() => ribbon(1.7, 0.035), []);
  const foam = useRef<(THREE.Mesh | null)[]>([]);
  const fall = useRef<(THREE.Mesh | null)[]>([]);

  const end = riverCurve.getPointAt(1);
  const endTan = riverCurve.getTangentAt(1);
  const fallRot = Math.atan2(endTan.x, endTan.z);
  const start = riverCurve.getPointAt(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    foam.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.035 + i / foam.current.length) % 1;
      const p = riverCurve.getPointAt(u);
      const tan = riverCurve.getTangentAt(u);
      const side = Math.sin(i * 12.9 + t * 0.6) * 0.45;
      m.position.set(p.x - tan.z * side, 0.05, p.z + tan.x * side);
      const s = 0.6 + Math.sin(t * 3 + i) * 0.25;
      m.scale.set(s, 0.3, s * 1.6);
      m.rotation.y = Math.atan2(tan.x, tan.z);
    });
    fall.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.5 + i / fall.current.length) % 1;
      m.position.y = -u * 6.5;
      const s = 0.25 + u * 0.35;
      m.scale.setScalar(s);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.85 * (1 - u);
    });
  });

  return (
    <group>
      <mesh geometry={bank} receiveShadow>
        <meshStandardMaterial color={C.path} roughness={1} />
      </mesh>
      <mesh geometry={water}>
        <meshStandardMaterial color={C.water} roughness={0.15} metalness={0.05} transparent opacity={0.92} />
      </mesh>
      {/* Quellteich */}
      <mesh position={[start.x, 0.03, start.z]}>
        <cylinderGeometry args={[1.25, 1.25, 0.02, 28]} />
        <meshStandardMaterial color={C.waterDeep} roughness={0.15} />
      </mesh>
      <mesh position={[start.x, 0.012, start.z]} receiveShadow>
        <cylinderGeometry args={[1.75, 1.75, 0.02, 28]} />
        <meshStandardMaterial color={C.path} roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 1.6 + 2.2;
        return (
          <mesh
            key={i}
            position={[start.x + Math.cos(a) * 1.55, 0.15, start.z + Math.sin(a) * 1.55]}
            scale={[0.38, 0.28, 0.32]}
            rotation={[0, a, 0]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={C.stone} roughness={1} flatShading />
          </mesh>
        );
      })}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} ref={(m) => { foam.current[i] = m; }}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshStandardMaterial color={C.foam} roughness={0.4} transparent opacity={0.8} />
        </mesh>
      ))}
      {/* Wasserfall über die Inselkante */}
      <group position={[end.x, 0, end.z]} rotation={[0, fallRot, 0]}>
        <mesh position={[0, -3.2, 0.25]}>
          <boxGeometry args={[1.35, 6.5, 0.12]} />
          <meshStandardMaterial color={C.water} roughness={0.2} transparent opacity={0.7} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={i}
            ref={(m) => { fall.current[i] = m; }}
            position={[((i % 4) - 1.5) * 0.35, 0, 0.4]}
          >
            <sphereGeometry args={[0.5, 8, 6]} />
            <meshStandardMaterial color={C.foam} transparent opacity={0.8} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Bäume, Steine, Blumen ----------

function isFree(p: Vec2, placed: Vec2[], minGap: number) {
  if (Math.hypot(p[0], p[1]) < PLAZA_RADIUS + 1.3) return false;
  if (Math.hypot(p[0], p[1]) > ISLAND_RADIUS - 0.9) return false;
  for (const plot of Object.values(PLOTS)) {
    if (Math.hypot(p[0] - plot.pos[0], p[1] - plot.pos[1]) < plot.radius + 0.9) return false;
    if (distToSegment(p, [0, 0], plot.pos) < 1.1) return false;
  }
  for (const h of HOME_SLOTS) {
    if (Math.hypot(p[0] - h[0], p[1] - h[1]) < 2) return false;
    if (distToSegment(p, [0, 0], h) < 0.9) return false;
  }
  if (Math.hypot(p[0] - TABLE_POS[0], p[1] - TABLE_POS[1]) < 1.8) return false;
  if (distToRiver(p) < 2) return false;
  return placed.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > minGap);
}

interface TreeData {
  pos: Vec2;
  scale: number;
  color: string;
  blobs: { y: number; x: number; z: number; r: number }[];
  trunk: number;
}

export function Trees() {
  const trees = useMemo(() => {
    const rng = mulberry32(42);
    const placed: Vec2[] = [];
    const out: TreeData[] = [];
    const tryPlace = (p: Vec2) => {
      if (!isFree(p, placed, 1.35)) return;
      placed.push(p);
      const blobCount = 2 + Math.floor(rng() * 2);
      out.push({
        pos: p,
        scale: 0.75 + rng() * 0.55,
        color: C.leaf[Math.floor(rng() * C.leaf.length)],
        trunk: 0.7 + rng() * 0.4,
        blobs: Array.from({ length: blobCount }, (_, i) => ({
          x: (rng() - 0.5) * 0.5,
          z: (rng() - 0.5) * 0.5,
          y: 1.25 + i * 0.45 + rng() * 0.15,
          r: 0.75 - i * 0.14 + rng() * 0.12,
        })),
      });
    };
    // kleiner Wald hinter der Holzfällerhütte
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 3.6;
      tryPlace([-12 + Math.cos(a) * r, -6.5 + Math.sin(a) * r]);
    }
    for (let i = 0; i < 260; i++) {
      const a = rng() * Math.PI * 2;
      const r = 4 + Math.sqrt(rng()) * 10.5;
      tryPlace([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
  }, []);

  // Alle Stämme und alle Baumkronen als je ein InstancedMesh: zwei Draw-Calls statt Hunderten.
  const { trunks, crowns } = useMemo(() => {
    const trunkList: InstanceData[] = [];
    const crownList: InstanceData[] = [];
    for (const t of trees) {
      trunkList.push({
        pos: [t.pos[0], (t.trunk / 2) * t.scale, t.pos[1]],
        scale: [t.scale, (t.trunk + 0.4) * t.scale, t.scale],
        color: C.trunk,
      });
      for (const b of t.blobs) {
        crownList.push({
          pos: [t.pos[0] + b.x * t.scale, b.y * t.scale, t.pos[1] + b.z * t.scale],
          scale: [b.r * t.scale, b.r * t.scale, b.r * t.scale],
          rot: b.x * 3,
          color: t.color,
        });
      }
    }
    return { trunks: trunkList, crowns: crownList };
  }, [trees]);

  return (
    <group>
      <InstancedSet items={trunks} castShadow>
        <cylinderGeometry args={[0.11, 0.17, 1, 6]} />
        <meshStandardMaterial roughness={1} flatShading />
      </InstancedSet>
      <InstancedSet items={crowns} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </InstancedSet>
    </group>
  );
}

interface InstanceData {
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: number;
  color: string;
}

/** Zeichnet viele gleichförmige Objekte mit einem einzigen Draw-Call. */
function InstancedSet({
  items, children, castShadow, receiveShadow,
}: {
  items: InstanceData[];
  children: ReactNode;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot ?? 0);
      m.compose(new THREE.Vector3(...it.pos), q, new THREE.Vector3(...it.scale));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </instancedMesh>
  );
}

export function Rocks() {
  const rocks = useMemo(() => {
    const rng = mulberry32(99);
    const out: { pos: Vec2; s: [number, number, number]; rot: number; c: string }[] = [];
    const placed: Vec2[] = [];
    const add = (p: Vec2, size: number) => {
      if (!isFree(p, placed, 1)) return;
      placed.push(p);
      out.push({
        pos: p,
        s: [size * (0.8 + rng() * 0.5), size * (0.55 + rng() * 0.3), size * (0.8 + rng() * 0.4)],
        rot: rng() * Math.PI,
        c: rng() > 0.5 ? C.stone : C.stoneDark,
      });
    };
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2;
      const r = 3 + rng() * 2.5;
      add([8 + Math.cos(a) * r, -7 + Math.sin(a) * r], 0.35 + rng() * 0.45);
    }
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2;
      const r = 5 + rng() * 9;
      add([Math.cos(a) * r, Math.sin(a) * r], 0.2 + rng() * 0.3);
    }
    return out;
  }, []);

  const items = useMemo<InstanceData[]>(
    () => rocks.map((r) => ({ pos: [r.pos[0], r.s[1] * 0.35, r.pos[1]], scale: r.s, rot: r.rot, color: r.c })),
    [rocks],
  );

  return (
    <InstancedSet items={items} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={1} flatShading />
    </InstancedSet>
  );
}

const FLOWER_COLORS = ['#f6a6b8', '#fbe27a', '#ffffff', '#c7a4f0', '#f48b6a'];

export function Flowers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const rng = mulberry32(5);
    const out: { pos: Vec2; c: string; s: number }[] = [];
    for (let i = 0; i < 600 && out.length < 220; i++) {
      const a = rng() * Math.PI * 2;
      const r = 3.5 + Math.sqrt(rng()) * 11;
      const p: Vec2 = [Math.cos(a) * r, Math.sin(a) * r];
      if (!isFree(p, [], 0)) continue;
      out.push({ pos: p, c: FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)], s: 0.6 + rng() * 0.6 });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    data.forEach((f, i) => {
      m.compose(
        new THREE.Vector3(f.pos[0], 0.08, f.pos[1]),
        new THREE.Quaternion(),
        new THREE.Vector3(f.s, f.s * 0.8, f.s),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(f.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]}>
      <icosahedronGeometry args={[0.09, 0]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

// ---------- Wege, Dorfplatz, Brunnen ----------

function PathStrip({ from, to, width = 0.95 }: { from: Vec2; to: Vec2; width?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  return (
    <mesh
      position={[(from[0] + to[0]) / 2, 0.008, (from[1] + to[1]) / 2]}
      rotation={[0, Math.atan2(dx, dz), 0]}
      receiveShadow
    >
      <boxGeometry args={[width, 0.016, len]} />
      <meshStandardMaterial color={C.path} roughness={1} />
    </mesh>
  );
}

export function Paths({ homeCount }: { homeCount: number }) {
  return (
    <group>
      {Object.values(PLOTS).map((plot, i) => (
        <PathStrip key={i} from={[0, 0]} to={plot.pos} />
      ))}
      {HOME_SLOTS.slice(0, homeCount).map((h, i) => (
        <PathStrip key={`h${i}`} from={[0, 0]} to={h} width={0.7} />
      ))}
      <PathStrip from={PLOTS.kitchen.pos} to={TABLE_POS} width={0.7} />
    </group>
  );
}

const COBBLES: InstanceData[] = Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * Math.PI * 2;
  return {
    pos: [Math.cos(a) * (PLAZA_RADIUS + 0.12), 0.05, Math.sin(a) * (PLAZA_RADIUS + 0.12)],
    scale: [1, 1, 1],
    rot: Math.PI / 2 - a,
    color: i % 2 ? C.stone : C.stoneDark,
  };
});

export function Plaza() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[PLAZA_RADIUS + 0.3, PLAZA_RADIUS + 0.3, 0.03, 40]} />
        <meshStandardMaterial color={C.cobble} roughness={1} />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[PLAZA_RADIUS, PLAZA_RADIUS, 0.03, 40]} />
        <meshStandardMaterial color={C.plaza} roughness={1} />
      </mesh>
      {/* Pflastersteine am Rand */}
      <InstancedSet items={COBBLES} receiveShadow>
        <boxGeometry args={[0.46, 0.05, 0.22]} />
        <meshStandardMaterial roughness={1} />
      </InstancedSet>
      <Well />
      <Lantern position={[1.9, 0, -1.6]} />
      <Lantern position={[-1.9, 0, 1.6]} />
    </group>
  );
}

function Well() {
  const roof = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.85, 0);
    s.lineTo(0.85, 0);
    s.lineTo(0, 0.6);
    s.closePath();
    return s;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.8, 0.6, 14]} />
        <meshStandardMaterial color={C.stone} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 14]} />
        <meshStandardMaterial color={C.waterDeep} roughness={0.2} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 1.05, 0]} castShadow>
          <boxGeometry args={[0.1, 1.2, 0.1]} />
          <meshStandardMaterial color={C.timber} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
        <meshStandardMaterial color={C.wood} roughness={1} />
      </mesh>
      <mesh position={[0, 1.6, -0.55]} castShadow>
        <extrudeGeometry args={[roof, { depth: 1.1, bevelEnabled: false }]} />
        <meshStandardMaterial color={C.terracotta} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0.2, 1.1, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.18, 8]} />
        <meshStandardMaterial color={C.woodLight} roughness={1} />
      </mesh>
    </group>
  );
}

export function Lantern({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
        <meshStandardMaterial color={C.timber} roughness={1} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.24, 0.3, 0.24]} />
        <meshStandardMaterial color={C.window} emissive={C.window} emissiveIntensity={0.9} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.2, 0.16, 4]} />
        <meshStandardMaterial color={C.timber} roughness={1} />
      </mesh>
    </group>
  );
}

// ---------- Wolken und Schwebefelsen ----------

export function Clouds() {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const rng = mulberry32(3);
    return Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + rng();
      const r = 30 + rng() * 8;
      return {
        pos: [Math.cos(a) * r, 7 + rng() * 6, Math.sin(a) * r] as [number, number, number],
        puffs: Array.from({ length: 4 + Math.floor(rng() * 3) }, (_, j) => ({
          x: (j - 2) * 0.9 + rng() * 0.4,
          y: rng() * 0.5,
          z: (rng() - 0.5) * 0.8,
          r: 0.8 + rng() * 0.7,
        })),
      };
    });
  }, []);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.012;
  });

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={c.pos}>
          {c.puffs.map((p, j) => (
            <mesh key={j} position={[p.x, p.y, p.z]}>
              <icosahedronGeometry args={[p.r, 1]} />
              <meshStandardMaterial color="#ffffff" roughness={1} flatShading transparent opacity={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function FloatingIslets() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const islets: { pos: [number, number, number]; s: number }[] = [
    { pos: [-19, -1.5, -8], s: 1.4 },
    { pos: [18, -3, 9], s: 1 },
    { pos: [-6, -4, 20], s: 0.8 },
  ];
  useFrame(({ clock }) => {
    refs.current.forEach((g, i) => {
      if (g) g.position.y = islets[i].pos[1] + Math.sin(clock.elapsedTime * 0.5 + i * 2) * 0.35;
    });
  });
  return (
    <>
      {islets.map((it, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }} position={it.pos} scale={it.s}>
          <mesh position={[0, 0, 0]} receiveShadow>
            <cylinderGeometry args={[1.4, 1.3, 0.35, 12]} />
            <meshStandardMaterial color={C.grass} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1.3, 2, 8]} />
            <meshStandardMaterial color={C.rockUnder} roughness={1} flatShading />
          </mesh>
          <mesh position={[0.2, 0.9, 0]} castShadow>
            <icosahedronGeometry args={[0.6, 1]} />
            <meshStandardMaterial color={C.leaf[i % C.leaf.length]} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0.2, 0.35, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 0.5, 6]} />
            <meshStandardMaterial color={C.trunk} roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
}
