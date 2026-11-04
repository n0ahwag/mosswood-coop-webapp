import { useState } from 'react';

// Einzahlungs-Steuerung: Menge wählen und in ein Projekt oder aufs Schiff geben.
export function DepositControl({
  available, missing, onDeposit, label = 'Einzahlen',
}: {
  available: number;
  missing: number;
  onDeposit: (amount: number) => Promise<void>;
  label?: string;
}) {
  const max = Math.min(available, missing);
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const value = Math.max(1, Math.min(amount, Math.max(1, max)));

  const submit = async () => {
    setBusy(true);
    try {
      await onDeposit(value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center rounded-2xl bg-parchment p-0.5">
        {[10, 50].map((n) => (
          <button
            key={n}
            className={`rounded-xl px-2 py-1 text-xs font-bold ${amount === n ? 'bg-cream shadow-soft' : 'text-bark-600'}`}
            onClick={() => setAmount(n)}
          >
            {n}
          </button>
        ))}
        <button
          className={`rounded-xl px-2 py-1 text-xs font-bold ${amount >= max && max > 0 ? 'bg-cream shadow-soft' : 'text-bark-600'}`}
          onClick={() => setAmount(Math.max(1, max))}
        >
          Max
        </button>
      </div>
      <button className="btn-primary px-3 py-1.5 text-sm whitespace-nowrap" disabled={busy || max <= 0} onClick={submit}>
        {max <= 0 ? 'Lager leer' : `${label} (${value})`}
      </button>
    </div>
  );
}
