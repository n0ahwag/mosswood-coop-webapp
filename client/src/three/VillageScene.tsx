// Die 3D-Dorfansicht: ein Bergdorf über den Wolken. Wird per React.lazy nachgeladen,
// damit Three.js nicht im ersten Bundle landet.

import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { GameContent, VillageState } from '../lib/types';
import { BuildingPlot, DiningTable, Homes } from './Buildings';
import { QUALITY, WorldClock } from './clock';
import { ConstructionSite } from './ConstructionSite';
import { Effects } from './Effects';
import { Birds, Butterflies, VillageFestive } from './Festive';
import { tapOnly } from './dragGuard';
import { HtmlPortalContext } from './htmlPortal';
import { Beacon, Landmark, RailwayOnly } from './Landmarks';
import {
  HOME_SLOTS, homeSpot, LAKE, PEAKS, plazaSpot, PLOTS, TABLE_POS, tableSpot, VILLAGE, workSpot, type LandmarkKey, type Vec3,
} from './layout';

/** Wo Schmetterlinge flattern: Wiesen am Rand der Plateaus. */
const BUTTERFLY_SPOTS: [number, number][] = [
  [VILLAGE.pos[0] + 3.8, VILLAGE.pos[1] + 2.2],
  [PEAKS.berry.pos[0] + 1.5, PEAKS.berry.pos[1] - 1.5],
  [PEAKS.wheat.pos[0] - 1.8, PEAKS.wheat.pos[1] + 1.2],
  [LAKE.pos[0] - 1.6, LAKE.pos[1] + 1.4],
];
import { Crossings, Lake, Plaza, Terrain, Waterfalls } from './Mountain';
import { CloudBanks, CloudSea, DistantMountains, Lights, SKY, SkyDome } from './Sky';
import { Boulders, Meadow, Trees } from './Vegetation';
import { MapCamera } from './MapCamera';
import { setupRenderer } from './stylize';
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
  /** „Zeig mir das“: schiebt die Ansicht zu einem Gebäude (n zählt jede Anfrage). */
  focusRequest?: { type: string; n: number } | null;
}

const noop = () => {};

/** Startansicht: nah am Dorfplatz, der Rest des Berges liegt eine Fingerbewegung entfernt. */
const HOME: Vec3 = [VILLAGE.pos[0] + 0.5, VILLAGE.y - 0.5, VILLAGE.pos[1] + 0.5];

export default function VillageScene({
  active = true, village, content, selectedVillagerId, selectedBuildingId,
  onSelectVillager, onBuildingClick, onCollect, onBackgroundClick,
  guide, selectedPlan = null, onPlanClick = noop, onOpenResearch = noop, onOpenValley = noop, focusRequest = null,
}: VillageSceneProps) {
  // Ziehen verschiebt die Karte; nur echtes Tippen wählt etwas aus.
  const tap = useMemo(() => ({
    villager: tapOnly(onSelectVillager),
    building: tapOnly(onBuildingClick),
    collect: tapOnly(onCollect),
    background: tapOnly(onBackgroundClick),
    plan: tapOnly(onPlanClick),
    research: tapOnly(onOpenResearch),
    valley: tapOnly(onOpenValley),
  }), [onSelectVillager, onBuildingClick, onCollect, onBackgroundClick, onPlanClick, onOpenResearch, onOpenValley]);
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

  // Kamera-Ziel: zuletzt ausgewähltes Gebäude, Ruine oder „Zeigen“-Anfrage
  const [camFocus, setCamFocus] = useState<{ key: string; pos: Vec3 } | null>(null);
  const selectedType = selectedPlan ?? village.buildings.find((b) => b.id === selectedBuildingId)?.type ?? null;
  useEffect(() => {
    const plot = selectedType ? PLOTS[selectedType] : undefined;
    if (plot) setCamFocus({ key: `sel:${selectedType}:${Date.now()}`, pos: [plot.pos[0], plot.y, plot.pos[1]] });
  }, [selectedType]);
  useEffect(() => {
    const plot = focusRequest ? PLOTS[focusRequest.type] : undefined;
    if (plot && focusRequest) setCamFocus({ key: `req:${focusRequest.type}:${focusRequest.n}`, pos: [plot.pos[0], plot.y, plot.pos[1]] });
  }, [focusRequest]);

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
            setupRenderer(gl);
            if (import.meta.env.DEV) Object.assign(window, { __mwGl: gl });
          }}
          onPointerMissed={tap.background}
        >
          <WorldClock />
          <MapCamera
            home={HOME}
            distance={{ wide: 30, tall: 40 }}
            minDistance={17}
            maxDistance={46}
            panRadius={21}
            yRange={[2.5, 11]}
            focus={camFocus?.pos ?? null}
            focusKey={camFocus?.key ?? ''}
          />
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
          <VillageFestive />
          <Birds />
          <Butterflies spots={BUTTERFLY_SPOTS} />
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
                onClick={tap.building}
                onCollect={tap.collect}
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
                onClick={tap.plan}
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
                onActivate={b.type === 'researchLab' ? tap.research : tap.valley}
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
                onSelect={tap.villager}
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
