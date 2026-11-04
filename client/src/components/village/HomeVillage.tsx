import { useState, type DragEvent } from 'react';
import { useGame } from '../../game/GameProvider';
import type { BuildingDef } from '../../lib/types';
import { BuildingCard } from './BuildingCard';
import { InventoryBar } from './InventoryBar';
import { VILLAGER_MIME, VillagerCard } from './VillagerCard';

const SECTIONS: { category: BuildingDef['category']; title: string; hint: string }[] = [
  { category: 'gathering', title: 'Sammeln', hint: 'Rohstoffe aus Wald, Feld und Bach' },
  { category: 'refining', title: 'Veredeln', hint: 'Aus Rohstoffen werden Baumaterialien' },
  { category: 'food', title: 'Versorgung', hint: 'Ohne Mahlzeiten wird niemand satt' },
];

export function HomeVillage() {
  const { village, content, actions } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [plazaHover, setPlazaHover] = useState(false);

  if (!village) {
    return <p className="py-20 text-center font-display text-xl text-bark-500">Dein Hof wird geladen …</p>;
  }

  const villagerById = new Map(village.villagers.map((v) => [v.id, v]));
  const idle = village.villagers.filter((v) => !v.buildingId);

  const assign = (villagerId: string, buildingId: string | null) => {
    setSelected(null);
    void actions.assignVillager(villagerId, buildingId);
  };

  const onPlazaDrop = (e: DragEvent) => {
    e.preventDefault();
    setPlazaHover(false);
    const id = e.dataTransfer.getData(VILLAGER_MIME);
    if (id) assign(id, null);
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold text-bark-900">{village.name}</h2>
          <span className="text-sm font-semibold text-bark-500">Lager: max. {village.storageCap} je Rohstoff</span>
        </div>
        <InventoryBar inventory={village.inventory} cap={village.storageCap} />
      </section>

      <section
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(VILLAGER_MIME)) {
            e.preventDefault();
            setPlazaHover(true);
          }
        }}
        onDragLeave={() => setPlazaHover(false)}
        onDrop={onPlazaDrop}
        className={`card p-4 transition ${plazaHover ? 'ring-4 ring-honey-300' : ''}`}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">
            Dorfbewohner <span className="text-bark-500">{village.villagers.length}/{content.villagerRules.maxVillagers}</span>
          </h3>
          <p className="text-xs font-semibold text-bark-500">
            Zieh jemanden auf eine Arbeitsstätte oder tippe erst die Person, dann das Gebäude an.
            Hierher ziehen schickt sie zum Dorfplatz.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <div className="grid place-items-center rounded-2xl border-2 border-dashed border-bark-900/15 p-4 text-center text-xs font-semibold text-bark-500">
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
              {buildings.map((b) => (
                <BuildingCard
                  key={b.id}
                  building={b}
                  workers={b.workerIds.map((id) => villagerById.get(id)!).filter(Boolean)}
                  selectedVillager={selected ? villagerById.get(selected) ?? null : null}
                  onAssign={(villagerId) => assign(villagerId, b.id)}
                  onUnassign={(villagerId) => assign(villagerId, null)}
                  onCollect={() => void actions.collect(b.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
