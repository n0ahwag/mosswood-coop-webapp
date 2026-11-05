import {
  Component, lazy, Suspense, useMemo, useState, type DragEvent, type ReactNode,
} from 'react';
import { useGame } from '../../game/GameProvider';
import { fx } from '../../lib/fx';
import type { BuildingDef } from '../../lib/types';
import { BuildingCard } from './BuildingCard';
import { InventoryBar } from './InventoryBar';
import { VILLAGER_MIME, VillagerCard } from './VillagerCard';

const VillageScene = lazy(() => import('../../three/VillageScene'));

const SECTIONS: { category: BuildingDef['category']; title: string; hint: string }[] = [
  { category: 'gathering', title: 'Sammeln', hint: 'Rohstoffe aus Wald, Feld und Bach' },
  { category: 'refining', title: 'Veredeln', hint: 'Aus Rohstoffen werden Baumaterialien' },
  { category: 'food', title: 'Versorgung', hint: 'Ohne Mahlzeiten wird niemand satt' },
];

type View = '3d' | 'cards';
const VIEW_KEY = 'mosswood.villageView';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : '3d';
  } catch {
    return '3d';
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('3D-Dorf konnte nicht geladen werden', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function HomeVillage() {
  const { village, content, actions } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [plazaHover, setPlazaHover] = useState(false);
  const webgl = useMemo(hasWebGL, []);
  const [view, setViewState] = useState<View>(() => (webgl ? readView() : 'cards'));

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* nur für diese Sitzung merken */
    }
  };

  if (!village) {
    return <p className="py-20 text-center font-display text-xl text-bark-500">Dein Hof wird geladen …</p>;
  }

  const villagerById = new Map(village.villagers.map((v) => [v.id, v]));
  const idle = village.villagers.filter((v) => !v.buildingId);
  const selectedVillager = selected ? villagerById.get(selected) ?? null : null;
  const focusedBuilding = selectedBuilding ? village.buildings.find((b) => b.id === selectedBuilding) : undefined;

  const assign = (villagerId: string, buildingId: string | null) => {
    setSelected(null);
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
    if (selectedVillager && b && def && selectedVillager.buildingId !== id && b.workerIds.length < def.slots) {
      assign(selectedVillager.id, id);
    } else {
      setSelectedBuilding((cur) => (cur === id ? null : id));
    }
  };

  const onPlazaDrop = (e: DragEvent) => {
    e.preventDefault();
    setPlazaHover(false);
    const id = e.dataTransfer.getData(VILLAGER_MIME);
    if (id) assign(id, null);
  };

  const buildingCard = (id: string) => {
    const b = village.buildings.find((x) => x.id === id);
    if (!b) return null;
    return (
      <BuildingCard
        key={b.id}
        building={b}
        workers={b.workerIds.map((wid) => villagerById.get(wid)!).filter(Boolean)}
        selectedVillager={selectedVillager}
        onAssign={(villagerId) => assign(villagerId, b.id)}
        onUnassign={(villagerId) => assign(villagerId, null)}
        onCollect={() => collect(b.id)}
      />
    );
  };

  const cardsFallback = (
    <div className="grid h-full place-items-center p-6 text-center">
      <div>
        <p className="text-4xl">🏚️</p>
        <p className="mt-2 font-display text-lg font-semibold">Das 3D-Dorf lässt sich hier nicht anzeigen.</p>
        <button className="btn-ghost mt-3" onClick={() => setView('cards')}>Zur Übersicht</button>
      </div>
    </div>
  );

  const villagersPanel = (
    <section
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(VILLAGER_MIME)) {
          e.preventDefault();
          setPlazaHover(true);
        }
      }}
      onDragLeave={() => setPlazaHover(false)}
      onDrop={onPlazaDrop}
      className={`card p-4 transition ${plazaHover ? 'ring-4 ring-gold-300' : ''}`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">
          Dorfbewohner <span className="text-bark-500">{village.villagers.length}/{content.villagerRules.maxVillagers}</span>
        </h3>
        <p className="text-xs font-semibold text-bark-500">
          {view === '3d'
            ? 'Tippe eine Person an und dann ein Gebäude im Dorf.'
            : 'Zieh jemanden auf eine Arbeitsstätte oder tippe erst die Person, dann das Gebäude an. Hierher ziehen schickt sie zum Dorfplatz.'}
        </p>
      </div>
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${view === '3d' ? 'xl:grid-cols-3' : 'lg:grid-cols-5'}`}>
        {village.villagers.map((v) => (
          <VillagerCard
            key={v.id}
            villager={v}
            building={v.buildingId ? village.buildings.find((b) => b.id === v.buildingId) : undefined}
            selected={selected === v.id}
            onSelect={() => setSelected((s) => (s === v.id ? null : v.id))}
            onUnassign={() => assign(v.id, null)}
          />
        ))}
        {village.villagers.length < content.villagerRules.maxVillagers && (
          <div className="slot grid place-items-center p-4 text-center text-xs font-semibold text-bark-500">
            🏠 Mehr Platz für Bewohner gibt es über die Forschung
          </div>
        )}
      </div>
      {idle.length > 0 && (
        <p className="mt-3 text-sm font-semibold text-honey-500">
          {idle.map((v) => v.name).join(', ')} {idle.length === 1 ? 'wartet' : 'warten'} auf dem Dorfplatz auf Arbeit.
        </p>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold text-bark-900">{village.name}</h2>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-bark-500 sm:inline">Lager: max. {village.storageCap} je Rohstoff</span>
            {webgl && (
              <div className="slot flex p-1" role="group" aria-label="Ansicht">
                {(['3d', 'cards'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`rounded-xl px-3 py-1 font-display text-sm font-semibold transition ${
                      view === v ? 'bg-gold-300 text-bark-900 shadow-[0_2px_0_var(--color-gold-500)]' : 'text-bark-600'
                    }`}
                  >
                    {v === '3d' ? '🏝️ 3D-Dorf' : '📋 Übersicht'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <InventoryBar inventory={village.inventory} cap={village.storageCap} />
      </section>

      {view === '3d' ? (
        <>
          <section className="card relative overflow-hidden p-1.5">
            <div className="relative h-[58vh] max-h-[680px] min-h-[340px] overflow-hidden rounded-[1.05rem] bg-[linear-gradient(180deg,#9fd6ee_0%,#cfeaf1_45%,#f6efd6_100%)]">
              <SceneBoundary fallback={cardsFallback}>
                <Suspense
                  fallback={
                    <div className="grid h-full place-items-center font-display text-xl text-bark-600">
                      <span className="animate-bob">🏝️ Das Dorf wird aufgebaut …</span>
                    </div>
                  }
                >
                  <VillageScene
                    village={village}
                    content={content}
                    selectedVillagerId={selected}
                    selectedBuildingId={selectedBuilding}
                    onSelectVillager={(id) => setSelected((s) => (s === id ? null : id))}
                    onBuildingClick={onBuildingClick}
                    onCollect={(id) => void collect(id)}
                    onBackgroundClick={() => {
                      setSelected(null);
                      setSelectedBuilding(null);
                    }}
                  />
                </Suspense>
              </SceneBoundary>
              <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
                {selectedVillager ? (
                  <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border-2 border-gold-500 bg-gold-200/95 px-3 py-1.5 font-display text-sm font-semibold shadow-soft">
                    {selectedVillager.name} ausgewählt: Tippe auf eine Arbeitsstätte
                    <button className="rounded-lg px-1.5 hover:bg-gold-300" onClick={() => setSelected(null)} aria-label="Auswahl aufheben">✕</button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-cream/85 px-3 py-1 text-xs font-bold text-bark-600 shadow-soft">
                    Ziehen zum Drehen · Zoomen mit Mausrad oder zwei Fingern
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            {villagersPanel}
            <div>
              {focusedBuilding ? (
                buildingCard(focusedBuilding.id)
              ) : (
                <div className="card grid h-full min-h-40 place-items-center p-5 text-center text-sm font-semibold text-bark-600">
                  <p>
                    <span className="mb-1 block text-3xl">🔎</span>
                    Tippe im Dorf auf ein Gebäude, um Rezept, Arbeiter und Vorrat zu sehen.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {villagersPanel}
          {SECTIONS.map((section) => {
            const buildings = village.buildings.filter((b) => content.buildings[b.type]?.category === section.category);
            if (buildings.length === 0) return null;
            return (
              <section key={section.category}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-lg font-semibold">{section.title}</h3>
                  <span className="text-sm text-bark-500">{section.hint}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {buildings.map((b) => buildingCard(b.id))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
