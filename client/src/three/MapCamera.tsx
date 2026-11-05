// Kamera wie bei einer Karte: feste Blickrichtung schräg von oben, Ziehen mit
// Finger oder Maus verschiebt die Ansicht, Mausrad bzw. zwei Finger zoomen ein
// wenig. Drehen gibt es nicht. Ausgewählte Ziele werden sanft in die Mitte geschoben.

import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useHudOffset } from './htmlPortal';
import type { Vec3 } from './layout';

/** Blickrichtung (vom Ziel zur Kamera): von rechts vorne, etwa 36° über dem Horizont. */
const VIEW_DIR = new THREE.Vector3(14, 15, 17.5).normalize();
const POLAR = Math.acos(VIEW_DIR.y);

const MOUSE = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
const TOUCH = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };

export interface MapCameraProps {
  /** Startpunkt, auf den die Kamera schaut */
  home: Vec3;
  /** Abstand für breite und für hochkante Bildschirme */
  distance: { wide: number; tall: number };
  minDistance: number;
  maxDistance: number;
  /** Wie weit sich der Blickpunkt vom Startpunkt entfernen darf */
  panRadius: number;
  /** Höhenbereich des Blickpunkts (beim Hinfliegen zu hohen Gipfeln) */
  yRange: [number, number];
  /** Ziel, zu dem die Kamera gleitet; neuer focusKey = neuer Flug */
  focus: Vec3 | null;
  focusKey: string;
}

export function MapCamera({ home, distance, minDistance, maxDistance, panRadius, yRange, focus, focusKey }: MapCameraProps) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<THREE.Vector3 | null>(null);
  const tall = size.height > 0 && size.width / size.height < 1;
  const homeKey = home.join(',');

  // Startansicht (und neu, wenn der Bildschirm von quer auf hochkant wechselt)
  useEffect(() => {
    const target = new THREE.Vector3(...home);
    camera.position.copy(target).addScaledVector(VIEW_DIR, tall ? distance.tall : distance.wide);
    camera.lookAt(target);
    controls.current?.target.copy(target);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tall, camera, homeKey]);
  useHudOffset();

  useEffect(() => {
    if (focus) goal.current = new THREE.Vector3(...focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  useFrame((_, dt) => {
    const ctl = controls.current;
    if (!ctl) return;
    const t = ctl.target;
    const before = t.clone();
    // sanft zum Ziel gleiten (Kamera und Blickpunkt gemeinsam, der Blickwinkel bleibt)
    if (goal.current) {
      const k = 1 - Math.exp(-dt * 3.5);
      t.lerp(goal.current, k);
      if (t.distanceTo(goal.current) < 0.05) goal.current = null;
    }
    // nicht zu weit vom Berg bzw. Tal wegschieben
    const dx = t.x - home[0];
    const dz = t.z - home[2];
    const r = Math.hypot(dx, dz);
    if (r > panRadius) {
      t.x = home[0] + (dx / r) * panRadius;
      t.z = home[2] + (dz / r) * panRadius;
    }
    t.y = THREE.MathUtils.clamp(t.y, yRange[0], yRange[1]);
    // Kamera um denselben Weg verschieben: Abstand und Blickwinkel bleiben gleich
    camera.position.add(t.clone().sub(before));
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enablePan
      screenSpacePanning={false}
      mouseButtons={MOUSE}
      touches={TOUCH}
      panSpeed={1.1}
      zoomSpeed={0.7}
      enableDamping
      dampingFactor={0.12}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={POLAR}
      maxPolarAngle={POLAR}
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}
