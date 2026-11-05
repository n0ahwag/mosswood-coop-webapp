// Bauplatz für ein Gebäude, das im Hofbuch noch nicht freigeschaltet ist:
// abgesteckte Erde, Schnur, ein paar Bretter und ein Schild mit der Aufgabe.

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import type { BuildingDef } from '../lib/types';
import { useHtmlPortal } from './htmlPortal';
import { facePlaza, PLOTS } from './layout';

const WOOD = '#8a5a34';
const ROPE = '#eadbb2';

export function ConstructionSite({
  type, def, questIndex, isNext,
}: {
  type: string;
  def: BuildingDef;
  questIndex: number;
  isNext: boolean;
}) {
  const plot = PLOTS[type];
  const flag = useRef<THREE.Mesh>(null);
  const portal = useHtmlPortal();
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.2) * 0.25;
  });
  if (!plot) return null;

  const r = plot.radius * 0.75;
  const corners: [number, number][] = [[-r, -r], [r, -r], [r, r], [-r, r]];

  return (
    <group position={[plot.pos[0], 0, plot.pos[1]]} rotation={[0, facePlaza(plot.pos), 0]}>
      <mesh position={[0, 0.008, 0]} receiveShadow>
        <cylinderGeometry args={[plot.radius * 0.95, plot.radius * 0.95, 0.014, 32]} />
        <meshStandardMaterial color="#c8a77a" roughness={1} />
      </mesh>

      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]} castShadow>
          <boxGeometry args={[0.1, 0.7, 0.1]} />
          <meshStandardMaterial color={WOOD} roughness={0.9} />
        </mesh>
      ))}
      {corners.map(([x, z], i) => {
        const [nx, nz] = corners[(i + 1) % 4];
        const horizontal = z === nz;
        return (
          <mesh key={`rope-${i}`} position={[(x + nx) / 2, 0.55, (z + nz) / 2]}>
            <boxGeometry args={horizontal ? [2 * r, 0.025, 0.025] : [0.025, 0.025, 2 * r]} />
            <meshStandardMaterial color={ROPE} roughness={1} />
          </mesh>
        );
      })}

      {/* Bretterstapel */}
      {[0, 1, 2].map((i) => (
        <mesh key={`plank-${i}`} position={[-0.5 + i * 0.05, 0.07 + i * 0.09, 0.4]} rotation={[0, 0.2 * i, 0]} castShadow>
          <boxGeometry args={[1.3, 0.08, 0.28]} />
          <meshStandardMaterial color={i % 2 ? '#d4a26c' : '#c08a55'} roughness={0.9} />
        </mesh>
      ))}

      {/* Schild mit Wimpel */}
      <mesh position={[0.7, 0.55, -0.2]} castShadow>
        <boxGeometry args={[0.09, 1.1, 0.09]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <mesh position={[0.7, 0.95, -0.15]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.06]} />
        <meshStandardMaterial color="#e9d3a6" roughness={0.9} />
      </mesh>
      <mesh ref={flag} position={[0.7, 1.25, -0.2]}>
        <coneGeometry args={[0.14, 0.32, 3]} />
        <meshStandardMaterial color={isNext ? '#f2bb45' : '#c46e43'} />
      </mesh>

      <Html portal={portal} position={[0, 2.2, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
        <div className={`scene-label pointer-events-none text-center ${isNext ? 'is-selected' : 'opacity-85'}`}>
          <div className="whitespace-nowrap">🔒 {def.name}</div>
          <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">
            {isNext ? 'Als Nächstes im Hofbuch' : `Hofbuch, Aufgabe ${questIndex + 1}`}
          </div>
        </div>
      </Html>
    </group>
  );
}
