// Bauplatz für ein Gebäude, das noch nicht steht: abgesteckte Fläche, Schnur,
// Bretter, Steine und ein Schild mit den Baukosten. Antippen öffnet das Bau-Panel.

import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type * as THREE from 'three';
import { ResourceIcon } from '../components/icons/ResourceIcon';
import type { BuildingDef, BuildPlan, Inventory } from '../lib/types';
import { Ring } from './Buildings';
import { useHtmlPortal } from './htmlPortal';
import { facePlaza, PLOTS } from './layout';
import { box, cyl, mats } from './materials';
import { C } from './palette';

export function ConstructionSite({
  plan, def, inventory, highlight, selected, onClick, names,
}: {
  plan: BuildPlan;
  def: BuildingDef;
  inventory: Inventory;
  highlight: boolean;
  selected: boolean;
  onClick: (type: string) => void;
  names: (type: string) => string;
}) {
  const m = mats();
  const plot = PLOTS[plan.type];
  const flag = useRef<THREE.Mesh>(null);
  const hammer = useRef<THREE.Group>(null);
  const portal = useHtmlPortal();
  const [hover, setHover] = useState(false);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (flag.current) flag.current.rotation.y = Math.sin(t * 2.2) * 0.25;
    if (hammer.current) hammer.current.position.y = 1.55 + (plan.affordable ? Math.abs(Math.sin(t * 3)) * 0.25 : 0);
  });
  if (!plot) return null;

  const r = plot.radius * 0.72;
  const corners: [number, number][] = [[-r, -r], [r, -r], [r, r], [-r, r]];
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(plan.type);
  };
  const locked = !plan.available;

  return (
    <group position={[plot.pos[0], plot.y, plot.pos[1]]} rotation={[0, facePlaza(plot.pos), 0]}>
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
        <mesh geometry={cyl(plot.radius * 0.92, plot.radius * 0.95, 0.06, 40)} material={hover ? m.soil : m.soilDark} position={[0, 0.02, 0]} receiveShadow />
        {corners.map(([x, z], i) => (
          <mesh key={i} geometry={box(0.1, 0.75, 0.1, 0.02)} material={m.timber} position={[x, 0.37, z]} castShadow />
        ))}
        {corners.map(([x, z], i) => {
          const [nx, nz] = corners[(i + 1) % 4];
          const horizontal = z === nz;
          return (
            <mesh
              key={`rope-${i}`}
              geometry={box(horizontal ? 2 * r : 0.025, 0.025, horizontal ? 0.025 : 2 * r, 0)}
              material={m.rope}
              position={[(x + nx) / 2, 0.58, (z + nz) / 2]}
            />
          );
        })}
        {!locked && (
          <>
            {[0, 1, 2].map((i) => (
              <mesh key={`plank-${i}`} geometry={box(1.3, 0.08, 0.28, 0.015)} material={i % 2 ? m.woodLight : m.wood} position={[-0.5 + i * 0.05, 0.1 + i * 0.09, 0.45]} rotation={[0, 0.2 * i, 0]} castShadow />
            ))}
            {[[0.6, 0.55], [0.9, 0.3], [0.75, 0.85]].map(([x, z], i) => (
              <mesh key={`stone-${i}`} geometry={box(0.32, 0.26, 0.32, 0.05)} material={m.stone} position={[x, 0.15 + (i === 2 ? 0.26 : 0), z]} castShadow />
            ))}
          </>
        )}
        {/* Schild mit Wimpel */}
        <mesh geometry={box(0.09, 1.15, 0.09, 0.02)} material={m.timber} position={[-0.75, 0.58, -0.3]} castShadow />
        <mesh geometry={box(0.75, 0.42, 0.06, 0.02)} material={m.woodLight} position={[-0.75, 1.0, -0.25]} castShadow />
        <mesh ref={flag} position={[-0.75, 1.32, -0.3]}>
          <coneGeometry args={[0.15, 0.34, 12]} />
          <meshStandardMaterial color={plan.affordable ? C.gold : highlight ? '#f2bb45' : '#c46e43'} roughness={0.6} />
        </mesh>
        {/* schwebender Hammer, wenn man bauen kann */}
        {plan.affordable && (
          <group ref={hammer} position={[0.2, 1.55, 0]} rotation={[0, 0, 0.6]}>
            <mesh geometry={box(0.08, 0.7, 0.08, 0.02)} material={m.beam} />
            <mesh geometry={box(0.36, 0.16, 0.16, 0.03)} material={m.metal} position={[0, 0.35, 0]} />
          </group>
        )}
      </group>
      {(selected || highlight) && <Ring radius={plot.radius * 0.95} color={plan.affordable ? '#9be36b' : C.gold} speed={3} />}

      <Html portal={portal} position={[0, locked ? 1.9 : 2.5, 0]} center distanceFactor={15} zIndexRange={[25, 0]}>
        <button
          className={`scene-label text-center ${selected || highlight ? 'is-selected' : ''} ${locked ? 'opacity-75' : ''}`}
          onClick={() => onClick(plan.type)}
        >
          <div className="whitespace-nowrap">
            {locked ? '🔒' : plan.affordable ? '🔨' : '🏗️'} {def.name}
          </div>
          {locked ? (
            <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">
              Benötigt {plan.missing.map(names).join(', ')}
            </div>
          ) : (
            <div className="mt-0.5 flex items-center justify-center gap-1">
              {Object.entries(plan.cost).map(([res, n]) => {
                const have = inventory[res] ?? 0;
                return (
                  <span
                    key={res}
                    className={`flex items-center gap-0.5 rounded-lg px-1 text-[11px] font-bold tabular-nums ${have >= n ? 'bg-moss-100 text-moss-800' : 'bg-clay-200 text-clay-500'}`}
                  >
                    <ResourceIcon resource={res} size={16} />
                    {Math.min(have, n)}/{n}
                  </span>
                );
              })}
            </div>
          )}
          {plan.affordable && <div className="text-[11px] font-bold text-moss-700">Tippen zum Bauen</div>}
        </button>
      </Html>
    </group>
  );
}
