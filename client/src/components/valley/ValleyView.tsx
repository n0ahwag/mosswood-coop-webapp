import { useGame } from '../../game/GameProvider';
import { featureUnlock, hasFeature } from '../../game/progression';
import { ValleyScenery } from '../Scenery';
import { ProjectCard } from './ProjectCard';
import { TradeShipCard } from './TradeShipCard';

export function ValleyView() {
  const { valley, village, content, events, me, notify } = useGame();

  if (!valley) {
    return <p className="py-20 text-center font-display text-xl text-bark-500">Das Tal wird geladen …</p>;
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(valley.inviteCode);
      notify('Einladungscode kopiert');
    } catch {
      notify(`Einladungscode: ${valley.inviteCode}`);
    }
  };

  const active = valley.projects.filter((p) => p.status === 'ACTIVE');
  const done = valley.projects.filter((p) => p.status === 'COMPLETED');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="card overflow-hidden">
          <div className="relative h-44 overflow-hidden border-b-[3px] border-wood-600 sm:h-52">
            <ValleyScenery className="absolute inset-0 h-full w-full" />
            <div className="wood absolute top-3 left-3 rounded-2xl px-4 py-2">
              <p className="text-xs font-bold text-gold-200">Euer Tal</p>
              <h2 className="text-outline text-2xl leading-tight font-bold text-cream sm:text-3xl">{valley.name}</h2>
              <p className="text-xs font-bold text-cream/90">
                {valley.members.length} von {valley.maxMembers} Höfen · {done.length} Monumente vollendet
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="text-sm font-semibold text-bark-600">Lade Freunde ein:</span>
            <code className="slot px-3 py-1 font-mono text-lg font-bold tracking-widest">
              {valley.inviteCode}
            </code>
            <button className="btn-ghost px-3 py-1 text-sm" onClick={copyCode}>Kopieren</button>
          </div>
        </section>

        {hasFeature(village, 'ship') ? (
          <TradeShipCard ship={valley.ship} />
        ) : (
          <section className="card flex items-center gap-3 p-4 text-sm">
            <span className="text-3xl opacity-70" aria-hidden>⛵</span>
            <p className="font-semibold text-bark-600">
              Am Hafen legt ab und zu ein Handelsschiff an. Beladen kannst du es ab Aufgabe{' '}
              {featureUnlock(content, 'ship').index + 1} im Hofbuch („{featureUnlock(content, 'ship').quest?.title}“).
            </p>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-lg font-semibold">Gemeinschaftsprojekte</h3>
          <div className="space-y-4">
            {active.map((p) => <ProjectCard key={p.id} project={p} />)}
            {active.length === 0 && (
              <p className="card p-5 text-center font-semibold text-bark-600">
                Alle Projekte sind fertig. Bald gibt es neue Pläne.
              </p>
            )}
          </div>
        </section>

        {done.length > 0 && (
          <section>
            <h3 className="mb-2 text-lg font-semibold">Vollendet</h3>
            <div className="space-y-4">
              {done.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-6">
        <section className="card p-4">
          <h3 className="mb-3 text-lg font-semibold">Nachbarn</h3>
          <ul className="space-y-2">
            {valley.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`size-2.5 rounded-full ${m.online ? 'bg-moss-500' : 'bg-bark-900/20'}`}
                  title={m.online ? 'online' : 'offline'}
                />
                <span className="font-bold">
                  {m.displayName}
                  {m.id === me.id && <span className="font-semibold text-bark-500"> (du)</span>}
                </span>
                <span className="ml-auto text-xs font-bold text-bark-500">⭐ {m.prestige}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-4">
          <h3 className="mb-3 text-lg font-semibold">Neues im Tal</h3>
          {events.length === 0 ? (
            <p className="text-sm text-bark-500">Noch ist es ruhig. Zahle etwas ein, und alle sehen es sofort.</p>
          ) : (
            <ul className="space-y-2" aria-live="polite">
              {events.map((e) => (
                <li key={e.id} className="flex gap-2 text-sm">
                  <span aria-hidden>{e.icon}</span>
                  <span className="flex-1">{e.text}</span>
                  <time className="shrink-0 text-xs text-bark-500">
                    {new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
