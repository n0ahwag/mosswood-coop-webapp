import { useGame } from '../../game/GameProvider';
import type { TradeShip } from '../../lib/types';
import { formatDuration, ProgressBar, useNow } from '../ui';
import { DepositControl } from './DepositControl';

export function TradeShipCard({ ship }: { ship: TradeShip | null }) {
  const { content, village, actions } = useGame();
  const now = useNow(1000);
  if (!ship) return null;

  const docked = ship.status === 'DOCKED' && new Date(ship.departsAt).getTime() > now;
  const incoming = ship.status === 'INCOMING';

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 bg-gradient-to-r from-creek-200 to-cream px-5 py-4">
        <span className={`text-4xl ${docked ? 'animate-bob' : ''}`} aria-hidden>⛵</span>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">Das Handelsschiff</h3>
          <p className="text-sm font-semibold text-bark-600">
            {docked && `Liegt im Hafen. Legt ab in ${formatDuration(new Date(ship.departsAt).getTime() - now)}`}
            {incoming && `Kommt in ${formatDuration(new Date(ship.arrivesAt).getTime() - now)}`}
            {ship.status === 'COMPLETED' && 'Voll beladen! Belohnungen wurden verteilt.'}
            {!docked && !incoming && ship.status === 'DOCKED' && 'Legt gerade ab …'}
          </p>
        </div>
        <span className="chip bg-honey-200 text-bark-700">🏵️ {ship.reward.seals} · ⭐ {ship.reward.prestige}</span>
      </div>

      <ul className="grid gap-3 p-5 sm:grid-cols-3">
        {ship.demands.map((d) => {
          const res = content.resources[d.resource];
          const loaded = ship.progress[d.resource] ?? 0;
          const missing = Math.max(0, d.amount - loaded);
          return (
            <li key={d.resource} className="rounded-2xl border-2 border-bark-900/10 bg-white p-3">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>📦 {res?.icon} {res?.name}</span>
                <span className="tabular-nums text-bark-600">{loaded}/{d.amount}</span>
              </div>
              <div className="my-2">
                <ProgressBar value={loaded} max={d.amount} tone="creek" smooth />
              </div>
              {docked && missing > 0 ? (
                <DepositControl
                  label="Laden"
                  available={village?.inventory[d.resource] ?? 0}
                  missing={missing}
                  onDeposit={(amount) => actions.loadShip(d.resource, amount)}
                />
              ) : (
                <p className="text-xs font-bold text-bark-500">{missing === 0 ? '✓ Kiste voll' : 'Wartet auf das Schiff'}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-5 pb-4 text-xs text-bark-500">
        Alle, die mindestens eine Ware laden, erhalten Siegel, sobald alle Kisten voll sind.
      </p>
    </section>
  );
}
