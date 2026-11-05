// Ruine eines Gebäudes, das noch nicht (wieder) aufgebaut ist. Jede Ruine ist das
// spätere Gebäude selbst, nur verwittert: Farben verblasst, Dach eingestürzt, Kleinteile
// umgekippt oder verschwunden, dazu Geröll, Bretter und Unkraut. Ist genug im Lager,
// steht ein Gerüst daneben und ein Hammer schwebt darüber. Antippen öffnet das Bau-Panel.

import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { ResourceIcon } from '../components/icons/ResourceIcon';
import type { BuildingDef, BuildPlan, Inventory } from '../lib/types';
import { BuildingModel, Ring } from './Buildings';
import { useHtmlPortal } from './htmlPortal';
import { ResearchTower, TrainStation } from './Landmarks';
import { facePlaza, hashString, mulberry32, PLOTS } from './layout';
import { box, cyl, mats, sphere } from './materials';
import { GroundShadow } from './Mountain';
import { C } from './palette';
import { tex } from './textures';

// ---------- Verwitterung ----------

const RUIN_TINT = new THREE.Color('#bdb39f');
const weatheredCache = new WeakMap<THREE.Material, THREE.Material>();

function weathered(mat: THREE.Material): THREE.Material {
  const hit = weatheredCache.get(mat);
  if (hit) return hit;
  const w = mat.clone() as THREE.MeshStandardMaterial;
  if (w.color) w.color.lerp(RUIN_TINT, 0.42);
  if (w.emissive) {
    w.emissive.set('#000000');
    w.emissiveIntensity = 0;
  }
  if (typeof w.roughness === 'number') w.roughness = Math.min(1, w.roughness + 0.15);
  if (typeof w.metalness === 'number') w.metalness *= 0.4;
  weatheredCache.set(mat, w);
  return w;
}

/** Verwandelt das eingehängte Modell einmalig in eine Ruine. */
function Ruin({ seed, children }: { seed: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g || g.userData.ruined) return;
    g.userData.ruined = true;
    const m = mats();
    const roofs = new Set<THREE.Material>([m.roofRed, m.roofDark, m.roofSlate, m.roofMoss, m.thatch]);
    const rng = mulberry32(seed);
    g.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) {
        o.visible = false;
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const original = mesh.material as THREE.Material;
      const roof = !Array.isArray(original) && roofs.has(original);
      mesh.material = Array.isArray(original) ? original.map(weathered) : weathered(original);

      const inst = o as THREE.InstancedMesh;
      if (inst.isInstancedMesh) {
        // Felder und Stapel: nur noch ein paar verwilderte Reste
        inst.count = Math.max(1, Math.floor(inst.count * 0.3));
        return;
      }
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const r = (mesh.geometry.boundingSphere?.radius ?? 0.3) * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
      const roll = rng();
      if (roof && r > 0.4) {
        // eine Dachseite ist eingestürzt, die andere hängt durch
        if (roll < 0.45) mesh.visible = false;
        else {
          mesh.rotation.x += (rng() - 0.5) * 0.35;
          mesh.rotation.y += (rng() - 0.5) * 0.2;
          mesh.position.y -= 0.12 + rng() * 0.12;
        }
        return;
      }
      if (r < 0.32) {
        if (roll < 0.42) mesh.visible = false;
        else if (roll < 0.75) {
          mesh.rotation.z += (rng() - 0.5) * 1.3;
          mesh.rotation.x += (rng() - 0.5) * 0.9;
        }
      } else if (r < 0.9) {
        if (roll < 0.2) mesh.visible = false;
        else if (roll < 0.55) mesh.rotation.z += (rng() - 0.5) * 0.45;
      }
    });
  }, [seed]);
  return (
    <group ref={ref} rotation={[0.035, 0, -0.03]} scale={[1, 0.93, 1]}>
      {children}
    </group>
  );
}

// ---------- Geröll, Bretter, Unkraut ----------

function Rubble({ radius, seed }: { radius: number; seed: number }) {
  const m = mats();
  const weeds = useMemo(() => {
    const t = tex('leafy');
    return new THREE.MeshStandardMaterial({ color: '#7fbf4c', map: t.map, normalMap: t.normal, roughness: 0.85 });
  }, []);
  const items = useMemo(() => {
    const rng = mulberry32(seed + 7);
    const at = (minR: number, maxR: number) => {
      const a = rng() * Math.PI * 2;
      const r = radius * (minR + rng() * (maxR - minR));
      return [Math.cos(a) * r, Math.sin(a) * r] as const;
    };
    return {
      stones: Array.from({ length: 7 }, () => ({ p: at(0.45, 0.95), s: 0.12 + rng() * 0.16, r: rng() * 6 })),
      planks: Array.from({ length: 4 }, () => ({ p: at(0.4, 0.9), r: rng() * Math.PI, tilt: (rng() - 0.5) * 0.5 })),
      weeds: Array.from({ length: 9 }, () => ({ p: at(0.3, 1.0), s: 0.18 + rng() * 0.2 })),
    };
  }, [radius, seed]);
  return (
    <group>
      {items.stones.map((s, i) => (
        <mesh key={`s${i}`} geometry={box(s.s * 2, s.s * 1.4, s.s * 1.6, s.s * 0.4)} material={i % 2 ? m.stone : m.stoneDark} position={[s.p[0], s.s * 0.6, s.p[1]]} rotation={[s.r, s.r * 2, s.r * 0.5]} castShadow />
      ))}
      {items.planks.map((p, i) => (
        <mesh key={`p${i}`} geometry={box(1.0, 0.06, 0.2, 0.015)} material={weathered(m.wood)} position={[p.p[0], 0.06, p.p[1]]} rotation={[p.tilt, p.r, p.tilt * 0.6]} castShadow />
      ))}
      {items.weeds.map((w, i) => (
        <mesh key={`w${i}`} geometry={sphere(1, 14, 10)} material={weeds} position={[w.p[0], w.s * 0.35, w.p[1]]} scale={[w.s, w.s * 0.8, w.s]} castShadow />
      ))}
    </group>
  );
}

function Scaffold({ radius }: { radius: number }) {
  const m = mats();
  const r = radius * 0.72;
  const poles: [number, number][] = [[-r, -r], [r, -r], [r, r], [-r, r]];
  return (
    <group>
      {poles.map(([x, z], i) => (
        <mesh key={i} geometry={box(0.1, 2.4, 0.1, 0.02)} material={m.beam} position={[x, 1.2, z]} castShadow />
      ))}
      {[0.9, 1.8].map((y) => (
        <group key={y}>
          <mesh geometry={box(2 * r, 0.08, 0.26, 0.015)} material={m.woodLight} position={[0, y, -r]} />
          <mesh geometry={box(2 * r, 0.08, 0.26, 0.015)} material={m.woodLight} position={[0, y, r]} />
        </group>
      ))}
    </group>
  );
}

function RuinModel({ type }: { type: string }) {
  if (type === 'researchLab') return <ResearchTower />;
  if (type === 'trainStation') return <TrainStation departing={0} smoking={false} />;
  return <BuildingModel type={type} working={false} />;
}

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
  const hammer = useRef<THREE.Group>(null);
  const portal = useHtmlPortal();
  const [hover, setHover] = useState(false);
  const seed = hashString(plan.type);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (hammer.current) {
      hammer.current.position.y = (plot?.labelHeight ?? 3) - 0.4 + Math.abs(Math.sin(t * 3)) * 0.3;
      hammer.current.rotation.z = 0.6 + Math.sin(t * 6) * 0.35;
    }
  });
  if (!plot) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(plan.type);
  };
  const locked = !plan.available;

  return (
    <group position={[plot.pos[0], plot.y, plot.pos[1]]} rotation={[0, facePlaza(plot.pos), 0]}>
      <mesh position={[0, 0.05, 0]} onClick={click} visible={false}>
        <cylinderGeometry args={[plot.radius, plot.radius, 0.1, 24]} />
      </mesh>
      <GroundShadow radius={plot.radius} opacity={hover ? 0.3 : 0.18} />
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
        <Ruin seed={seed}>
          <RuinModel type={plan.type} />
        </Ruin>
        <Rubble radius={plot.radius} seed={seed} />
        {plan.affordable && <Scaffold radius={plot.radius} />}
      </group>
      {plan.affordable && (
        <group ref={hammer} position={[0, plot.labelHeight - 0.4, 0]}>
          <mesh geometry={box(0.1, 0.8, 0.1, 0.03)} material={m.beam} />
          <mesh geometry={box(0.42, 0.2, 0.2, 0.05)} material={m.metal} position={[0, 0.4, 0]} />
          <mesh geometry={cyl(0.06, 0.06, 0.12, 12)} material={m.gold} position={[0, -0.42, 0]} />
        </group>
      )}
      {(selected || highlight) && <Ring radius={plot.radius * 0.95} color={plan.affordable ? '#9be36b' : C.gold} speed={3} />}

      <Html portal={portal} position={[0, plot.labelHeight + (plan.affordable ? 0.6 : 0), 0]} center distanceFactor={11} zIndexRange={[25, 0]}>
        <button
          className={`scene-label text-center ${selected || highlight ? 'is-selected' : ''} ${locked ? 'opacity-80' : ''}`}
          onClick={() => onClick(plan.type)}
        >
          <div className="whitespace-nowrap">
            {locked ? '🔒' : plan.affordable ? '🔨' : '🏚️'} {def.name}
          </div>
          {locked ? (
            <div className="text-[11px] font-bold whitespace-nowrap text-bark-500">
              Ruine · erst {plan.missing.map(names).join(', ')}
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
          {plan.affordable && <div className="text-[11px] font-bold text-moss-700">Tippen zum Aufbauen</div>}
        </button>
      </Html>
    </group>
  );
}
