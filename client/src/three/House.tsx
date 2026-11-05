import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { C } from './palette';

type V3 = [number, number, number];

// ---------- Rauch aus dem Schornstein ----------

export function Smoke({ position, active = true, size = 1 }: { position: V3; active?: boolean; size?: number }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const strength = useRef(active ? 1 : 0);
  useFrame(({ clock }, delta) => {
    strength.current = THREE.MathUtils.damp(strength.current, active ? 1 : 0, 1.5, delta);
    const t = clock.elapsedTime;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.32 + i / puffs.current.length) % 1;
      m.position.set(Math.sin(u * 4 + i) * 0.12 + u * 0.35, u * 1.8 * size, Math.cos(u * 3 + i) * 0.08);
      m.scale.setScalar((0.14 + u * 0.38) * size);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.min(u * 6, 1) * (1 - u) * 0.8 * strength.current;
      m.visible = mat.opacity > 0.01;
    });
  });
  return (
    <group position={position}>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} ref={(m) => { puffs.current[i] = m; }}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={C.smoke} roughness={1} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Kleinteile ----------

export function Window({ position, lit = true, rotY = 0 }: { position: V3; lit?: boolean; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.06]} />
        <meshStandardMaterial color={C.timber} roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.38, 0.38, 0.06]} />
        <meshStandardMaterial color={C.window} emissive={C.window} emissiveIntensity={lit ? 0.75 : 0.15} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[0.04, 0.38, 0.02]} />
        <meshStandardMaterial color={C.timber} />
      </mesh>
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[0.38, 0.04, 0.02]} />
        <meshStandardMaterial color={C.timber} />
      </mesh>
    </group>
  );
}

const PETALS = ['#f48ba0', '#fbe27a', '#f4f0ff', '#e85d5d'];

export function FlowerBox({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.58, 0.14, 0.18]} />
        <meshStandardMaterial color={C.wood} roughness={1} />
      </mesh>
      {[-0.2, 0, 0.2].map((x, i) => (
        <group key={x} position={[x, 0.11, 0]}>
          <mesh>
            <icosahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color={C.leaf[1]} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, 0.07, 0.02]}>
            <icosahedronGeometry args={[0.055, 0]} />
            <meshStandardMaterial color={PETALS[i % PETALS.length]} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Barrel({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.6, 12]} />
        <meshStandardMaterial color={C.wood} roughness={1} />
      </mesh>
      {[0.12, 0.48].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.275, 0.275, 0.05, 12]} />
          <meshStandardMaterial color={C.timber} roughness={0.8} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

export function Pot({ position, scale = 1, color = C.clay }: { position: V3; scale?: number; color?: string }) {
  const geo = useMemo(() => {
    const pts = [
      [0, 0], [0.16, 0], [0.24, 0.1], [0.27, 0.24], [0.2, 0.38], [0.13, 0.44], [0.16, 0.5], [0.14, 0.52],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 12);
  }, []);
  return (
    <mesh geometry={geo} position={position} scale={scale} castShadow>
      <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Log({ position, rotation = [0, 0, Math.PI / 2], length = 1.2, radius = 0.16 }: {
  position: V3;
  rotation?: V3;
  length?: number;
  radius?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, length, 8]} />
        <meshStandardMaterial color={C.trunk} roughness={1} flatShading />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * length) / 2, 0]}>
          <cylinderGeometry args={[radius * 0.85, radius * 0.85, 0.02, 8]} />
          <meshStandardMaterial color={C.woodLight} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export function LogPile({ position, rotY = 0 }: { position: V3; rotY?: number }) {
  const logs: V3[] = [[-0.34, 0.16, 0], [0, 0.16, 0], [0.34, 0.16, 0], [-0.17, 0.45, 0], [0.17, 0.45, 0], [0, 0.73, 0]];
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {logs.map((p, i) => (
        <Log key={i} position={p} rotation={[Math.PI / 2, 0, 0]} length={1.3} />
      ))}
    </group>
  );
}

export function Fence({ from, to, posts = 4 }: { from: [number, number]; to: [number, number]; posts?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const rot = Math.atan2(dx, dz);
  return (
    <group position={[from[0], 0, from[1]]} rotation={[0, rot, 0]}>
      {Array.from({ length: posts }, (_, i) => (
        <mesh key={i} position={[0, 0.3, (i / (posts - 1)) * len]} castShadow>
          <boxGeometry args={[0.09, 0.6, 0.09]} />
          <meshStandardMaterial color={C.wood} roughness={1} />
        </mesh>
      ))}
      {[0.22, 0.45].map((y) => (
        <mesh key={y} position={[0, y, len / 2]} castShadow>
          <boxGeometry args={[0.05, 0.07, len]} />
          <meshStandardMaterial color={C.woodLight} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Das Haus ----------

export interface HouseProps {
  w?: number;
  d?: number;
  h?: number;
  roof?: string;
  wall?: string;
  timber?: boolean;
  chimney?: boolean;
  smoking?: boolean;
  smokeSize?: number;
  lit?: boolean;
  flowers?: boolean;
}

function gable(halfWidth: number, height: number) {
  const s = new THREE.Shape();
  s.moveTo(-halfWidth, 0);
  s.lineTo(halfWidth, 0);
  s.lineTo(0, height);
  s.closePath();
  return s;
}

export function House({
  w = 2.4, d = 2, h = 1.4, roof = C.terracotta, wall = C.plaster, timber = true, chimney = true,
  smoking = false, smokeSize = 1, lit = true, flowers = true,
}: HouseProps) {
  const base = 0.24;
  const roofH = h * 0.95;
  const roofSlope = useMemo(() => {
    const half = w / 2 + 0.35;
    return { half, angle: Math.atan2(roofH, half), length: Math.hypot(half, roofH) + 0.12 };
  }, [w, roofH]);
  const gableShape = useMemo(() => gable(w / 2, roofH), [w, roofH]);
  const top = base + h;

  return (
    <group>
      {/* Steinsockel */}
      <mesh position={[0, base / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.2, base, d + 0.2]} />
        <meshStandardMaterial color={C.stone} roughness={1} flatShading />
      </mesh>
      {/* Wände */}
      <mesh position={[0, base + h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      {/* Giebelwände */}
      <mesh position={[0, top, -d / 2]} castShadow>
        <extrudeGeometry args={[gableShape, { depth: d, bevelEnabled: false }]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      {/* Fachwerk */}
      {timber && (
        <group>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[(sx * w) / 2, base + h / 2, (sz * d) / 2]} castShadow>
                <boxGeometry args={[0.14, h, 0.14]} />
                <meshStandardMaterial color={C.timber} roughness={1} />
              </mesh>
            )),
          )}
          {[-1, 1].map((sz) => (
            <group key={sz}>
              <mesh position={[0, top - 0.04, (sz * d) / 2]}>
                <boxGeometry args={[w + 0.1, 0.12, 0.1]} />
                <meshStandardMaterial color={C.timber} roughness={1} />
              </mesh>
              <mesh position={[0, base + h * 0.45, (sz * d) / 2 + sz * 0.01]}>
                <boxGeometry args={[w, 0.08, 0.06]} />
                <meshStandardMaterial color={C.timber} roughness={1} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[(sx * w) / 2 + sx * 0.01, base + h * 0.45, 0]}>
              <boxGeometry args={[0.06, 0.08, d]} />
              <meshStandardMaterial color={C.timber} roughness={1} />
            </mesh>
          ))}
        </group>
      )}
      {/* großes Satteldach aus zwei Dachflächen */}
      {[-1, 1].map((sx) => (
        <mesh
          key={sx}
          position={[(sx * roofSlope.half) / 2, top + roofH / 2 - 0.02, 0]}
          rotation={[0, 0, -sx * roofSlope.angle]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[roofSlope.length, 0.16, d + 0.6]} />
          <meshStandardMaterial color={roof} roughness={0.85} flatShading />
        </mesh>
      ))}
      {/* Firstbalken */}
      <mesh position={[0, top + roofH + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, d + 0.7, 6]} />
        <meshStandardMaterial color={C.timber} roughness={1} />
      </mesh>
      {/* Tür */}
      <mesh position={[0, base + 0.46, d / 2 + 0.03]}>
        <boxGeometry args={[0.56, 0.92, 0.06]} />
        <meshStandardMaterial color="#7a4b2a" roughness={1} />
      </mesh>
      <mesh position={[0.17, base + 0.45, d / 2 + 0.07]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Fenster */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Window position={[sx * w * 0.3, base + h * 0.62, d / 2 + 0.03]} lit={lit} />
          {flowers && <FlowerBox position={[sx * w * 0.3, base + h * 0.62 - 0.33, d / 2 + 0.1]} />}
        </group>
      ))}
      <Window position={[w / 2 + 0.03, base + h * 0.62, 0]} rotY={Math.PI / 2} lit={lit} />
      <Window position={[-w / 2 - 0.03, base + h * 0.62, 0]} rotY={-Math.PI / 2} lit={lit} />
      {/* Schornstein */}
      {chimney && (
        <group position={[w * 0.26, top + roofH * 0.45, -d * 0.18]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[0.38, 1, 0.38]} />
            <meshStandardMaterial color={C.stone} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <boxGeometry args={[0.46, 0.1, 0.46]} />
            <meshStandardMaterial color={C.stoneDark} roughness={1} />
          </mesh>
          <Smoke position={[0, 0.95, 0]} active={smoking} size={smokeSize} />
        </group>
      )}
    </group>
  );
}

/** Kleine Wohnhütte eines Dorfbewohners. */
export function Cottage({ occupied, resting }: { occupied: boolean; resting: boolean }) {
  return (
    <group scale={0.62}>
      <House w={2} d={1.8} h={1.2} roof={C.thatch} wall={C.plasterWarm} smoking={occupied} lit={resting} smokeSize={0.8} />
    </group>
  );
}
