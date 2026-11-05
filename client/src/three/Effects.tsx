import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { fx } from '../lib/fx';
import type { Building, Inventory } from '../lib/types';
import { PLOTS } from './layout';
import { C } from './palette';

interface Burst {
  id: number;
  pos: [number, number, number];
  moved: Inventory;
}

function Sparkles({ origin, onDone }: { origin: [number, number, number]; onDone: () => void }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const age = useRef(0);
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, () => {
        const a = Math.random() * Math.PI * 2;
        const s = 1.2 + Math.random() * 1.8;
        return {
          v: new THREE.Vector3(Math.cos(a) * s * 0.6, 3 + Math.random() * 2.5, Math.sin(a) * s * 0.6),
          p: new THREE.Vector3(...origin),
          spin: Math.random() * 6,
          color: Math.random() > 0.35 ? C.gold : '#ffffff',
        };
      }),
    [origin],
  );

  useFrame((_, delta) => {
    age.current += delta;
    const life = 1.1;
    particles.forEach((pt, i) => {
      const m = meshes.current[i];
      if (!m) return;
      pt.v.y -= 7 * delta;
      pt.p.addScaledVector(pt.v, delta);
      m.position.copy(pt.p);
      m.rotation.set(age.current * pt.spin, age.current * pt.spin, 0);
      m.scale.setScalar(Math.max(0, 1 - age.current / life) * 0.16);
    });
    if (age.current > life) onDone();
  });

  return (
    <>
      {particles.map((pt, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; }} position={origin}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={pt.color} emissive={pt.color} emissiveIntensity={0.8} />
        </mesh>
      ))}
    </>
  );
}

export function Effects({ buildings }: { buildings: Building[] }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const byId = useRef(new Map<string, Building>());
  byId.current = new Map(buildings.map((b) => [b.id, b]));
  const { camera, gl } = useThree();

  useEffect(
    () =>
      fx.on((e) => {
        if (e.type !== 'collect') return;
        const b = byId.current.get(e.buildingId);
        const plot = b && PLOTS[b.type];
        if (!plot) return;
        const pos: [number, number, number] = [plot.pos[0], 1.6, plot.pos[1]];
        setBursts((list) => [...list, { id: Date.now() + Math.random(), pos, moved: e.moved }]);

        // schwebende „+N“-Anzeige im Bildschirm-Overlay statt eines eigenen Html-Elements
        const p = new THREE.Vector3(pos[0], pos[1] + 1.4, pos[2]).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        const [resource, amount] = Object.entries(e.moved)[0] ?? [];
        if (resource) {
          fx.emit({
            type: 'screen',
            x: rect.left + ((p.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - p.y) / 2) * rect.height,
            label: `+${amount}`,
            resource,
            sparks: false,
          });
        }
      }),
    [camera, gl],
  );

  const remove = (id: number) => setBursts((list) => list.filter((b) => b.id !== id));

  return (
    <>
      {bursts.map((b) => (
        <Sparkles key={b.id} origin={b.pos} onDone={() => remove(b.id)} />
      ))}
    </>
  );
}
