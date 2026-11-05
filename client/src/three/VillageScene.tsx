// Die 3D-Dorfansicht: ein Bergdorf über den Wolken. Wird per React.lazy nachgeladen,
// damit Three.js nicht im ersten Bundle landet.

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { GameContent, VillageState } from '../lib/types';
import { BuildingPlot, DiningTable, Homes } from './Buildings';
import { QUALITY, WorldClock } from './clock';
import { ConstructionSite } from './ConstructionSite';
import { Effects } from './Effects';
import { HtmlPortalContext, useHudOffset } from './htmlPortal';
import { Beacon, Landmark, RailwayOnly } from './Landmarks';
import {
  HOME_SLOTS, homeSpot, plazaSpot, PLOTS, TABLE_POS, tableSpot, VILLAGE, workSpot, type LandmarkKey, type Vec3,
} from './layout';
import { Crossings, Lake, Plaza, Terrain, Waterfalls } from './Mountain';
import { CloudBanks, CloudSea, DistantMountains, Lights, SKY, SkyDome } from './Sky';
import { Boulders, Meadow, Trees } from './Vegetation';
import { Villager3D, type VillagerPlan } from './Villager3D';

export interface VillageSceneProps {
  /** false = Szene ist versteckt; dann wird nicht gerendert. */
  active?: boolean;
  village: VillageState;
  content: GameContent;
  selectedVillagerId: string | null;
  selectedBuildingId: string | null;
  onSelectVillager: (id: string) => void;
  onBuildingClick: (id: string) => void;
  onCollect: (id: string) => void;
  onBackgroundClick: () => void;
  /** Wohin der goldene Wegweiser zeigt (Gebäudetyp oder Wahrzeichen). */
  guide?: { kind: 'building'; type: string } | { kind: 'landmark'; key: LandmarkKey } | null;
  selectedPlan?: string | null;
  onPlanClick?: (type: string) => void;
  onOpenResearch?: () => void;
  onOpenValley?: () => void;
}

const noop = () => {};

/** Mittelpunkt des Berges für die Startansicht */
const HOME_TARGET = new THREE.Vector3(0.4, 4.2, -0.6);
const HOME_TARGET_ARR = HOME_TARGET.toArray() as [number, number, number];
const VIEW_DIR = new THREE.Vector3(14, 15, 17.5).normalize();

function baseDistance(aspect: number) {
  // Breite Bildschirme zeigen den ganzen Berg; hochkant weiter wegzoomen.
  return aspect < 1.25 ? Math.min(92, Math.max(50, 62 / aspect)) : 50;
}

/**
 * Kamera: startet mit Blick auf den ganzen Berg und fliegt sanft zu ausgewählten
 * Gebäuden. Sobald man selbst dreht oder zoomt, endet der Flug.
 */
function CameraRig({ focus, focusKey }: { focus: Vec3 | null; focusKey: string }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef<{ target: THREE.Vector3; distance: number } | null>(null);
  const aspectStep = size.height > 0 ? Math.round((size.width / size.height) * 10) : 0;

  useEffect(() => {
    if (!aspectStep) return;
    const dist = baseDistance(aspectStep / 10);
    camera.position.copy(HOME_TARGET).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(HOME_TARGET);
    controls.current?.target.copy(HOME_TARGET);
    controls.current?.update();
  }, [aspectStep, camera]);
  useHudOffset();

  useEffect(() => {
    if (!focus) return;
    const ctl = controls.current;
    const current = ctl ? camera.position.distanceTo(ctl.target) : 40;
    goal.current = { target: new THREE.Vector3(...focus), distance: Math.min(current, 30) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  useFrame((_, dt) => {
    const ctl = controls.current;
    const g = goal.current;
    if (!ctl || !g) return;
    const k = 1 - Math.exp(-dt * 3.2);
    const offset = camera.position.clone().sub(ctl.target);
    const dist = offset.length();
    ctl.target.lerp(g.target, k);
    const nextDist = dist + (g.distance - dist) * k;
    camera.position.copy(ctl.target).addScaledVector(offset.normalize(), nextDist);
    ctl.update();
    if (ctl.target.distanceTo(g.target) < 0.05 && Math.abs(nextDist - g.distance) < 0.1) goal.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      screenSpacePanning={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={9}
      maxDistance={110}
      minPolarAngle={0.35}
      maxPolarAngle={1.22}
      target={HOME_TARGET_ARR}
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}

/** Begrenzt das Verschieben, damit man den Berg nicht aus den Augen verliert. */
function PanLimit() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useFrame(() => {
    if (!controls) return;
    const t = controls.target;
    const r = Math.hypot(t.x, t.z);
    if (r > 22) {
      t.x *= 22 / r;
      t.z *= 22 / r;
    }
    t.y = THREE.MathUtils.clamp(t.y, 1.5, 12);
  });
  return null;
}

export default function VillageScene({
  active = true, village, content, selectedVillagerId, selectedBuildingId,
  onSelectVillager, onBuildingClick, onCollect, onBackgroundClick,
  guide, selectedPlan = null, onPlanClick = noop, onOpenResearch = noop, onOpenValley = noop,
}: VillageSceneProps) {
  const guideType = guide ? (guide.kind === 'building' ? guide.type : guide.key) : null;
  const guidePlot = guideType ? PLOTS[guideType] : undefined;
  const built = useMemo(() => new Set(village.buildings.map((b) => b.type)), [village.buildings]);
  const guideBuilt = guideType ? built.has(guideType) : false;

  // Gebäude, die es beim ersten Anzeigen schon gab, wachsen nicht noch einmal aus dem Boden.
  const initialIds = useRef<Set<string> | null>(null);
  initialIds.current ??= new Set(village.buildings.map((b) => b.id));
  const isNew = (id: string) => !initialIds.current?.has(id);

  const plans = useMemo(() => {
    const byId = new Map(village.buildings.map((b) => [b.id, b]));
    const out = new Map<string, VillagerPlan>();
    village.villagers.forEach((v, idx) => {
      const b = v.buildingId ? byId.get(v.buildingId) : undefined;
      let plan: VillagerPlan;
      switch (v.state) {
        case 'WORKING': {
          if (b && PLOTS[b.type]) {
            const def = content.buildings[b.type];
            plan = {
              target: workSpot(b.type, Math.max(0, b.workerIds.indexOf(v.id))),
              look: PLOTS[b.type].pos,
              mode: def?.category === 'gathering' ? 'swing' : 'carry',
              carry: def ? Object.keys(def.outputs)[0] : undefined,
            };
          } else {
            plan = { target: plazaSpot(idx), look: VILLAGE.pos, mode: 'idle' };
          }
          break;
        }
        case 'HUNGRY':
          plan = { target: tableSpot(idx), look: TABLE_POS, mode: 'hungry' };
          break;
        case 'EATING':
          plan = { target: tableSpot(idx), look: TABLE_POS, mode: 'eat' };
          break;
        case 'TIRED':
          plan = { target: homeSpot(idx), look: VILLAGE.pos, mode: 'tired' };
          break;
        case 'RESTING':
          plan = { target: homeSpot(idx), look: VILLAGE.pos, mode: 'rest' };
          break;
        default:
          plan = { target: plazaSpot(idx), look: VILLAGE.pos, mode: 'idle' };
      }
      out.set(v.id, plan);
    });
    return out;
  }, [village.buildings, village.villagers, content.buildings]);

  // Kamera-Ziel: ausgewähltes Gebäude oder Bauplatz
  const focusType = selectedPlan ?? village.buildings.find((b) => b.id === selectedBuildingId)?.type ?? null;
  const focusPlot = focusType ? PLOTS[focusType] : undefined;
  const focus: Vec3 | null = focusPlot ? [focusPlot.pos[0], focusPlot.y + 1, focusPlot.pos[1]] : null;

  const portalRef = useRef<HTMLDivElement>(null);
  const homeCount = Math.min(HOME_SLOTS.length, Math.max(2, village.villagers.length));
  const selectedVillager = village.villagers.find((v) => v.id === selectedVillagerId) ?? null;
  const names = (t: string) => content.buildings[t]?.name ?? t;

  return (
    <div ref={portalRef} className="relative h-full w-full">
      <HtmlPortalContext.Provider value={portalRef as RefObject<HTMLElement>}>
        <Canvas
          frameloop={active ? 'always' : 'never'}
          shadows
          dpr={QUALITY === 'high' ? [1, 2] : [1, 1.5]}
          camera={{ position: [30, 34, 40], fov: 34, near: 0.5, far: 1200 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.05;
            if (import.meta.env.DEV) (window as unknown as { __mwGl?: THREE.WebGLRenderer }).__mwGl = gl;
          }}
          onPointerMissed={onBackgroundClick}
        >
          <WorldClock />
          <CameraRig focus={focus} focusKey={focusType ?? ''} />
          <PanLimit />
          <fog attach="fog" args={[SKY.fog, 80, 320]} />
          <Lights />

          <SkyDome />
          <CloudSea />
          <CloudBanks />
          <DistantMountains />

          <Terrain />
          <Plaza />
          <Crossings />
          <Lake />
          <Waterfalls />
          <Trees />
          <Meadow />
          <Boulders />
          <DiningTable />
          <Homes
            slots={HOME_SLOTS.slice(0, homeCount)}
            occupiedResting={HOME_SLOTS.slice(0, homeCount).map((_, i) => {
              const v = village.villagers[i];
              return v ? v.state === 'RESTING' || v.state === 'TIRED' : false;
            })}
          />

          {village.buildings.map((b) => {
            const def = content.buildings[b.type];
            if (!def || def.category === 'landmark') return null;
            const canAssign = !!selectedVillager && selectedVillager.buildingId !== b.id && b.workerIds.length < def.slots;
            return (
              <BuildingPlot
                key={b.id}
                building={b}
                def={def}
                selected={selectedBuildingId === b.id}
                canAssign={canAssign}
                onClick={onBuildingClick}
                onCollect={onCollect}
                justBuilt={isNew(b.id)}
              />
            );
          })}

          {village.progression.plans.map((plan) => {
            const def = content.buildings[plan.type];
            if (!def || !PLOTS[plan.type]) return null;
            return (
              <ConstructionSite
                key={plan.type}
                plan={plan}
                def={def}
                inventory={village.inventory}
                highlight={guideType === plan.type}
                selected={selectedPlan === plan.type}
                onClick={onPlanClick}
                names={names}
              />
            );
          })}

          {village.buildings
            .filter((b) => content.buildings[b.type]?.category === 'landmark')
            .map((b) => (
              <Landmark
                key={b.id}
                kind={b.type as LandmarkKey}
                highlight={guideType === b.type}
                onActivate={b.type === 'researchLab' ? onOpenResearch : onOpenValley}
                justBuilt={isNew(b.id)}
              />
            ))}
          {!built.has('trainStation') && <RailwayOnly />}

          {village.villagers.map((v) => {
            const plan = plans.get(v.id);
            if (!plan) return null;
            return (
              <Villager3D
                key={v.id}
                villager={v}
                plan={plan}
                selected={selectedVillagerId === v.id}
                onSelect={onSelectVillager}
              />
            );
          })}

          {guidePlot && (
            <Beacon
              position={[guidePlot.pos[0], guidePlot.y, guidePlot.pos[1]]}
              height={(guideBuilt ? guidePlot.labelHeight : 2.5) + 1.6}
            />
          )}

          <Effects buildings={village.buildings} />
        </Canvas>
      </HtmlPortalContext.Provider>
    </div>
  );
}
