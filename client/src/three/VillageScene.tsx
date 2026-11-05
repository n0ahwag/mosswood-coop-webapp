// Die 3D-Dorfansicht. Wird per React.lazy nachgeladen, damit Three.js
// nicht im ersten Bundle landet.

import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { HtmlPortalContext, useHudOffset } from './htmlPortal';
import * as THREE from 'three';
import type { GameContent, VillageState } from '../lib/types';
import { BuildingPlot, DiningTable, Homes } from './Buildings';
import { ConstructionSite } from './ConstructionSite';
import { Beacon, Landmark } from './Landmarks';
import type { LandmarkKey } from './layout';
import { Effects } from './Effects';
import {
  HOME_SLOTS, homeSpot, plazaSpot, PLOTS, TABLE_POS, tableSpot, workSpot,
} from './layout';
import {
  Clouds, FloatingIslets, Flowers, Island, Paths, Plaza, River, Rocks, Trees,
} from './Nature';
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
  researchUnlocked?: boolean;
  valleyUnlocked?: boolean;
  researchHint?: string;
  valleyHint?: string;
  onOpenResearch?: () => void;
  onOpenValley?: () => void;
}

const noop = () => {};

function AdaptiveCamera() {
  const { camera, size } = useThree();
  // Bei schmalen bzw. hochkanten Flächen weiter wegzoomen, damit die ganze Insel ins Bild passt.
  const aspectStep = size.height > 0 ? Math.round((size.width / size.height) * 10) : 0;
  useEffect(() => {
    if (!aspectStep) return;
    const aspect = aspectStep / 10;
    // Vollbild: etwas weiter weg, damit die ganze Insel samt Bahnhof und Turm ins Bild passt.
    const dist = aspect < 1.25 ? Math.min(2.8, Math.max(1.45, 1.85 / aspect)) : 1.45;
    camera.position.set(14 * dist, 15 * dist, 17.5 * dist);
    camera.lookAt(0, 0, 1);
  }, [aspectStep, camera]);
  useHudOffset();
  return null;
}

export default function VillageScene({
  active = true, village, content, selectedVillagerId, selectedBuildingId,
  onSelectVillager, onBuildingClick, onCollect, onBackgroundClick,
  guide, researchUnlocked = false, valleyUnlocked = false, researchHint = '', valleyHint = '',
  onOpenResearch = noop, onOpenValley = noop,
}: VillageSceneProps) {
  const guidePlot = guide ? PLOTS[guide.kind === 'building' ? guide.type : guide.key] : undefined;
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
            plan = { target: plazaSpot(idx), look: [0, 0], mode: 'idle' };
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
          plan = { target: homeSpot(idx), look: [0, 0], mode: 'tired' };
          break;
        case 'RESTING':
          plan = { target: homeSpot(idx), look: [0, 0], mode: 'rest' };
          break;
        default:
          plan = { target: plazaSpot(idx), look: [0, 0], mode: 'idle' };
      }
      out.set(v.id, plan);
    });
    return out;
  }, [village.buildings, village.villagers, content.buildings]);

  const portalRef = useRef<HTMLDivElement>(null);
  const homeCount = Math.min(HOME_SLOTS.length, Math.max(2, village.villagers.length));
  const selectedVillager = village.villagers.find((v) => v.id === selectedVillagerId) ?? null;

  return (
    <div ref={portalRef} className="relative h-full w-full">
    <HtmlPortalContext.Provider value={portalRef as RefObject<HTMLElement>}>
    <Canvas
      frameloop={active ? 'always' : 'never'}
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [14, 15, 17.5], fov: 34, near: 0.5, far: 220 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
        if (import.meta.env.DEV) (window as unknown as { __mwGl?: THREE.WebGLRenderer }).__mwGl = gl;
      }}
      onPointerMissed={onBackgroundClick}
    >
      <AdaptiveCamera />
      <hemisphereLight args={['#fff4dc', '#7fa85a', 1.15]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[14, 24, 10]}
        intensity={2.4}
        color="#ffe2b2"
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-19}
        shadow-camera-right={19}
        shadow-camera-top={19}
        shadow-camera-bottom={-19}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <fog attach="fog" args={['#e4f2ef', 55, 110]} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={80}
        minPolarAngle={0.42}
        maxPolarAngle={1.2}
        target={[0, 0, 1]}
      />

      <Island />
      <River />
      <Paths homeCount={homeCount} />
      <Plaza />
      <Trees />
      <Rocks />
      <Flowers />
      <Clouds />
      <FloatingIslets />
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
        if (!def) return null;
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
          />
        );
      })}

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

      {village.progression.locked.map((l) => {
        const def = content.buildings[l.type];
        if (!def) return null;
        // Nur die nächsten paar Bauplätze zeigen, damit die Insel nicht nach Baustelle aussieht.
        if (l.questIndex > village.progression.step + 3) return null;
        return (
          <ConstructionSite
            key={l.type}
            type={l.type}
            def={def}
            questIndex={l.questIndex}
            isNext={l.questIndex === village.progression.step}
          />
        );
      })}

      <Landmark
        kind="researchLab"
        locked={!researchUnlocked}
        lockedHint={researchHint}
        highlight={guide?.kind === 'landmark' && guide.key === 'researchLab'}
        onActivate={onOpenResearch}
      />
      <Landmark
        kind="trainStation"
        locked={!valleyUnlocked}
        lockedHint={valleyHint}
        highlight={guide?.kind === 'landmark' && guide.key === 'trainStation'}
        onActivate={onOpenValley}
      />
      {guidePlot && <Beacon position={guidePlot.pos} height={guidePlot.labelHeight + 1.4} />}

      <Effects buildings={village.buildings} />
    </Canvas>
    </HtmlPortalContext.Provider>
    </div>
  );
}
