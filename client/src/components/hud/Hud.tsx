// Bausteine der Spieloberfläche, die über der 3D-Welt schweben.

import { useEffect, type ReactNode } from 'react';
import { useGame } from '../../game/GameProvider';
import type { GuideStep, Scene } from '../../game/guide';
import { sound, useMuted } from '../../lib/sound';
import type { Building, Villager } from '../../lib/types';
import { ResourceIcon } from '../icons/ResourceIcon';
import { ProgressBar } from '../ui';
import { avatarFor, STATE_LABEL } from '../village/VillagerCard';

// ---------- Kopfleiste ----------

export function TopBar({ scene, onList }: { scene: Scene; onList: () => void }) {
  const { me, connected, logout, valley } = useGame();
  const muted = useMuted();
  return (
    <header className="pointer-events-none absolute inset-x-2 top-2 z-30 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
      <div className="wood pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-1.5">
        <span className="text-2xl drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" aria-hidden>🍃</span>
        <div className="leading-none">
          <h1 className="text-outline text-lg font-bold tracking-wide text-cream sm:text-xl">Mosswood</h1>
          <p className="text-[11px] font-bold text-gold-200">
            {scene === 'village' ? 'Dein Hof' : valley?.name ?? 'Das Tal'}
          </p>
        </div>
      </div>
      <div className="wood pointer-events-auto flex items-center gap-1.5 rounded-2xl px-2 py-1.5 text-sm font-bold">
        <span className="chip bg-gold-200 text-bark-900" title="Siegel">🏵️ {me.seals}</span>
        <span className="chip bg-moss-100 text-moss-800" title="Prestige">⭐ {me.prestige}</span>
        <span
          className={`size-2.5 rounded-full ${connected ? 'bg-moss-300' : 'bg-clay-400'}`}
          title={connected ? `Verbunden als ${me.displayName}` : 'Verbindung wird aufgebaut'}
        />
        <button className="btn-ghost size-8 rounded-xl p-0" onClick={onList} title="Übersicht als Liste" aria-label="Übersicht als Liste">📋</button>
        <button
          className="btn-ghost size-8 rounded-xl p-0"
          onClick={() => {
            sound.setMuted(!muted);
            if (muted) sound.play('pop');
          }}
          aria-pressed={muted}
          aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}
          title={muted ? 'Ton einschalten' : 'Ton ausschalten'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="hidden px-1 text-xs text-gold-200 underline-offset-2 hover:underline sm:block" onClick={logout}>
          Abmelden
        </button>
      </div>
    </header>
  );
}

// ---------- Vorräte rechts ----------

export function ResourcePanel() {
  const { village, content } = useGame();
  if (!village) return null;
  const known = new Set(Object.keys(village.inventory).filter((r) => (village.inventory[r] ?? 0) > 0));
  for (const b of village.buildings) for (const r of Object.keys(content.buildings[b.type]?.outputs ?? {})) known.add(r);
  const entries = Object.entries(content.resources).filter(([k]) => known.has(k));

  return (
    <aside
      className="card pointer-events-auto absolute top-16 right-2 z-20 max-h-[calc(100dvh-11rem)] w-[4.6rem] overflow-y-auto p-1.5 sm:top-20 sm:right-3 sm:w-44 sm:p-2"
      aria-label="Vorräte"
    >
      <h2 className="mb-1 hidden px-1 text-sm font-semibold sm:block">
        Vorrat <span className="text-xs font-bold text-bark-500">max. {village.storageCap}</span>
      </h2>
      <ul className="space-y-1">
        {entries.map(([key, res]) => {
          const amount = village.inventory[key] ?? 0;
          const full = amount >= village.storageCap;
          return (
            <li
              key={key}
              title={`${res.name}: ${amount} / ${village.storageCap}`}
              className={`slot flex items-center gap-1.5 px-1.5 py-1 ${full ? 'border-clay-400! bg-clay-200!' : ''}`}
            >
              <ResourceIcon resource={key} size={26} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-display text-sm font-semibold tabular-nums">{amount}</span>
                <span className="hidden truncate text-[10px] font-bold text-bark-500 sm:block">{res.name}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ---------- Hofbuch mit nächstem Schritt ----------

export function QuestTracker({ step, scene, onShow }: { step: GuideStep | null; scene: Scene; onShow?: () => void }) {
  const { village, content } = useGame();
  if (!village) return null;
  const { quest, step: index, total } = village.progression;
  const reward = quest?.reward;
  const rewardNames = [
    ...(reward?.features ?? []).map((f) => `${content.features[f]?.icon} ${content.features[f]?.name}`),
    ...Object.entries(reward?.resources ?? {}).map(([r, n]) => `${n} ${content.resources[r]?.icon ?? ''} ${content.resources[r]?.name ?? r}`),
  ];

  return (
    <section
      className="card pointer-events-auto absolute top-16 left-2 z-20 w-[calc(100%-6.4rem)] overflow-hidden sm:top-20 sm:left-3 sm:w-[23rem]"
      aria-label="Hofbuch"
    >
      <div className="wood flex items-center justify-between gap-2 rounded-none border-x-0 border-t-0 px-3 py-1">
        <span className="text-outline font-display text-xs font-semibold tracking-wide">📖 Hofbuch</span>
        <span className="text-outline font-display text-[11px] font-semibold">
          {quest ? `Aufgabe ${index + 1} von ${total}` : 'Geschafft!'}
        </span>
      </div>
      <div className="p-3">
        {quest ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>{quest.icon}</span>
              <h3 className="flex-1 text-lg leading-tight font-semibold">{quest.title}</h3>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              {quest.goal.resource && <ResourceIcon resource={quest.goal.resource} size={20} />}
              {quest.goal.type === 'build' && (
                <span className="text-base" aria-hidden>
                  {(quest.goal.buildings ?? []).map((t) => (
                    <span key={t} className={village.buildings.some((b) => b.type === t) ? '' : 'opacity-40 grayscale'}>
                      {content.buildings[t]?.icon}
                    </span>
                  ))}
                </span>
              )}
              <div className="flex-1">
                <ProgressBar value={quest.progress} max={quest.goal.amount} tone="honey" smooth label="Fortschritt" />
              </div>
              <span className="text-xs font-bold tabular-nums text-bark-600">{quest.progress}/{quest.goal.amount}</span>
            </div>
          </>
        ) : (
          <h3 className="text-lg font-semibold">🏆 Hofbuch abgeschlossen</h3>
        )}

        {step && (
          <div className="mt-2.5 flex gap-2 rounded-xl border-2 border-gold-400 bg-gold-200/70 px-2.5 py-2">
            <span className="animate-bob text-lg" aria-hidden>👉</span>
            <p className="flex-1 text-sm leading-snug font-bold text-bark-900">{step.text}</p>
            {onShow && (
              <button
                className="btn-wood shrink-0 self-start px-2 py-1 text-xs"
                onClick={onShow}
                title="Ansicht zum Ziel schieben"
              >
                📍 Zeigen
              </button>
            )}
          </div>
        )}

        {quest && (
          <details className="mt-2 text-xs text-bark-600">
            <summary className="cursor-pointer font-bold text-bark-500 select-none">Mehr dazu</summary>
            <p className="mt-1">{quest.text}</p>
            {rewardNames.length > 0 && <p className="mt-1 font-bold">Belohnung: {rewardNames.join(', ')}</p>}
          </details>
        )}
        {scene === 'valley' && (
          <p className="mt-2 text-xs text-bark-600">
            Im Tal arbeitet ihr gemeinsam: Tippe auf ein Monument, um Waren aus deinem Vorrat einzuzahlen.
            Alle sehen den Fortschritt sofort.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- Bewohner unten ----------

export function VillagerDock({
  selectedId, onSelect, buildingName,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  buildingName: (b: Building | undefined) => string;
}) {
  const { village, content } = useGame();
  if (!village) return null;
  const byId = new Map(village.buildings.map((b) => [b.id, b]));
  return (
    <nav
      className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex justify-center gap-1.5 overflow-x-auto pb-[env(safe-area-inset-bottom)] sm:right-44 sm:bottom-3 sm:left-44 sm:gap-2 [&>*]:pointer-events-auto"
      aria-label="Dorfbewohner"
    >
      {village.villagers.map((v: Villager) => {
        const state = STATE_LABEL[v.state];
        const selected = selectedId === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            aria-pressed={selected}
            className={`card flex shrink-0 items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition sm:px-3 ${
              selected ? 'ring-4 ring-gold-300 -translate-y-1' : 'hover:-translate-y-0.5'
            }`}
          >
            <span className={`text-2xl ${v.state === 'WORKING' ? 'animate-bob' : ''}`} aria-hidden>{avatarFor(v)}</span>
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-sm font-semibold">{v.name}</span>
              <span className="block max-w-28 truncate text-[10px] font-bold text-bark-500">
                {state.icon} {v.buildingId ? buildingName(byId.get(v.buildingId)) : state.text}
              </span>
              <span className="mt-0.5 flex gap-0.5" aria-hidden>
                <span className="h-1.5 w-8 overflow-hidden rounded-full bg-bark-900/15">
                  <span className="block h-full bg-creek-400" style={{ width: `${v.energy}%` }} />
                </span>
                <span className="h-1.5 w-8 overflow-hidden rounded-full bg-bark-900/15">
                  <span className="block h-full bg-honey-400" style={{ width: `${v.satiety}%` }} />
                </span>
              </span>
            </span>
          </button>
        );
      })}
      {village.villagers.length < content.villagerRules.maxVillagers && (
        <span className="slot hidden shrink-0 items-center px-3 text-[11px] font-bold text-bark-500 sm:flex">
          🏠 Mehr Bewohner über die Forschung
        </span>
      )}
    </nav>
  );
}

// ---------- Seitenblatt (z. B. Gebäude) und großes Popup ----------

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-24 z-30 sm:inset-x-auto sm:bottom-24 sm:left-3 sm:w-[23rem]">
      <div className="relative">
        <button
          className="btn-wood absolute -top-3 -right-2 z-10 size-8 rounded-full p-0 text-sm"
          onClick={onClose}
          aria-label={`${title} schließen`}
        >
          ✕
        </button>
        <div className="animate-pop-in max-h-[52dvh] overflow-y-auto rounded-[1.4rem]">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-bark-900/35 p-2 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card animate-pop-in flex max-h-full w-full max-w-5xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wood flex items-center gap-2 rounded-none border-x-0 border-t-0 px-4 py-2">
          <span className="text-2xl" aria-hidden>{icon}</span>
          <h2 className="text-outline flex-1 text-xl font-semibold text-cream">{title}</h2>
          <button className="btn-ghost size-9 rounded-xl p-0" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <div className="overflow-y-auto p-3 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------- Hinweise und Reise-Überblendung ----------

export function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-pop-in rounded-2xl border-[3px] px-4 py-2 font-display text-sm font-semibold shadow-lift ${
            t.tone === 'error' ? 'border-clay-500 bg-clay-200 text-bark-900' : 'border-moss-600 bg-moss-100 text-moss-900'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function TravelOverlay({ to }: { to: Scene }) {
  return (
    <div className="animate-travel pointer-events-none absolute inset-0 z-50 grid place-items-center bg-cream">
      <p className="font-display text-3xl font-semibold text-bark-700">
        <span className="mr-2 inline-block animate-bob">🚂</span>
        {to === 'valley' ? 'Tschu-tschu, auf ins Tal …' : 'Zurück zum Hof …'}
      </p>
    </div>
  );
}
