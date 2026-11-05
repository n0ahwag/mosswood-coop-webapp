import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Villager } from '../lib/types';
import { useHtmlPortal } from './htmlPortal';
import {
  hashString, heightAt, peakAt, planRoute, type RoutePoint, type Vec2,
} from './layout';
import { C } from './palette';

export type VillagerMode = 'swing' | 'carry' | 'eat' | 'rest' | 'tired' | 'hungry' | 'idle';

export interface VillagerPlan {
  target: Vec2;
  look: Vec2 | null;
  mode: VillagerMode;
  carry?: string;
}

const CARRY_COLORS: Record<string, string> = {
  planks: '#d9a66d',
  bricks: C.brick,
  cloth: C.cloth[0],
  meals: '#e3a548',
};

const BUBBLE: Partial<Record<Villager['state'], string>> = {
  HUNGRY: '😋',
  EATING: '🥧',
  TIRED: '🥱',
  RESTING: '💤',
};

function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function Villager3D({
  villager, plan, selected, onSelect,
}: {
  villager: Villager;
  plan: VillagerPlan;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const look = useMemo(() => {
    const h = hashString(villager.id);
    return {
      skin: C.skin[h % C.skin.length],
      shirt: C.shirt[(h >>> 3) % C.shirt.length],
      trousers: C.trousers[(h >>> 7) % C.trousers.length],
      hatType: (h >>> 11) % 3,
      hat: C.hat[(h >>> 13) % C.hat.length],
      hair: ['#5a3a22', '#8a5a2b', '#2f2219', '#c48a4a'][(h >>> 17) % 4],
      speed: 2.1 + ((h >>> 19) % 10) / 20,
      phaseOffset: (h % 100) / 15,
    };
  }, [villager.id]);

  const portal = useHtmlPortal();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const carryRef = useRef<THREE.Group>(null);
  const toolRef = useRef<THREE.Group>(null);

  const pos = useRef(new THREE.Vector3(plan.target[0], heightAt(plan.target[0], plan.target[1]), plan.target[1]));
  const path = useRef<RoutePoint[]>([]);
  const heading = useRef(0);
  const walkPhase = useRef(0);
  const targetKey = `${plan.target[0].toFixed(2)}|${plan.target[1].toFixed(2)}`;

  useEffect(() => {
    const p = pos.current;
    // Auf einer Brücke oder Treppe erst bis zum Ende laufen, dann neu planen.
    let keep: RoutePoint[] = [];
    if (!peakAt(p.x, p.z) && path.current.length) {
      const landing = path.current.findIndex((r) => r.landing);
      if (landing >= 0) keep = path.current.slice(0, landing + 1);
    }
    const from = keep.length ? keep[keep.length - 1].p : ([p.x, p.y, p.z] as [number, number, number]);
    path.current = [...keep, ...planRoute(from, plan.target)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const t = clock.elapsedTime + look.phaseOffset;
    const g = root.current;
    if (!g || !body.current || !head.current || !armL.current || !armR.current || !legL.current || !legR.current) return;

    // --- Bewegung ---
    let moving = false;
    let desired = heading.current;
    const speed = plan.mode === 'tired' ? look.speed * 0.55 : look.speed;
    if (path.current.length) {
      const [nx, ny, nz] = path.current[0].p;
      const dx = nx - pos.current.x;
      const dy = ny - pos.current.y;
      const dz = nz - pos.current.z;
      const d = Math.hypot(dx, dy, dz);
      const step = speed * delta;
      if (d <= step) {
        pos.current.set(nx, ny, nz);
        path.current.shift();
      } else {
        pos.current.x += (dx / d) * step;
        pos.current.y += (dy / d) * step;
        pos.current.z += (dz / d) * step;
      }
      if (Math.hypot(dx, dz) > 0.01) desired = Math.atan2(dx, dz);
      moving = true;
    } else if (plan.look) {
      desired = Math.atan2(plan.look[0] - pos.current.x, plan.look[1] - pos.current.z);
    }

    // beim Tragen langsam hin und her laufen
    let ox = 0;
    let oz = 0;
    let pacing = false;
    if (!moving && plan.mode === 'carry') {
      const s = Math.sin(t * 0.7);
      const perp = desired + Math.PI / 2;
      ox = Math.sin(perp) * s * 0.7;
      oz = Math.cos(perp) * s * 0.7;
      pacing = Math.abs(Math.cos(t * 0.7)) > 0.25;
      if (pacing) desired = perp + (Math.cos(t * 0.7) > 0 ? 0 : Math.PI);
    }

    heading.current += shortestAngle(heading.current, desired) * Math.min(1, delta * 8);
    const gy = moving ? pos.current.y : heightAt(pos.current.x + ox, pos.current.z + oz);
    if (!moving) pos.current.y = gy;
    g.position.set(pos.current.x + ox, gy, pos.current.z + oz);
    g.rotation.y = heading.current;

    const walking = moving || pacing;
    walkPhase.current += delta * (walking ? (plan.mode === 'tired' ? 7 : 11) : 0);
    const w = walkPhase.current;

    // --- Grundhaltung ---
    let bodyY = walking ? Math.abs(Math.sin(w)) * 0.12 : 0;
    let bodyRotX = walking ? 0.08 : 0;
    let bodyRotZ = 0;
    let headRotY = 0;
    let headRotZ = 0;
    let armLX = walking ? Math.sin(w) * 0.7 : 0;
    let armRX = walking ? -Math.sin(w) * 0.7 : 0;
    let legLX = walking ? -Math.sin(w) * 0.7 : 0;
    let legRX = walking ? Math.sin(w) * 0.7 : 0;
    let squash = 1;

    if (!moving) {
      switch (plan.mode) {
        case 'swing': {
          const s = Math.sin(t * 6.5);
          armRX = -1.5 - s * 0.95;
          armLX = -0.9 - s * 0.5;
          bodyRotX = 0.12 + s * 0.1;
          bodyY = Math.max(0, -s) * 0.04;
          break;
        }
        case 'carry':
          armLX = -1.15;
          armRX = -1.15;
          bodyRotZ = Math.sin(w * 0.5 + t * 2) * 0.12;
          bodyRotX = -0.06;
          break;
        case 'eat':
          bodyY = -0.18;
          legLX = -1.35;
          legRX = -1.35;
          armRX = -1.9 + Math.sin(t * 4) * 0.35;
          armLX = -0.6;
          headRotZ = Math.sin(t * 2) * 0.06;
          break;
        case 'rest':
          bodyY = -0.2;
          legLX = -1.4;
          legRX = -1.4;
          bodyRotX = -0.18;
          headRotZ = 0.35;
          armLX = -0.3;
          armRX = -0.3;
          squash = 1 + Math.sin(t * 1.4) * 0.025;
          break;
        case 'hungry':
          armLX = -0.7;
          armRX = -0.7;
          headRotY = Math.sin(t * 2.2) * 0.35;
          bodyRotX = 0.14;
          break;
        case 'tired':
          bodyRotX = 0.28;
          headRotZ = 0.2;
          break;
        default:
          bodyRotZ = Math.sin(t * 1.4) * 0.05;
          headRotY = Math.sin(t * 0.6) * 0.6;
          armLX = Math.sin(t * 1.4) * 0.08;
          armRX = -Math.sin(t * 1.4) * 0.08;
      }
    }

    const k = Math.min(1, delta * 12);
    body.current.position.y += (bodyY - body.current.position.y) * k;
    body.current.rotation.x += (bodyRotX - body.current.rotation.x) * k;
    body.current.rotation.z += (bodyRotZ - body.current.rotation.z) * k;
    body.current.scale.y = squash;
    head.current.rotation.y += (headRotY - head.current.rotation.y) * k;
    head.current.rotation.z += (headRotZ - head.current.rotation.z) * k;
    armL.current.rotation.x += (armLX - armL.current.rotation.x) * k;
    armR.current.rotation.x += (armRX - armR.current.rotation.x) * k;
    legL.current.rotation.x += (legLX - legL.current.rotation.x) * k;
    legR.current.rotation.x += (legRX - legR.current.rotation.x) * k;
    if (carryRef.current) carryRef.current.visible = plan.mode === 'carry' && !moving;
    if (toolRef.current) toolRef.current.visible = plan.mode === 'swing' && !moving;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(villager.id);
  };

  const bubble = BUBBLE[villager.state];
  const carryColor = CARRY_COLORS[plan.carry ?? ''] ?? C.wood;

  return (
    <group
      ref={root}
      onClick={click}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.05, 8, 32]} />
          <meshStandardMaterial color={C.gold} emissive={C.gold} emissiveIntensity={0.6} />
        </mesh>
      )}
      {/* Schatten-Fleck für bessere Bodenhaftung */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#3a2a1d" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      <group scale={0.82}>
        <group ref={body}>
          {/* Beine */}
          <group ref={legL} position={[-0.13, 0.42, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.11, 0.2, 4, 8]} />
              <meshStandardMaterial color={look.trousers} roughness={1} />
            </mesh>
            <mesh position={[0, -0.38, 0.05]}>
              <boxGeometry args={[0.17, 0.08, 0.24]} />
              <meshStandardMaterial color="#4a3324" roughness={1} />
            </mesh>
          </group>
          <group ref={legR} position={[0.13, 0.42, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.11, 0.2, 4, 8]} />
              <meshStandardMaterial color={look.trousers} roughness={1} />
            </mesh>
            <mesh position={[0, -0.38, 0.05]}>
              <boxGeometry args={[0.17, 0.08, 0.24]} />
              <meshStandardMaterial color="#4a3324" roughness={1} />
            </mesh>
          </group>

          {/* Körper mit Schürze */}
          <mesh position={[0, 0.76, 0]} castShadow>
            <capsuleGeometry args={[0.32, 0.26, 6, 12]} />
            <meshStandardMaterial color={look.shirt} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.68, 0.27]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[0.42, 0.44, 0.05]} />
            <meshStandardMaterial color={C.apron} roughness={1} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <torusGeometry args={[0.33, 0.035, 6, 20]} />
            <meshStandardMaterial color={C.timber} roughness={1} />
          </mesh>

          {/* Arme */}
          <group ref={armL} position={[-0.37, 0.98, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.24, 4, 8]} />
              <meshStandardMaterial color={look.shirt} roughness={0.95} />
            </mesh>
            <mesh position={[0, -0.42, 0]}>
              <sphereGeometry args={[0.095, 10, 8]} />
              <meshStandardMaterial color={look.skin} roughness={0.8} />
            </mesh>
          </group>
          <group ref={armR} position={[0.37, 0.98, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.24, 4, 8]} />
              <meshStandardMaterial color={look.shirt} roughness={0.95} />
            </mesh>
            <mesh position={[0, -0.42, 0]}>
              <sphereGeometry args={[0.095, 10, 8]} />
              <meshStandardMaterial color={look.skin} roughness={0.8} />
            </mesh>
            {/* Werkzeug */}
            <group ref={toolRef} position={[0, -0.45, 0.05]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
              <mesh position={[0, 0.22, 0]}>
                <boxGeometry args={[0.05, 0.5, 0.05]} />
                <meshStandardMaterial color={C.wood} />
              </mesh>
              <mesh position={[0.06, 0.44, 0]}>
                <boxGeometry args={[0.2, 0.1, 0.04]} />
                <meshStandardMaterial color="#a7b0b5" metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          </group>

          {/* getragene Ware */}
          <group ref={carryRef} position={[0, 0.72, 0.52]} visible={false}>
            {plan.carry === 'meals' ? (
              <mesh>
                <cylinderGeometry args={[0.2, 0.18, 0.1, 12]} />
                <meshStandardMaterial color={carryColor} roughness={0.8} />
              </mesh>
            ) : plan.carry === 'cloth' ? (
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.13, 0.13, 0.5, 10]} />
                <meshStandardMaterial color={carryColor} roughness={1} />
              </mesh>
            ) : (
              <mesh>
                <boxGeometry args={[0.55, 0.14, 0.22]} />
                <meshStandardMaterial color={carryColor} roughness={1} />
              </mesh>
            )}
          </group>

          {/* Kopf */}
          <group ref={head} position={[0, 1.33, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.31, 18, 14]} />
              <meshStandardMaterial color={look.skin} roughness={0.75} />
            </mesh>
            {/* Augen mit Glanzpunkt */}
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.115, 0.03, 0.27]}>
                <mesh>
                  <sphereGeometry args={[0.062, 12, 10]} />
                  <meshStandardMaterial color="#2a1d14" roughness={0.3} />
                </mesh>
                <mesh position={[0.018, 0.022, 0.05]}>
                  <sphereGeometry args={[0.02, 8, 6]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0, 0.11, 0.0]} rotation={[0, 0, -s * 0.18]}>
                  <boxGeometry args={[0.1, 0.025, 0.03]} />
                  <meshStandardMaterial color={look.hair} roughness={1} />
                </mesh>
                <mesh position={[s * 0.07, -0.1, -0.02]}>
                  <sphereGeometry args={[0.05, 8, 6]} />
                  <meshStandardMaterial color="#f29a8e" transparent opacity={0.55} roughness={1} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, -0.04, 0.3]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshStandardMaterial color={look.skin} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.12, 0.275]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.055, 0.014, 6, 10, Math.PI]} />
              <meshStandardMaterial color="#7a3a2a" roughness={1} />
            </mesh>
            {/* Haare */}
            <mesh position={[0, 0.06, -0.04]} scale={[1.04, 0.95, 1.02]}>
              <sphereGeometry args={[0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
              <meshStandardMaterial color={look.hair} roughness={1} />
            </mesh>
            {/* Hut */}
            {look.hatType === 0 && (
              <group position={[0, 0.2, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.46, 0.48, 0.04, 18]} />
                  <meshStandardMaterial color={C.hat[0]} roughness={1} />
                </mesh>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.22, 0.26, 0.2, 14]} />
                  <meshStandardMaterial color={C.hat[0]} roughness={1} />
                </mesh>
                <mesh position={[0, 0.03, 0]}>
                  <cylinderGeometry args={[0.265, 0.265, 0.05, 14]} />
                  <meshStandardMaterial color={look.hat === C.hat[0] ? C.hat[1] : look.hat} roughness={1} />
                </mesh>
              </group>
            )}
            {look.hatType === 1 && (
              <group position={[0, 0.06, 0]}>
                <mesh>
                  <sphereGeometry args={[0.325, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                  <meshStandardMaterial color={look.hat} roughness={1} />
                </mesh>
                <mesh position={[0, 0.01, 0]}>
                  <torusGeometry args={[0.31, 0.05, 6, 20]} />
                  <meshStandardMaterial color={look.hat} roughness={1} />
                </mesh>
                <mesh position={[0, 0.34, 0]}>
                  <sphereGeometry args={[0.08, 10, 8]} />
                  <meshStandardMaterial color="#fff6e6" roughness={1} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>

      {/* Html bleibt immer eingehängt: Ein- und Aushängen löst sonst React-Warnungen aus. */}
      <Html portal={portal} position={[0, 1.85, 0]} center distanceFactor={13} zIndexRange={[40, 0]}>
        {(bubble || selected) && (
          <div className={`scene-bubble ${selected ? 'is-selected' : ''}`}>
            {bubble && <span className="text-base leading-none">{bubble}</span>}
            {selected && <span>{villager.name}</span>}
          </div>
        )}
      </Html>
    </group>
  );
}
