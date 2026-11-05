// Wahrzeichen: die Sternwarte (öffnet das Forschungsbuch) und der Bahnhof der Bergbahn
// (fährt ins Tal). Dazu der goldene Wegweiser für das Hofbuch.

import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clothMat, GrowIn } from './Buildings';
import { House, Smoke } from './House';
import { useHtmlPortal } from './htmlPortal';
import { facePlaza, heightAt, PLOTS, type LandmarkKey, type Vec3 } from './layout';
import { box, cyl, mats, sphere } from './materials';
import { GroundShadow } from './Mountain';
import { C } from './palette';

type V3 = [number, number, number];

// ---------- Sternwarte ----------

export function ResearchTower() {
  const m = mats();
  const dome = useRef<THREE.Group>(null);
  const bubbles = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (dome.current) dome.current.rotation.y = Math.sin(t * 0.25) * 0.9;
    if (bubbles.current) {
      bubbles.current.children.forEach((b, i) => {
        const phase = (t * 0.6 + i / 4) % 1;
        b.position.y = 0.85 + phase * 0.8;
        b.scale.setScalar(0.6 + phase * 0.6);
        ((b as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = (1 - phase) * 0.8;
      });
    }
  });
  const domeGeo = useMemo(() => new THREE.SphereGeometry(1.12, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), []);

  return (
    <group>
      {/* Sockel, Turm und Holzgalerie */}
      <mesh geometry={cyl(1.55, 1.75, 0.5, 40)} material={m.stoneDark} position={[0, 0.25, 0]} castShadow receiveShadow />
      <mesh geometry={cyl(1.12, 1.32, 3.3, 40)} material={m.stone} position={[0, 2.15, 0]} castShadow receiveShadow />
      <mesh geometry={cyl(1.5, 1.5, 0.12, 40)} material={m.wood} position={[0, 3.55, 0]} castShadow receiveShadow />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <mesh key={i} geometry={box(0.06, 0.5, 0.06, 0.015)} material={m.timber} position={[Math.cos(a) * 1.44, 3.85, Math.sin(a) * 1.44]} />;
      })}
      <mesh position={[0, 4.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.timber}>
        <torusGeometry args={[1.44, 0.035, 8, 48]} />
      </mesh>
      {/* Fenster rundherum */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        return (
          <group key={i} position={[Math.sin(a) * 1.2, 1.9 + (i % 2) * 0.9, Math.cos(a) * 1.2]} rotation={[0, a, 0]}>
            <mesh geometry={box(0.42, 0.62, 0.1, 0.03)} material={m.timber} />
            <mesh geometry={box(0.3, 0.5, 0.06, 0)} material={m.window} position={[0, 0, 0.03]} />
          </group>
        );
      })}
      {/* Tür */}
      <group position={[0, 0.5, 1.3]}>
        <mesh geometry={box(0.72, 1.12, 0.1, 0.03)} material={m.timber} position={[0, 0.55, 0]} />
        <mesh geometry={box(0.58, 1.0, 0.06, 0.02)} material={m.woodDark} position={[0, 0.5, 0.05]} />
      </group>
      {/* drehbare Kuppel mit Spalt und Teleskop */}
      <group ref={dome} position={[0, 3.7, 0]}>
        <mesh geometry={cyl(1.2, 1.2, 0.16, 40)} material={m.beam} position={[0, 0.08, 0]} />
        <mesh geometry={domeGeo} material={m.copper} position={[0, 0.15, 0]} castShadow />
        <mesh geometry={box(0.36, 1.2, 0.5, 0.04)} material={m.iron} position={[0, 0.65, 0.85]} rotation={[0.55, 0, 0]} />
        <group position={[0, 0.85, 0.55]} rotation={[-0.75, 0, 0]}>
          <mesh geometry={cyl(0.12, 0.17, 1.3, 20)} material={m.gold} position={[0, 0.55, 0]} castShadow />
          <mesh geometry={cyl(0.19, 0.19, 0.08, 20)} material={m.iron} position={[0, 1.2, 0]} />
        </group>
        <mesh geometry={sphere(0.12, 16, 10)} material={m.gold} position={[0, 1.3, 0]} />
      </group>
      {/* Wimpel */}
      <group position={[1.4, 3.6, -0.4]}>
        <mesh geometry={cyl(0.03, 0.03, 1.6, 8)} material={m.timber} position={[0, 0.8, 0]} />
        <mesh geometry={box(0.6, 0.32, 0.01, 0)} material={clothMat(C.cloth[1])} position={[0.3, 1.4, 0]} />
      </group>
      {/* Labortisch mit leuchtenden Kolben */}
      <group position={[1.55, 0.5, 1.05]} rotation={[0, -0.6, 0]}>
        <mesh geometry={box(1.1, 0.08, 0.6, 0.02)} material={m.woodLight} position={[0, 0.5, 0]} castShadow />
        {[[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]].map(([x, z], i) => (
          <mesh key={i} geometry={box(0.07, 0.5, 0.07, 0.015)} material={m.timber} position={[x, 0.25, z]} />
        ))}
        {[['#7be0a0', -0.3], ['#c79cf2', 0.05], ['#ffd36b', 0.35]].map(([color, x], i) => (
          <group key={i} position={[x as number, 0.62, 0]}>
            <mesh geometry={sphere(0.11, 16, 12)}>
              <meshStandardMaterial color={color as string} emissive={color as string} emissiveIntensity={1} roughness={0.15} transparent opacity={0.9} />
            </mesh>
            <mesh geometry={cyl(0.03, 0.045, 0.14, 10)} position={[0, 0.15, 0]} material={m.white} />
          </group>
        ))}
        <group ref={bubbles} position={[0.05, 0, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} geometry={sphere(0.04, 8, 6)} position={[(i - 1.5) * 0.12, 1.0, 0]}>
              <meshStandardMaterial color="#d9fbe8" transparent opacity={0.6} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Bücherstapel */}
      <group position={[-1.5, 0.5, 1.0]}>
        {['#c46e43', '#5f93ad', '#9ac17a', '#e9c25a'].map((c, i) => (
          <mesh key={c} geometry={box(0.5, 0.11, 0.36, 0.02)} position={[0, 0.07 + i * 0.12, 0]} rotation={[0, i * 0.4, 0]} castShadow>
            <meshStandardMaterial color={c} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Bahnhof mit Viadukt ----------

const PLATFORM_HALF = 3.4;
/** Höhe des Gleises (relativ zum Bahnsteig) in Abstand s vom Bahnhof; dahinter fällt es ins Tal ab. */
const trackY = (s: number) => (s <= PLATFORM_HALF ? 0 : -(s - PLATFORM_HALF) * 0.3 - Math.max(0, s - 14) * 0.15);

function Wheel({ position, r = 0.22 }: { position: V3; r?: number }) {
  const m = mats();
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={cyl(r, r, 0.1, 24)} material={m.iron} castShadow />
      <mesh geometry={cyl(r * 0.35, r * 0.35, 0.12, 12)} material={m.gold} />
    </group>
  );
}

function Train({ smoking }: { smoking: boolean }) {
  const m = mats();
  const loco = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3f7a52', roughness: 0.35, metalness: 0.3 }), []);
  const cab = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9563a', roughness: 0.45, metalness: 0.15 }), []);
  return (
    <group>
      <group position={[-0.9, 0.14, 0]}>
        <mesh geometry={cyl(0.34, 0.34, 1.1, 28)} material={loco} position={[-0.25, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
        <mesh geometry={cyl(0.37, 0.37, 0.06, 28)} material={m.gold} position={[-0.82, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={box(0.6, 0.85, 0.78, 0.05)} material={cab} position={[0.55, 0.62, 0]} castShadow />
        <mesh geometry={box(0.78, 0.1, 0.92, 0.03)} material={m.timber} position={[0.55, 1.1, 0]} castShadow />
        <mesh geometry={box(0.3, 0.26, 0.02, 0)} material={m.window} position={[0.55, 0.78, 0.4]} />
        <mesh geometry={cyl(0.09, 0.14, 0.42, 16)} material={m.iron} position={[-0.55, 1.02, 0]} castShadow />
        <Smoke position={[-0.55, 1.25, 0]} active={smoking} size={0.8} />
        <mesh geometry={sphere(0.08, 12, 8)} material={m.lamp} position={[-0.86, 0.72, 0]} />
        {[-0.5, 0.05, 0.55].map((x) => (
          <group key={x}>
            <Wheel position={[x, 0.2, 0.36]} />
            <Wheel position={[x, 0.2, -0.36]} />
          </group>
        ))}
      </group>
      <group position={[0.75, 0.14, 0]}>
        <mesh geometry={box(1.25, 0.7, 0.8, 0.05)} material={m.woodLight} position={[0, 0.55, 0]} castShadow />
        <mesh geometry={box(1.38, 0.1, 0.92, 0.03)} material={m.roofRed} position={[0, 0.96, 0]} castShadow />
        {[-0.35, 0.05, 0.45].map((x) => (
          <mesh key={x} geometry={box(0.26, 0.24, 0.02, 0)} material={m.window} position={[x - 0.05, 0.62, 0.41]} />
        ))}
        {[-0.4, 0.4].map((x) => (
          <group key={x}>
            <Wheel position={[x, 0.18, 0.36]} r={0.18} />
            <Wheel position={[x, 0.18, -0.36]} r={0.18} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Gleis vom Bahnsteig hinaus über ein hölzernes Viadukt in die Wolken. dir = -1: nach lokal -x. */
function Railway({ toWorld, baseY }: { toWorld: (lx: number, lz: number) => [number, number]; baseY: number }) {
  const m = mats();
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const length = 34;
  const n = Math.floor(length / 0.5);
  useLayoutEffect(() => {
    const mesh = sleepers.current;
    if (!mesh) return;
    const mt = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      // lx: lokale Position entlang des Gleises, s: Abstand hinaus (Richtung -x)
      const lx = PLATFORM_HALF + 0.3 - i * 0.5;
      const s = -lx;
      const slope = Math.atan((trackY(s - 0.05) - trackY(s + 0.05)) / 0.1);
      mt.compose(new THREE.Vector3(lx, trackY(s) + 0.04, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, slope)), new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, mt);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [n]);

  // Schienen als Kurve
  const rails = useMemo(() => [-0.32, 0.32].map((z) => {
    const pts = Array.from({ length: 50 }, (_, i) => {
      const s = PLATFORM_HALF + 0.3 - (i / 49) * (length + PLATFORM_HALF);
      return new THREE.Vector3(s, trackY(Math.max(0, -s)) + 0.11, z);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.035, 6);
  }), []);

  // Stützen des Viadukts bis zum Boden bzw. in die Wolken
  const posts = useMemo(() => {
    const out: { x: number; top: number; h: number }[] = [];
    for (let s = PLATFORM_HALF + 1.2; s < length; s += 1.8) {
      const [wx, wz] = toWorld(-s, 0);
      const ground = Math.max(heightAt(wx, wz), -1.5) - baseY;
      const top = trackY(s);
      const h = top - ground;
      if (h > 0.4) out.push({ x: -s, top, h });
    }
    return out;
  }, [toWorld, baseY]);

  return (
    <group>
      <instancedMesh ref={sleepers} args={[box(0.22, 0.07, 1.05, 0.015), m.timber, n]} receiveShadow castShadow />
      {rails.map((g, i) => <mesh key={i} geometry={g} material={m.metal} />)}
      {posts.map((p, i) => (
        <group key={i} position={[p.x, p.top - p.h / 2, 0]}>
          {[-0.5, 0.5].map((z) => (
            <mesh key={z} geometry={box(0.16, p.h, 0.16, 0.03)} material={m.beam} position={[0, 0, z]} rotation={[z * 0.12, 0, 0]} castShadow />
          ))}
          <mesh geometry={box(0.12, 0.12, 1.3, 0.02)} material={m.timber} position={[0, p.h / 2 - 0.1, 0]} />
          {p.h > 2 && (
            <mesh geometry={box(0.08, Math.hypot(p.h * 0.5, 1), 0.08, 0.01)} material={m.timber} position={[0, 0, 0]} rotation={[Math.atan2(1, p.h * 0.5), 0, 0]} />
          )}
        </group>
      ))}
    </group>
  );
}

export function TrainStation({
  departing, toWorld, baseY = 0, smoking = true,
}: {
  locked?: boolean;
  departing: number;
  toWorld?: (lx: number, lz: number) => [number, number];
  baseY?: number;
  /** false: verlassener Bahnhof (Ruine) ohne Dampf */
  smoking?: boolean;
}) {
  const m = mats();
  const train = useRef<THREE.Group>(null);
  const pos = useRef(0);
  useFrame((_, dt) => {
    if (!train.current) return;
    // departing: Zeitstempel der Abfahrt (0 = steht im Bahnhof)
    const target = departing ? 16 : 0;
    pos.current += (target - pos.current) * Math.min(1, dt * (departing ? 0.9 : 3));
    const s = pos.current;
    // Im Tal steht der Bahnhof eben, auf dem Berg fährt der Zug das Viadukt hinab.
    const y = (d: number) => (toWorld ? trackY(d) : 0);
    train.current.position.set(-s, y(s), 0);
    train.current.rotation.z = Math.atan((y(s - 0.05) - y(s + 0.05)) / 0.1);
  });
  return (
    <group>
      {/* Bahnsteig */}
      <mesh geometry={box(5.2, 0.4, 1.3, 0.05)} material={m.stone} position={[0, 0.2, 1.05]} castShadow receiveShadow />
      <mesh geometry={box(5.2, 0.06, 0.12, 0.02)} material={m.gold} position={[0, 0.42, 0.45]} />
      <group position={[0, 0, -0.1]}>
        {toWorld ? (
          <Railway toWorld={toWorld} baseY={baseY} />
        ) : (
          <FlatRails length={6.6} />
        )}
        <group ref={train}>
          <Train smoking={smoking} />
        </group>
      </group>
      {/* Stationshäuschen mit Vordach */}
      <group position={[-1.1, 0.4, 2.1]} rotation={[0, Math.PI, 0]}>
        <House w={1.8} d={1.2} h={1.05} roof="roofSlate" wall="plasterWarm" chimney={false} flowers shutters="woodRed" />
      </group>
      <mesh geometry={box(2.2, 0.06, 1.0, 0.02)} material={m.roofSlate} position={[1.3, 2.0, 1.2]} rotation={[-0.15, 0, 0]} castShadow />
      {[0.4, 2.2].map((x) => (
        <mesh key={x} geometry={cyl(0.05, 0.05, 1.6, 12)} material={m.iron} position={[x, 1.2, 0.85]} />
      ))}
      {/* Schild und Laterne */}
      <group position={[1.4, 0.4, 1.5]}>
        <mesh geometry={box(1.0, 0.36, 0.06, 0.02)} material={m.woodGreen} position={[0, 1.15, 0]} castShadow />
        <mesh geometry={sphere(0.1, 12, 8)} material={m.lamp} position={[0, 1.5, 0]} />
      </group>
      <mesh geometry={box(0.24, 0.55, 0.95, 0.05)} material={m.woodRed} position={[PLATFORM_HALF + 0.2, 0.28, -0.1]} castShadow />
    </group>
  );
}

function FlatRails({ length }: { length: number }) {
  const m = mats();
  const sleepers = Math.floor(length / 0.55);
  return (
    <group>
      {Array.from({ length: sleepers }, (_, i) => (
        <mesh key={i} geometry={box(0.22, 0.07, 1.05, 0.015)} material={m.timber} position={[-length / 2 + 0.3 + i * 0.55, 0.04, 0]} receiveShadow />
      ))}
      {[-0.32, 0.32].map((z) => (
        <mesh key={z} geometry={box(length, 0.06, 0.07, 0.01)} material={m.metal} position={[0, 0.11, z]} />
      ))}
    </group>
  );
}

// ---------- Wrapper mit Klick und Schild ----------

const LANDMARK_TEXT: Record<LandmarkKey, { name: string; icon: string; action: string }> = {
  researchLab: { name: 'Forschungsturm', icon: '🔭', action: 'Tippen zum Forschen' },
  trainStation: { name: 'Bahnhof', icon: '🚂', action: 'Mit der Bahn ins Tal' },
};

export function Landmark({
  kind, highlight, onActivate, justBuilt = false,
}: {
  kind: LandmarkKey;
  highlight: boolean;
  onActivate: () => void;
  justBuilt?: boolean;
}) {
  const plot = PLOTS[kind];
  const portal = useHtmlPortal();
  const [departing, setDeparting] = useState(0);
  const text = LANDMARK_TEXT[kind];
  const rot = facePlaza(plot.pos);
  const toWorld = useMemo(() => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return (lx: number, lz: number): [number, number] => [plot.pos[0] + lx * c + lz * s, plot.pos[1] - lx * s + lz * c];
  }, [plot, rot]);

  const activate = (e?: ThreeEvent<MouseEvent>) => {
    e?.stopPropagation();
    if (kind === 'trainStation') {
      setDeparting(Date.now());
      setTimeout(() => setDeparting(0), 2600);
    }
    onActivate();
  };

  return (
    <group position={[plot.pos[0], plot.y, plot.pos[1]]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.05, 0]} onClick={activate} visible={false}>
        <cylinderGeometry args={[plot.radius, plot.radius, 0.1, 24]} />
      </mesh>
      <GroundShadow radius={plot.radius * 1.1} />
      <group
        onClick={activate}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <GrowIn active={justBuilt}>
          {kind === 'researchLab' ? <ResearchTower /> : <TrainStation departing={departing} toWorld={toWorld} baseY={plot.y} />}
        </GrowIn>
      </group>
      <Html portal={portal} position={[0, plot.labelHeight, 0]} center distanceFactor={15} zIndexRange={[35, 0]}>
        <button className={`scene-label text-center ${highlight ? 'is-selected' : ''}`} onClick={() => activate()}>
          <div className="whitespace-nowrap">{text.icon} {text.name}</div>
          <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">{text.action}</div>
        </button>
      </Html>
    </group>
  );
}

/** Gleis ohne Bahnhof: zeigt schon vor dem Bau, wo die Bergbahn einmal fährt. */
export function RailwayOnly() {
  const plot = PLOTS.trainStation;
  const rot = facePlaza(plot.pos);
  const toWorld = useMemo(() => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return (lx: number, lz: number): [number, number] => [plot.pos[0] + lx * c + lz * s, plot.pos[1] - lx * s + lz * c];
  }, [plot, rot]);
  return (
    <group position={[plot.pos[0], plot.y, plot.pos[1]]} rotation={[0, rot, 0]}>
      <group position={[0, 0, -0.1]}>
        <Railway toWorld={toWorld} baseY={plot.y} />
      </group>
    </group>
  );
}

// ---------- Wegweiser ----------

/** Goldener, wippender Pfeil mit pulsierendem Ring über dem nächsten Ziel. */
export function Beacon({ position, height }: { position: Vec3 | [number, number]; height: number }) {
  const arrow = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [x, y, z] = position.length === 3 ? position : [position[0], 0, position[1]];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (arrow.current) {
      arrow.current.position.y = height + Math.abs(Math.sin(t * 3)) * 0.5;
      arrow.current.rotation.y = t * 1.5;
    }
    if (ring.current) {
      const s = 1 + ((t * 0.8) % 1) * 0.8;
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - ((t * 0.8) % 1));
    }
  });
  return (
    <group position={[x, y, z]}>
      <group ref={arrow}>
        <mesh rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.5, 1.0, 24]} />
          <meshStandardMaterial color={C.gold} emissive="#f2a91c" emissiveIntensity={0.7} roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.65, 20]} />
          <meshStandardMaterial color={C.gold} emissive="#f2a91c" emissiveIntensity={0.7} roughness={0.3} metalness={0.3} />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.95, 48]} />
        <meshBasicMaterial color={C.gold} transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}
