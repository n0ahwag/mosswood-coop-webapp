import { useRef, useState } from 'react';
import { fx } from '../../lib/fx';

// Einzahlungs-Steuerung: Menge wählen und in ein Projekt oder aufs Schiff geben.
export function DepositControl({
  available, missing, onDeposit, label = 'Einzahlen',
}: {
  available: number;
  missing: number;
  onDeposit: (amount: number) => Promise<{ amount: number; completed: boolean } | undefined>;
  label?: string;
}) {
  const max = Math.min(available, missing);
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const value = Math.max(1, Math.min(amount, Math.max(1, max)));

  const submit = async () => {
    setBusy(true);
    try {
      const res = await onDeposit(value);
      if (res) fx.burstAt(button.current, res.completed ? '🎉' : `✔ ${res.amount}`, 'green');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="slot flex items-center p-0.5">
        {[10, 50].map((n) => (
          <button
            key={n}
            className={`rounded-xl px-2 py-1 text-xs font-bold ${amount === n ? 'bg-gold-300 shadow-[0_2px_0_var(--color-gold-500)]' : 'text-bark-600'}`}
            onClick={() => setAmount(n)}
          >
            {n}
          </button>
        ))}
        <button
          className={`rounded-xl px-2 py-1 text-xs font-bold ${amount >= max && max > 0 ? 'bg-gold-300 shadow-[0_2px_0_var(--color-gold-500)]' : 'text-bark-600'}`}
          onClick={() => setAmount(Math.max(1, max))}
        >
          Max
        </button>
      </div>
      <button ref={button} className="btn-primary px-3 py-1.5 text-sm whitespace-nowrap" disabled={busy || max <= 0} onClick={submit}>
        {max <= 0 ? 'Lager leer' : `${label} (${value})`}
      </button>
    </div>
  );
}
