// Wahrzeichen im Dorf: der Forschungsturm (öffnet das Forschungsbuch) und der
// Bahnhof (die Bahn fährt ins Tal). Dazu der goldene Wegweiser für das Hofbuch.

import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { House, Smoke } from './House';
import { useHtmlPortal } from './htmlPortal';
import { facePlaza, PLOTS, type LandmarkKey } from './layout';
import { C } from './palette';

type V3 = [number, number, number];

function Mat({ color, rough = 0.9, emissive, intensity = 0 }: { color: string; rough?: number; emissive?: string; intensity?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} emissive={emissive ?? '#000000'} emissiveIntensity={intensity} flatShading />;
}

// ---------- Forschungsturm ----------

function ResearchTower({ locked }: { locked: boolean }) {
  const telescope = useRef<THREE.Group>(null);
  const bubbles = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (telescope.current) telescope.current.rotation.y = Math.sin(t * 0.35) * 0.9;
    if (bubbles.current) {
      bubbles.current.children.forEach((b, i) => {
        const phase = (t * 0.6 + i / 4) % 1;
        b.position.y = 1.15 + phase * 0.9;
        b.scale.setScalar(locked ? 0 : 0.6 + phase * 0.6);
        ((b as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = (1 - phase) * 0.8;
      });
    }
  });

  return (
    <group>
      {/* Sockel und runder Turm */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.55, 1.7, 0.4, 10]} />
        <Mat color={C.stoneDark} />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.35, 3.1, 10]} />
        <Mat color={C.stone} />
      </mesh>
      {/* Holzband und Fenster */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.2, 0.16, 10]} />
        <Mat color={C.timber} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.2;
        return (
          <mesh key={i} position={[Math.sin(a) * 1.2, 1.9 + (i % 2) * 0.9, Math.cos(a) * 1.2]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.36, 0.5, 0.08]} />
            <Mat color="#bfe8ff" emissive="#9fdcff" intensity={locked ? 0.05 : 0.9} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.85, 1.32]} castShadow>
        <boxGeometry args={[0.6, 1.0, 0.1]} />
        <Mat color={C.timber} />
      </mesh>
      {/* Kuppel mit Teleskop */}
      <mesh position={[0, 3.45, 0]} castShadow>
        <cylinderGeometry args={[1.35, 1.3, 0.22, 12]} />
        <Mat color={C.woodLight} />
      </mesh>
      <mesh position={[0, 3.55, 0]} castShadow>
        <sphereGeometry args={[1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color="#5f93ad" rough={0.6} />
      </mesh>
      <group ref={telescope} position={[0, 4.25, 0]}>
        <mesh rotation={[0, 0, -0.75]} position={[0.45, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.17, 1.3, 8]} />
          <Mat color={C.gold} rough={0.35} />
        </mesh>
      </group>
      {/* Wetterfahne */}
      <mesh position={[0, 4.75, 0]}>
        <coneGeometry args={[0.08, 0.5, 6]} />
        <Mat color={C.gold} rough={0.4} />
      </mesh>

      {/* Tisch mit leuchtenden Kolben */}
      <group position={[1.45, 0, 1.1]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.1, 0.08, 0.6]} />
          <Mat color={C.wood} />
        </mesh>
        {[[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.25, z]}>
            <boxGeometry args={[0.07, 0.5, 0.07]} />
            <Mat color={C.timber} />
          </mesh>
        ))}
        {[['#7be0a0', -0.3], ['#c79cf2', 0.05], ['#ffd36b', 0.35]].map(([color, x], i) => (
          <group key={i} position={[x as number, 0.62, 0]}>
            <mesh>
              <sphereGeometry args={[0.12, 10, 8]} />
              <Mat color={color as string} rough={0.2} emissive={color as string} intensity={locked ? 0.05 : 0.8} />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.035, 0.05, 0.14, 6]} />
              <Mat color="#e8f4f2" rough={0.2} />
            </mesh>
          </group>
        ))}
        <group ref={bubbles} position={[0.05, 0, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[(i - 1.5) * 0.12, 1.2, 0]}>
              <sphereGeometry args={[0.05, 6, 5]} />
              <meshStandardMaterial color="#d9fbe8" transparent opacity={0.6} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Bücherstapel */}
      <group position={[-1.5, 0, 1.0]}>
        {['#c46e43', '#5f93ad', '#9ac17a'].map((c, i) => (
          <mesh key={c} position={[0, 0.07 + i * 0.12, 0]} rotation={[0, i * 0.4, 0]} castShadow>
            <boxGeometry args={[0.5, 0.11, 0.36]} />
            <Mat color={c} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Bahnhof ----------

function Rails({ length }: { length: number }) {
  const sleepers = Math.floor(length / 0.55);
  return (
    <group>
      {Array.from({ length: sleepers }, (_, i) => (
        <mesh key={i} position={[-length / 2 + 0.3 + i * 0.55, 0.04, 0]} receiveShadow>
          <boxGeometry args={[0.22, 0.07, 1.05]} />
          <Mat color={C.timber} />
        </mesh>
      ))}
      {[-0.32, 0.32].map((z) => (
        <mesh key={z} position={[0, 0.11, z]}>
          <boxGeometry args={[length, 0.06, 0.07]} />
          <meshStandardMaterial color="#8b8f96" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Wheel({ position, r = 0.22 }: { position: V3; r?: number }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[r, r, 0.1, 12]} />
      <meshStandardMaterial color="#3d3a38" metalness={0.4} roughness={0.5} />
    </mesh>
  );
}

function Train({ smoking }: { smoking: boolean }) {
  return (
    <group>
      {/* Lok */}
      <group position={[0.9, 0.14, 0]}>
        <mesh position={[0.25, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 1.1, 12]} />
          <Mat color="#3f7a52" rough={0.5} />
        </mesh>
        <mesh position={[0.82, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.36, 0.36, 0.06, 12]} />
          <Mat color={C.gold} rough={0.3} />
        </mesh>
        <mesh position={[-0.55, 0.62, 0]} castShadow>
          <boxGeometry args={[0.6, 0.85, 0.78]} />
          <Mat color="#c9563a" />
        </mesh>
        <mesh position={[-0.55, 1.1, 0]} castShadow>
          <boxGeometry args={[0.75, 0.1, 0.92]} />
          <Mat color={C.timber} />
        </mesh>
        <mesh position={[-0.55, 0.78, 0.4]}>
          <boxGeometry args={[0.3, 0.26, 0.02]} />
          <Mat color={C.window} emissive={C.window} intensity={0.6} />
        </mesh>
        <mesh position={[0.55, 1.02, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.13, 0.42, 8]} />
          <Mat color="#3d3a38" />
        </mesh>
        <Smoke position={[0.55, 1.25, 0]} active={smoking} size={0.8} />
        {[-0.5, 0.05, 0.55].map((x) => (
          <group key={x}>
            <Wheel position={[x, 0.2, 0.36]} />
            <Wheel position={[x, 0.2, -0.36]} />
          </group>
        ))}
      </group>
      {/* Wagen */}
      <group position={[-0.7, 0.14, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[1.25, 0.7, 0.8]} />
          <Mat color={C.woodLight} />
        </mesh>
        <mesh position={[0, 0.96, 0]} castShadow>
          <boxGeometry args={[1.35, 0.1, 0.92]} />
          <Mat color={C.terracotta} />
        </mesh>
        {[-0.35, 0.05, 0.45].map((x) => (
          <mesh key={x} position={[x - 0.05, 0.62, 0.41]}>
            <boxGeometry args={[0.26, 0.24, 0.02]} />
            <Mat color={C.window} emissive={C.window} intensity={0.5} />
          </mesh>
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

export function TrainStation({ locked, departing }: { locked: boolean; departing: number }) {
  const train = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!train.current) return;
    // departing: Zeitstempel der Abfahrt (0 = steht im Bahnhof)
    const target = departing ? 9 : 0;
    train.current.position.x += (target - train.current.position.x) * Math.min(1, dt * (departing ? 1.6 : 3));
  });
  return (
    <group>
      {/* Bahnsteig */}
      <mesh position={[0, 0.18, 1.0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.36, 1.2]} />
        <Mat color={C.stone} />
      </mesh>
      <group position={[0, 0, -0.1]}>
        <Rails length={6.4} />
        <group ref={train}>
          <Train smoking={!locked} />
        </group>
      </group>
      {/* Stationshäuschen */}
      <group position={[-1.1, 0.36, 2.0]} rotation={[0, Math.PI, 0]}>
        <House w={1.6} d={1.1} h={1.0} roof={C.terracotta} chimney={false} flowers />
      </group>
      {/* Laterne mit Schild */}
      <group position={[1.4, 0.36, 1.3]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 1.4, 6]} />
          <Mat color={C.timber} />
        </mesh>
        <mesh position={[0, 1.15, 0.02]} castShadow>
          <boxGeometry args={[0.9, 0.34, 0.06]} />
          <Mat color="#3f7a52" />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <Mat color={C.window} emissive={C.window} intensity={0.9} />
        </mesh>
      </group>
      {/* Prellböcke */}
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} position={[x, 0.25, -0.1]} castShadow>
          <boxGeometry args={[0.2, 0.5, 0.9]} />
          <Mat color={C.terracottaDark} />
        </mesh>
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
  kind, locked, lockedHint, highlight, onActivate,
}: {
  kind: LandmarkKey;
  locked: boolean;
  lockedHint: string;
  highlight: boolean;
  onActivate: () => void;
}) {
  const plot = PLOTS[kind];
  const portal = useHtmlPortal();
  const [hover, setHover] = useState(false);
  const [departing, setDeparting] = useState(0);
  const text = LANDMARK_TEXT[kind];

  const activate = (e?: ThreeEvent<MouseEvent>) => {
    e?.stopPropagation();
    if (kind === 'trainStation' && !locked) {
      setDeparting(Date.now());
      setTimeout(() => setDeparting(0), 2500);
    }
    onActivate();
  };

  return (
    <group position={[plot.pos[0], 0, plot.pos[1]]} rotation={[0, facePlaza(plot.pos), 0]}>
      <mesh position={[0, 0.006, 0]} receiveShadow onClick={activate}>
        <cylinderGeometry args={[plot.radius, plot.radius, 0.012, 36]} />
        <meshStandardMaterial color={hover ? C.grassLight : '#9acb62'} roughness={1} />
      </mesh>
      <group
        onClick={activate}
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
        {kind === 'researchLab' ? <ResearchTower locked={locked} /> : <TrainStation locked={locked} departing={departing} />}
      </group>
      <Html portal={portal} position={[0, plot.labelHeight, 0]} center distanceFactor={9} zIndexRange={[35, 0]}>
        <button
          className={`scene-label text-center ${highlight ? 'is-selected' : ''} ${locked ? 'opacity-85' : ''}`}
          onClick={() => activate()}
        >
          <div className="whitespace-nowrap">{locked ? '🔒' : text.icon} {text.name}</div>
          <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">{locked ? lockedHint : text.action}</div>
        </button>
      </Html>
    </group>
  );
}

// ---------- Wegweiser ----------

/** Goldener, wippender Pfeil mit pulsierendem Ring über dem nächsten Ziel. */
export function Beacon({ position, height }: { position: [number, number]; height: number }) {
  const arrow = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
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
    <group position={[position[0], 0, position[1]]}>
      <group ref={arrow}>
        <mesh rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.45, 0.9, 4]} />
          <meshStandardMaterial color={C.gold} emissive="#f2a91c" emissiveIntensity={0.55} roughness={0.35} flatShading />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.24, 0.6, 0.24]} />
          <meshStandardMaterial color={C.gold} emissive="#f2a91c" emissiveIntensity={0.55} roughness={0.35} />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.95, 40]} />
        <meshBasicMaterial color={C.gold} transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}
