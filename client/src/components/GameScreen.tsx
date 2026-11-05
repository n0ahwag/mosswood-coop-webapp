// Vollbild-Spielansicht: Dorf und Tal als 3D-Welten, darüber das HUD.
// Die Bahn verbindet beide Welten, der Forschungsturm öffnet das Forschungsbuch.

import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../game/GameProvider';
import { nextStep, type Scene } from '../game/guide';
import { featureUnlock, hasFeature } from '../game/progression';
import { fx } from '../lib/fx';
import { sound } from '../lib/sound';
import type { ValleySelection } from '../three/ValleyScene';
import { FxOverlay } from './FxOverlay';
import {
  Modal, QuestTracker, ResourcePanel, Sheet, Toasts, TopBar, TravelOverlay, VillagerDock,
} from './hud/Hud';
import { ResearchPanel } from './research/ResearchPanel';
import { ProjectCard } from './valley/ProjectCard';
import { TradeShipCard } from './valley/TradeShipCard';
import { ValleyView } from './valley/ValleyView';
import { BuildingCard } from './village/BuildingCard';
import { BuildPlanCard } from './village/BuildPlanCard';
import { BuildSection, HomeVillage } from './village/HomeVillage';

const VillageScene = lazy(() => import('../three/VillageScene'));
const ValleyScene = lazy(() => import('../three/ValleyScene'));

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('3D-Ansicht konnte nicht geladen werden', err);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const Loading = ({ text }: { text: string }) => (
  <div className="grid h-full place-items-center font-display text-2xl text-bark-600">
    <span className="animate-bob">{text}</span>
  </div>
);

export function GameScreen({ onSceneFailed }: { onSceneFailed: () => void }) {
  const { village, valley, content, me, actions, notify } = useGame();
  const [scene, setScene] = useState<Scene>('village');
  const [valleyMounted, setValleyMounted] = useState(false);
  const [modal, setModal] = useState<'research' | 'list' | 'build' | null>(null);
  const [travel, setTravel] = useState<Scene | null>(null);
  const [selectedVillager, setSelectedVillager] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [valleySel, setValleySel] = useState<ValleySelection>(null);

  const researchOpen = hasFeature(village, 'research');
  const valleyOpen = hasFeature(village, 'valley');

  const villagerName = village?.villagers.find((v) => v.id === selectedVillager)?.name ?? null;
  const step = useMemo(
    () => nextStep(village, valley, content, scene, villagerName),
    [village, valley, content, scene, villagerName],
  );

  const goTo = useCallback((to: Scene) => {
    sound.play('whoosh');
    setTravel(to);
    setTimeout(() => {
      setScene(to);
      if (to === 'valley') setValleyMounted(true);
      setSelectedBuilding(null);
      setSelectedVillager(null);
      setSelectedPlan(null);
      setValleySel(null);
    }, 600);
    setTimeout(() => setTravel(null), 1500);
  }, []);

  if (!village) return <Loading text="🏝️ Dein Hof wird geladen …" />;

  // ---------- Dorf ----------
  const assign = (villagerId: string, buildingId: string | null) => {
    setSelectedVillager(null);
    if (buildingId) setSelectedBuilding(buildingId);
    void actions.assignVillager(villagerId, buildingId);
  };
  const collect = async (buildingId: string) => {
    const res = await actions.collect(buildingId);
    if (res?.moved && Object.keys(res.moved).length) fx.emit({ type: 'collect', buildingId, moved: res.moved });
    return res;
  };
  const onBuildingClick = (id: string) => {
    const b = village.buildings.find((x) => x.id === id);
    const def = b && content.buildings[b.type];
    const v = village.villagers.find((x) => x.id === selectedVillager);
    setSelectedPlan(null);
    if (v && b && def && v.buildingId !== id && b.workerIds.length < def.slots) assign(v.id, id);
    else setSelectedBuilding((cur) => (cur === id ? null : id));
  };
  const onPlanClick = (type: string) => {
    sound.play('tap');
    setSelectedBuilding(null);
    setSelectedVillager(null);
    setSelectedPlan((cur) => (cur === type ? null : type));
  };
  const focused = village.buildings.find((b) => b.id === selectedBuilding);
  const focusedPlan = village.progression.plans.find((p) => p.type === selectedPlan);
  const villagerById = new Map(village.villagers.map((v) => [v.id, v]));
  const affordableCount = village.progression.plans.filter((p) => p.affordable).length;

  // Gesperrte Wahrzeichen: statt einer Fehlermeldung gleich den Bauplatz zeigen.
  const openResearch = () => {
    if (!researchOpen) {
      notify(featureUnlock(content, 'research').text, 'error');
      onPlanClick('researchLab');
      return;
    }
    sound.play('chime');
    setModal('research');
  };
  const openValley = () => {
    if (!valleyOpen) {
      notify(`Die Bahn fährt erst, wenn der Bahnhof steht. ${featureUnlock(content, 'valley').text}`, 'error');
      onPlanClick('trainStation');
      return;
    }
    goTo('valley');
  };

  const villageGuide = step?.target?.scene === 'village'
    ? step.target.kind === 'building' ? { kind: 'building' as const, type: step.target.type } : { kind: 'landmark' as const, key: step.target.key }
    : null;
  const valleyGuide = step?.target?.scene === 'valley'
    ? step.target.kind === 'project' ? { kind: 'project' as const, key: step.target.key } : { kind: step.target.kind }
    : null;

  // ---------- Tal ----------
  const selectedProject = valleySel?.kind === 'project' ? valley?.projects.find((p) => p.key === valleySel.key) : undefined;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[linear-gradient(180deg,#9fd6ee_0%,#cfeaf1_45%,#f6efd6_100%)]">
      {/* isolate: die z-Indizes der 3D-Schilder bleiben in dieser Ebene und liegen nie über dem HUD */}
      <div className={`absolute inset-0 isolate ${scene === 'village' ? '' : 'invisible'}`}>
        <SceneBoundary onFail={onSceneFailed}>
          <Suspense fallback={<Loading text="🏝️ Das Dorf wird aufgebaut …" />}>
            <VillageScene
              active={scene === 'village'}
              village={village}
              content={content}
              selectedVillagerId={selectedVillager}
              selectedBuildingId={selectedBuilding}
              onSelectVillager={(id) => setSelectedVillager((s) => (s === id ? null : id))}
              onBuildingClick={onBuildingClick}
              onCollect={(id) => void collect(id)}
              onBackgroundClick={() => {
                setSelectedVillager(null);
                setSelectedBuilding(null);
                setSelectedPlan(null);
              }}
              guide={villageGuide}
              selectedPlan={selectedPlan}
              onPlanClick={onPlanClick}
              onOpenResearch={openResearch}
              onOpenValley={openValley}
            />
          </Suspense>
        </SceneBoundary>
      </div>

      {valleyMounted && valley && (
        <div className={`absolute inset-0 isolate ${scene === 'valley' ? '' : 'invisible'}`}>
          <SceneBoundary onFail={onSceneFailed}>
            <Suspense fallback={<Loading text="🏞️ Das Tal wird aufgebaut …" />}>
              <ValleyScene
                active={scene === 'valley'}
                projects={valley.projects}
                ship={hasFeature(village, 'ship') ? valley.ship : null}
                shipLockedHint={hasFeature(village, 'ship') ? undefined : featureUnlock(content, 'ship').short}
                members={valley.members}
                meId={me.id}
                selection={valleySel}
                guide={valleyGuide}
                onSelect={setValleySel}
                onStation={() => goTo('village')}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      )}

      <TopBar scene={scene} onList={() => setModal('list')} />
      <QuestTracker step={step} scene={scene} />
      <ResourcePanel />

      {scene === 'village' && (
        <>
          {selectedVillager && (
            <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
              <div className="animate-pop-in rounded-2xl border-2 border-gold-500 bg-gold-200/95 px-3 py-1.5 font-display text-sm font-semibold shadow-soft">
                {villagerName} ausgewählt: Tippe auf eine Arbeitsstätte
              </div>
            </div>
          )}
          {focused && (
            <Sheet title={content.buildings[focused.type]?.name ?? 'Gebäude'} onClose={() => setSelectedBuilding(null)}>
              <BuildingCard
                building={focused}
                workers={focused.workerIds.map((id) => villagerById.get(id)!).filter(Boolean)}
                selectedVillager={selectedVillager ? villagerById.get(selectedVillager) ?? null : null}
                onAssign={(vid) => assign(vid, focused.id)}
                onUnassign={(vid) => assign(vid, null)}
                onCollect={() => collect(focused.id)}
              />
            </Sheet>
          )}
          {focusedPlan && !focused && (
            <Sheet title={`Ruine ${content.buildings[focusedPlan.type]?.name ?? ''}`} onClose={() => setSelectedPlan(null)}>
              <BuildPlanCard
                plan={focusedPlan}
                highlight
                onBuilt={(id) => {
                  setSelectedPlan(null);
                  // Wahrzeichen haben kein Arbeiter-Panel.
                  if (content.buildings[focusedPlan.type]?.category !== 'landmark') setSelectedBuilding(id);
                }}
              />
            </Sheet>
          )}
          <VillagerDock
            selectedId={selectedVillager}
            onSelect={(id) => setSelectedVillager((s) => (s === id ? null : id))}
            buildingName={(b) => (b ? content.buildings[b.type]?.name ?? '' : '')}
          />
          <div className="pointer-events-auto absolute right-2 bottom-24 z-20 flex flex-col gap-2 sm:right-3 sm:bottom-3">
            {village.progression.plans.length > 0 && (
              <button
                className={`relative px-3 py-1.5 text-sm ${affordableCount ? 'btn-honey' : 'btn-wood'}`}
                onClick={() => {
                  sound.play('tap');
                  setModal('build');
                }}
              >
                🔨 Bauen
                {affordableCount > 0 && (
                  <span className="absolute -top-2 -right-2 grid size-5 animate-bob place-items-center rounded-full bg-moss-500 text-[11px] font-bold text-white shadow">
                    {affordableCount}
                  </span>
                )}
              </button>
            )}
            <button className={researchOpen ? 'btn-wood px-3 py-1.5 text-sm' : 'btn-ghost px-3 py-1.5 text-sm opacity-80'} onClick={openResearch}>
              🔭 Forschung{!researchOpen && ' 🔒'}
            </button>
            <button className={valleyOpen ? 'btn-wood px-3 py-1.5 text-sm' : 'btn-ghost px-3 py-1.5 text-sm opacity-80'} onClick={openValley}>
              🚂 Ins Tal{!valleyOpen && ' 🔒'}
            </button>
          </div>
        </>
      )}

      {scene === 'valley' && valley && (
        <>
          {selectedProject && (
            <Sheet title={selectedProject.name} onClose={() => setValleySel(null)}>
              <ProjectCard project={selectedProject} />
            </Sheet>
          )}
          {valleySel?.kind === 'ship' && (
            <Sheet title="Handelsschiff" onClose={() => setValleySel(null)}>
              {hasFeature(village, 'ship') ? (
                <TradeShipCard ship={valley.ship} />
              ) : (
                <div className="card p-4 text-sm font-semibold text-bark-600">
                  ⛵ Das Handelsschiff beladen: {featureUnlock(content, 'ship').text}
                </div>
              )}
            </Sheet>
          )}
          <div className="pointer-events-auto absolute right-2 bottom-3 z-20 flex flex-col items-end gap-2 sm:right-3">
            <button className="btn-wood px-3 py-1.5 text-sm" onClick={() => goTo('village')}>🚂 Zurück zum Hof</button>
          </div>
        </>
      )}

      {modal === 'research' && (
        <Modal title="Forschungsbuch" icon="🔭" onClose={() => setModal(null)}>
          <ResearchPanel />
        </Modal>
      )}
      {modal === 'build' && (
        <Modal title="Aufbauen" icon="🔨" onClose={() => setModal(null)}>
          <BuildSection
            onBuilt={(id, type) => {
              setModal(null);
              if (content.buildings[type]?.category !== 'landmark') setSelectedBuilding(id);
            }}
          />
        </Modal>
      )}
      {modal === 'list' && (
        <Modal title={scene === 'village' ? 'Hof als Liste' : 'Tal als Liste'} icon="📋" onClose={() => setModal(null)}>
          {scene === 'village' ? <HomeVillage mode="cards" /> : <ValleyView />}
        </Modal>
      )}

      {travel && <TravelOverlay to={travel} />}
      <Toasts />
      <FxOverlay />
    </div>
  );
}
