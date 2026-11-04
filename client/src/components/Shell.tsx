import { useState } from 'react';
import { useGame } from '../game/GameProvider';
import { ResearchPanel } from './research/ResearchPanel';
import { ValleyView } from './valley/ValleyView';
import { HomeVillage } from './village/HomeVillage';

const TABS = [
  { id: 'village', label: 'Mein Dorf', icon: '🏡' },
  { id: 'valley', label: 'Das Tal', icon: '🏞️' },
  { id: 'research', label: 'Forschung', icon: '📜' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function Shell() {
  const { me, connected, toasts, logout, valley } = useGame();
  const [tab, setTab] = useState<TabId>('village');

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-24 sm:pb-8">
      <header className="flex flex-wrap items-center gap-3 py-4">
        <div className="flex items-center gap-2">
          <span className="text-3xl" aria-hidden>🍃</span>
          <div>
            <h1 className="text-2xl leading-none font-bold text-moss-700">Mosswood</h1>
            <p className="text-xs font-semibold text-bark-500">{valley ? valley.name : 'Tal wird geladen …'}</p>
          </div>
        </div>

        <nav className="ml-6 hidden gap-1 rounded-2xl bg-parchment p-1 sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-4 py-1.5 font-display font-semibold transition ${
                tab === t.id ? 'bg-cream text-moss-700 shadow-soft' : 'text-bark-600 hover:text-bark-900'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm font-bold">
          <span className="chip bg-honey-200 text-bark-700" title="Siegel">🏵️ {me.seals}</span>
          <span className="chip bg-moss-100 text-moss-700" title="Prestige">⭐ {me.prestige}</span>
          <span
            className={`chip ${connected ? 'bg-moss-100 text-moss-700' : 'bg-clay-200 text-clay-500'}`}
            title={connected ? 'Verbunden' : 'Verbindung wird aufgebaut'}
          >
            <span className={`size-2 rounded-full ${connected ? 'bg-moss-500' : 'bg-clay-500'}`} />
            <span className="hidden sm:inline">{me.displayName}</span>
          </span>
          <button className="text-xs text-bark-500 underline-offset-2 hover:underline" onClick={logout}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="flex-1">
        {tab === 'village' && <HomeVillage />}
        {tab === 'valley' && <ValleyView />}
        {tab === 'research' && <ResearchPanel />}
      </main>

      {/* Mobile Tab-Leiste */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-bark-900/10 bg-cream/95 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center rounded-xl py-1 text-xs font-bold ${
              tab === t.id ? 'text-moss-700' : 'text-bark-500'
            }`}
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-2xl px-4 py-2 text-sm font-bold shadow-lift ${
              t.tone === 'error' ? 'bg-clay-500 text-white' : 'bg-moss-600 text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
