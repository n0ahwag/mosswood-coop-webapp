import { useState } from 'react';
import { useGame } from '../game/GameProvider';
import { featureUnlock, hasFeature } from '../game/progression';
import { sound, useMuted } from '../lib/sound';
import type { FeatureKey } from '../lib/types';
import { FxOverlay } from './FxOverlay';
import { LockedFeature } from './QuestPanel';
import { ResearchPanel } from './research/ResearchPanel';
import { ValleyView } from './valley/ValleyView';
import { HomeVillage } from './village/HomeVillage';

const TABS = [
  { id: 'village', label: 'Mein Dorf', icon: '🏡' },
  { id: 'valley', label: 'Das Tal', icon: '🏞️' },
  { id: 'research', label: 'Forschung', icon: '📜' },
] as const;
type TabId = (typeof TABS)[number]['id'];

// Welcher Bereich muss im Hofbuch freigeschaltet sein?
const TAB_FEATURE: Record<TabId, FeatureKey | null> = { village: null, valley: 'valley', research: 'research' };
const LOCKED_TEXT: Record<'valley' | 'research', string> = {
  valley: 'Hier baut ihr gemeinsam an großen Monumenten und beladet das Handelsschiff. Kümmere dich erst um deinen eigenen Hof.',
  research: 'Im Forschungsturm verbesserst du später Werkzeuge, Lager und Hütten. Erst muss der Turm gebaut werden.',
};

function MuteButton() {
  const muted = useMuted();
  return (
    <button
      className="btn-ghost size-9 rounded-xl p-0 text-lg"
      onClick={() => {
        sound.setMuted(!muted);
        if (muted) sound.play('pop');
      }}
      aria-pressed={muted}
      title={muted ? 'Ton einschalten' : 'Ton ausschalten'}
      aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

export function Shell() {
  const { me, connected, toasts, logout, valley, village, content } = useGame();
  const [tab, setTab] = useState<TabId>('village');
  const isLocked = (id: TabId) => {
    const f = TAB_FEATURE[id];
    return !!f && !!village && !hasFeature(village, f);
  };
  const lockedView = (id: 'valley' | 'research') => {
    const t = TABS.find((x) => x.id === id)!;
    return (
      <LockedFeature icon={t.icon} title={t.label} unlockText={featureUnlock(content, id).text}>
        {LOCKED_TEXT[id]}
      </LockedFeature>
    );
  };

  const switchTab = (id: TabId) => {
    if (id !== tab) sound.play('tap');
    setTab(id);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-28 sm:pb-8">
      <header className="wood relative mt-3 flex flex-wrap items-center gap-3 rounded-[1.4rem] px-4 py-2.5">
        {/* Nagelköpfe */}
        {['left-2 top-2', 'right-2 top-2', 'left-2 bottom-2', 'right-2 bottom-2'].map((p) => (
          <span key={p} className={`absolute ${p} size-1.5 rounded-full bg-gold-300 shadow-[0_1px_0_rgba(0,0,0,0.4)]`} />
        ))}
        <div className="flex items-center gap-2">
          <span className="text-3xl drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" aria-hidden>🍃</span>
          <div>
            <h1 className="text-outline text-2xl leading-none font-bold tracking-wide text-cream">Mosswood</h1>
            <p className="text-xs font-bold text-gold-200">{valley ? valley.name : 'Tal wird geladen …'}</p>
          </div>
        </div>

        <nav className="ml-4 hidden gap-2 sm:flex" aria-label="Bereiche">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={tab === t.id ? 'btn-honey px-4 py-1.5' : 'btn-ghost px-4 py-1.5'}
              title={isLocked(t.id) ? 'Noch gesperrt' : undefined}
            >
              {t.icon} {t.label}{isLocked(t.id) && ' 🔒'}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm font-bold">
          <span className="chip bg-gold-200 text-bark-900" title="Siegel">🏵️ {me.seals}</span>
          <span className="chip bg-moss-100 text-moss-800" title="Prestige">⭐ {me.prestige}</span>
          <span
            className={`chip ${connected ? 'bg-moss-100 text-moss-800' : 'bg-clay-200 text-clay-500'}`}
            title={connected ? 'Verbunden' : 'Verbindung wird aufgebaut'}
          >
            <span className={`size-2 rounded-full ${connected ? 'bg-moss-500' : 'bg-clay-500'}`} />
            <span className="hidden sm:inline">{me.displayName}</span>
          </span>
          <MuteButton />
          <button className="text-xs font-bold text-gold-200 underline-offset-2 hover:underline" onClick={logout}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="mt-5 flex-1">
        {/* Das Dorf bleibt eingehängt, damit die 3D-Szene beim Tab-Wechsel nicht neu aufgebaut wird. */}
        <div hidden={tab !== 'village'}>
          <HomeVillage visible={tab === 'village'} mode="cards" />
        </div>
        {tab === 'valley' && (isLocked('valley') ? lockedView('valley') : <ValleyView />)}
        {tab === 'research' && (isLocked('research') ? lockedView('research') : <ResearchPanel />)}
      </main>

      {/* Mobile Tab-Leiste */}
      <nav className="wood fixed inset-x-2 bottom-2 z-50 flex rounded-2xl px-1.5 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] sm:hidden" aria-label="Bereiche">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center rounded-xl py-1 font-display text-xs font-semibold ${
              tab === t.id ? 'bg-gold-300 text-bark-900 shadow-[inset_0_1px_0_#fff8]' : 'text-outline text-cream'
            }`}
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}{isLocked(t.id) && ' 🔒'}
          </button>
        ))}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-pop-in rounded-2xl border-[3px] px-4 py-2 font-display text-sm font-semibold shadow-lift ${
              t.tone === 'error'
                ? 'border-clay-500 bg-clay-200 text-bark-900'
                : 'border-moss-600 bg-moss-100 text-moss-900'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      <FxOverlay />
    </div>
  );
}
