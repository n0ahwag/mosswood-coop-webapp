// Das gemeinsame Tal in 3D: Monumente (wachsen mit dem Fortschritt), Hafen mit
// Handelsschiff, die Höfe der Nachbarn und der Bahnhof für die Rückfahrt.

import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import type { TradeShip, ValleyMember, ValleyProject } from '../lib/types';
import { Cottage } from './House';
import { HtmlPortalContext, useHtmlPortal, useHudOffset } from './htmlPortal';
import { Beacon, TrainStation } from './Landmarks';
import { distToSegment, hashString, mulberry32, type Vec2 } from './layout';
import { C } from './palette';

const R = 24;
const RIVER: Vec2[] = [[-21, -10], [-12, -6], [-4, -2.5], [3, 3], [6, 10], [6, 15.5]];
export const SPOTS = {
  mossBridge: [-4, -2.5] as Vec2,
  greatLibrary: [-10, 6] as Vec2,
  lanternFestival: [10, -3] as Vec2,
  harbor: [6, 18] as Vec2,
  station: [0, -18.5] as Vec2,
};
const FARM_ANGLES = [-130, -60, -25, 10, 40, 110, 150, 180].map((d) => (d * Math.PI) / 180);
const farmPos = (i: number): Vec2 => [Math.cos(FARM_ANGLES[i % 8]) * 17, Math.sin(FARM_ANGLES[i % 8]) * 17];
const projectSpot = (key: string): Vec2 => (SPOTS as Record<string, Vec2>)[key] ?? [0, 0];

function Mat({ color, rough = 0.9, emissive, intensity = 0 }: { color: string; rough?: number; emissive?: string; intensity?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} emissive={emissive ?? '#000000'} emissiveIntensity={intensity} flatShading />;
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

// ---------- Landschaft ----------

function Ground() {
  return (
    <group>
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <cylinderGeometry args={[R, R, 1.2, 64]} />
        <Mat color={C.grass} rough={1} />
      </mesh>
      <mesh position={[0, -1.9, 0]} castShadow>
        <cylinderGeometry args={[R, R - 2, 1.6, 48]} />
        <Mat color={C.dirt} />
      </mesh>
      <mesh position={[0, -6.4, 0]} castShadow>
        <coneGeometry args={[R - 2, 7.6, 24]} />
        <Mat color={C.rockUnder} />
      </mesh>
      {/* Hafenbecken */}
      <mesh position={[SPOTS.harbor[0], 0.02, SPOTS.harbor[1]]} receiveShadow>
        <cylinderGeometry args={[4.4, 4.4, 0.03, 40]} />
        <meshStandardMaterial color={C.water} roughness={0.25} />
      </mesh>
    </group>
  );
}

function ribbon(points: Vec2[], width: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = 90;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    const t = curve.getTangentAt(i / n);
    const nx = -t.z;
    const nz = t.x;
    pos.push(p.x + nx * width / 2, 0, p.z + nz * width / 2, p.x - nx * width / 2, 0, p.z - nz * width / 2);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function River() {
  const water = useMemo(() => ribbon(RIVER, 2.2), []);
  const bank = useMemo(() => ribbon(RIVER, 3.1), []);
  return (
    <group>
      <mesh geometry={bank} position={[0, 0.012, 0]} receiveShadow>
        <meshStandardMaterial color={C.path} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={water} position={[0, 0.03, 0]}>
        <meshStandardMaterial color={C.water} roughness={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PathStrip({ from, to, width = 1 }: { from: Vec2; to: Vec2; width?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  return (
    <mesh position={[(from[0] + to[0]) / 2, 0.008, (from[1] + to[1]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]} receiveShadow>
      <boxGeometry args={[len, 0.012, width]} />
      <meshStandardMaterial color={C.path} roughness={1} />
    </mesh>
  );
}

function Trees({ farms }: { farms: number }) {
  const trees = useMemo(() => {
    const rnd = mulberry32(4242);
    const blocked: [Vec2, number][] = [
      [SPOTS.mossBridge, 4], [SPOTS.greatLibrary, 4.5], [SPOTS.lanternFestival, 4.5],
      [SPOTS.harbor, 5.5], [SPOTS.station, 4.5], [[0, 0], 3.5],
      ...Array.from({ length: Math.max(farms, 8) }, (_, i) => [farmPos(i), 3] as [Vec2, number]),
    ];
    const pathEnds: Vec2[] = [SPOTS.mossBridge, SPOTS.greatLibrary, SPOTS.lanternFestival, SPOTS.harbor, SPOTS.station];
    const out: { p: Vec2; s: number; c: string }[] = [];
    for (let tries = 0; out.length < 60 && tries < 3000; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (R - 1.5);
      const p: Vec2 = [Math.cos(a) * r, Math.sin(a) * r];
      if (blocked.some(([b, br]) => Math.hypot(p[0] - b[0], p[1] - b[1]) < br)) continue;
      if (pathEnds.some((e) => distToSegment(p, [0, 0], e) < 1.4)) continue;
      let river = Infinity;
      for (let i = 0; i < RIVER.length - 1; i++) river = Math.min(river, distToSegment(p, RIVER[i], RIVER[i + 1]));
      if (river < 2.4) continue;
      if (out.some((t) => Math.hypot(t.p[0] - p[0], t.p[1] - p[1]) < 2.2)) continue;
      out.push({ p, s: 0.8 + rnd() * 0.6, c: C.leaf[Math.floor(rnd() * C.leaf.length)] });
    }
    return out;
  }, [farms]);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.p[0], 0, t.p[1]]} scale={t.s}>
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.2, 1.2, 6]} />
            <Mat color={C.trunk} />
          </mesh>
          <mesh position={[0, 1.6, 0]} castShadow>
            <icosahedronGeometry args={[0.85, 0]} />
            <Mat color={t.c} />
          </mesh>
          <mesh position={[0.35, 2.15, 0.1]} castShadow>
            <icosahedronGeometry args={[0.55, 0]} />
            <Mat color={t.c} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- Monumente ----------

function Scaffold({ w, d, h }: { w: number; d: number; h: number }) {
  const corners: Vec2[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow>
          <boxGeometry args={[0.12, h, 0.12]} />
          <Mat color={C.wood} />
        </mesh>
      ))}
      {[0.35, 0.7].map((f) => (
        <group key={f}>
          <mesh position={[0, h * f, -d / 2]}>
            <boxGeometry args={[w, 0.08, 0.1]} />
            <Mat color={C.woodLight} />
          </mesh>
          <mesh position={[0, h * f, d / 2]}>
            <boxGeometry args={[w, 0.08, 0.1]} />
            <Mat color={C.woodLight} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Bridge({ p }: { p: number }) {
  const segs = 9;
  const built = Math.round(p * segs);
  return (
    <group rotation={[0, -0.55, 0]}>
      {[-2.4, 2.4].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.9, 2]} />
          <Mat color={C.stone} />
        </mesh>
      ))}
      {Array.from({ length: built }, (_, i) => {
        const t = (i + 0.5) / segs;
        const x = -2 + t * 4;
        const y = 0.6 + Math.sin(t * Math.PI) * 0.9;
        return (
          <mesh key={i} position={[x, y, 0]} rotation={[0, 0, -Math.cos(t * Math.PI) * 0.6]} castShadow>
            <boxGeometry args={[0.52, 0.28, 1.8]} />
            <Mat color={i % 2 ? C.woodLight : C.wood} />
          </mesh>
        );
      })}
      {p >= 1 && [-0.85, 0.85].map((z) => (
        <mesh key={z} position={[0, 1.75, z]}>
          <boxGeometry args={[4.2, 0.08, 0.08]} />
          <Mat color={C.timber} />
        </mesh>
      ))}
      {p < 1 && <group position={[0, 0, 0]}><Scaffold w={4.4} d={2.4} h={2.2} /></group>}
    </group>
  );
}

function Library({ p }: { p: number }) {
  const h = 0.3 + p * 2.6;
  const done = p >= 1;
  const roof = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2.6, 0);
    s.lineTo(2.6, 0);
    s.lineTo(0, 1.6);
    s.closePath();
    return s;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[5.4, 0.3, 4.2]} />
        <Mat color={C.stoneDark} />
      </mesh>
      <mesh position={[0, 0.3 + h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, h, 3.4]} />
        <Mat color={C.plaster} />
      </mesh>
      {[-1.8, -0.6, 0.6, 1.8].map((x) => (
        <mesh key={x} position={[x, 0.3 + h / 2, 1.85]} castShadow>
          <cylinderGeometry args={[0.18, 0.2, h, 8]} />
          <Mat color={C.stone} />
        </mesh>
      ))}
      {done && (
        <>
          <mesh position={[0, 3.2, -2.05]} castShadow>
            <extrudeGeometry args={[roof, { depth: 4.1, bevelEnabled: false }]} />
            <Mat color="#5f93ad" />
          </mesh>
          {[-1.2, 0, 1.2].map((x) => (
            <mesh key={x} position={[x, 1.9, 1.72]}>
              <boxGeometry args={[0.5, 0.8, 0.05]} />
              <Mat color={C.window} emissive={C.window} intensity={0.7} />
            </mesh>
          ))}
        </>
      )}
      {!done && <Scaffold w={5.2} d={4} h={h + 0.8} />}
      {/* Ziegel- und Plankenstapel als Baustelle */}
      {!done && (
        <group position={[3.2, 0, 1.6]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.12 + i * 0.22, 0]} castShadow>
              <boxGeometry args={[0.8, 0.2, 0.5]} />
              <Mat color={i % 2 ? C.brick : C.woodLight} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function LanternFestival({ p }: { p: number }) {
  const lanterns = Math.round(p * 14);
  const tables = Math.min(3, Math.ceil(p * 3));
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((l, i) => {
      l.position.y = 2.3 + Math.sin(clock.elapsedTime * 1.5 + i) * 0.06;
    });
  });
  return (
    <group>
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} position={[x, 1.25, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 2.5, 6]} />
          <Mat color={C.timber} />
        </mesh>
      ))}
      <mesh position={[0, 2.45, 0]}>
        <boxGeometry args={[6.4, 0.03, 0.03]} />
        <Mat color={C.timber} />
      </mesh>
      <group ref={ref}>
        {Array.from({ length: lanterns }, (_, i) => (
          <mesh key={i} position={[-3 + (i / 13) * 6, 2.3, 0]}>
            <sphereGeometry args={[0.16, 8, 6]} />
            <Mat color={C.cloth[i % 4]} emissive={C.cloth[i % 4]} intensity={p >= 1 ? 0.9 : 0.35} />
          </mesh>
        ))}
      </group>
      {Array.from({ length: tables }, (_, i) => (
        <group key={i} position={[0, 0, -1.4 + i * 1.4]}>
          <mesh position={[0, 0.55, 0.6]} castShadow>
            <boxGeometry args={[3.6, 0.1, 0.7]} />
            <Mat color={C.woodLight} />
          </mesh>
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} position={[x, 0.27, 0.6]}>
              <boxGeometry args={[0.1, 0.55, 0.5]} />
              <Mat color={C.timber} />
            </mesh>
          ))}
        </group>
      ))}
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
  const model = project.key === 'mossBridge' ? <Bridge p={p} /> : project.key === 'greatLibrary' ? <Library p={p} /> : <LanternFestival p={p} />;

  return (
    <group position={[spot[0], 0, spot[1]]}>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[3.6, 3.6, 0.014, 40]} />
        <meshStandardMaterial color={selected ? C.grassLight : '#a3cf6b'} roughness={1} />
      </mesh>
      <Clickable onClick={() => onSelect(project.key)}>{model}</Clickable>
      <Html portal={portal} position={[0, 4.6, 0]} center distanceFactor={13} zIndexRange={[30, 0]}>
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
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.15 + Math.sin(clock.elapsedTime * 1.3) * 0.06;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.03;
  });
  const hull = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2, 0.7);
    s.lineTo(2.4, 0.7);
    s.lineTo(1.7, 0);
    s.lineTo(-1.6, 0);
    s.closePath();
    return s;
  }, []);
  return (
    <group ref={ref}>
      <mesh position={[0, 0, -0.75]} castShadow>
        <extrudeGeometry args={[hull, { depth: 1.5, bevelEnabled: false }]} />
        <Mat color="#8a5530" />
      </mesh>
      <mesh position={[0.2, 0.72, 0]}>
        <boxGeometry args={[4, 0.06, 1.4]} />
        <Mat color={C.woodLight} />
      </mesh>
      <mesh position={[0.1, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.8, 6]} />
        <Mat color={C.timber} />
      </mesh>
      <mesh position={[0.1, 2.2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[1.5, 1.9]} />
        <meshStandardMaterial color="#fbf3df" side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[0.1, 3.6, 0]}>
        <coneGeometry args={[0.18, 0.4, 3]} />
        <Mat color={C.terracotta} />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]} castShadow>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
          <Mat color={C.wood} />
        </mesh>
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
  const portal = useHtmlPortal();
  const docked = ship?.status === 'DOCKED' && new Date(ship.departsAt).getTime() > Date.now();
  return (
    <group position={[SPOTS.harbor[0], 0, SPOTS.harbor[1]]}>
      {/* Steg */}
      <mesh position={[-3.2, 0.2, -1]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.18, 1.1]} />
        <Mat color={C.wood} />
      </mesh>
      {[-4.4, -3.2, -2].map((x) => (
        <mesh key={x} position={[x, 0, -0.5]}>
          <cylinderGeometry args={[0.09, 0.09, 0.6, 6]} />
          <Mat color={C.timber} />
        </mesh>
      ))}
      <Clickable onClick={onSelect}>
        {docked ? (
          <group position={[0, 0, 0.3]} rotation={[0, 0.4, 0]}>
            <Ship />
          </group>
        ) : (
          <mesh position={[-3.2, 0.6, -1]}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <Mat color={C.woodLight} />
          </mesh>
        )}
      </Clickable>
      <Html portal={portal} position={[0, 4.4, 0]} center distanceFactor={13} zIndexRange={[30, 0]}>
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
  const portal = useHtmlPortal();
  const [x, z] = farmPos(index);
  const rot = Math.atan2(-x, -z);
  const field = C.leaf[hashString(member.id) % C.leaf.length];
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[2.4, 2.4, 0.014, 28]} />
        <meshStandardMaterial color={isMe ? '#bfe08a' : '#a3cf6b'} roughness={1} />
      </mesh>
      <Cottage occupied resting={false} />
      <mesh position={[1.4, 0.06, 0.6]} receiveShadow>
        <boxGeometry args={[1.1, 0.12, 1.3]} />
        <Mat color={field} />
      </mesh>
      <Html portal={portal} position={[0, 2.8, 0]} center distanceFactor={13} zIndexRange={[20, 0]}>
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
      <Clickable onClick={go}>
        <TrainStation locked={false} departing={departing} />
      </Clickable>
      <Html portal={portal} position={[0, 3.6, 0]} center distanceFactor={13} zIndexRange={[30, 0]}>
        <button className={`scene-label text-center ${highlight ? 'is-selected' : ''}`} onClick={go}>
          <div className="whitespace-nowrap">🚂 Bahnhof</div>
          <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">Zurück zum Hof</div>
        </button>
      </Html>
    </group>
  );
}

function AdaptiveCamera() {
  const { camera, size } = useThree();
  const aspect = size.height ? size.width / size.height : 1.5;
  useEffect(() => {
    const k = aspect < 1.2 ? Math.min(2, 1.25 / aspect) : 1;
    camera.position.set(22 * k, 28 * k, 30 * k);
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
  /** Gesetzt, solange das Handelsschiff im Hofbuch noch gesperrt ist. */
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
  const beacon: Vec2 | null = !guide
    ? null
    : guide.kind === 'project' ? projectSpot(guide.key) : guide.kind === 'ship' ? SPOTS.harbor : SPOTS.station;

  return (
    <div ref={portalRef} className="relative h-full w-full">
      <HtmlPortalContext.Provider value={portalRef as RefObject<HTMLElement>}>
        <Canvas
          frameloop={active ? 'always' : 'never'}
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [22, 28, 30], fov: 34, near: 0.5, far: 260 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
          onPointerMissed={() => onSelect(null)}
        >
          <AdaptiveCamera />
          <hemisphereLight args={['#fff4dc', '#7fa85a', 1.15]} />
          <ambientLight intensity={0.2} />
          <directionalLight
            position={[20, 32, 14]}
            intensity={2.3}
            color="#ffe2b2"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-28}
            shadow-camera-right={28}
            shadow-camera-top={28}
            shadow-camera-bottom={-28}
            shadow-camera-near={1}
            shadow-camera-far={90}
            shadow-bias={-0.0005}
            shadow-normalBias={0.05}
          />
          <fog attach="fog" args={['#e4f2ef', 80, 160]} />
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={20}
            maxDistance={85}
            minPolarAngle={0.4}
            maxPolarAngle={1.15}
            target={[0, 0, 1]}
          />

          <Ground />
          <River />
          {[SPOTS.mossBridge, SPOTS.greatLibrary, SPOTS.lanternFestival, SPOTS.harbor, SPOTS.station].map((e, i) => (
            <PathStrip key={i} from={[0, 0]} to={e} width={1.1} />
          ))}
          {members.map((_, i) => <PathStrip key={`f${i}`} from={[0, 0]} to={farmPos(i)} width={0.7} />)}
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <cylinderGeometry args={[2.6, 2.6, 0.03, 32]} />
            <meshStandardMaterial color={C.plaza} roughness={1} />
          </mesh>
          <Trees farms={members.length} />

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
