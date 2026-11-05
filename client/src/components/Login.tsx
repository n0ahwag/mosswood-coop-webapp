import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { ValleyScenery } from './Scenery';

export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.guestLogin(name.trim(), code.trim() || undefined);
      onLogin(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <ValleyScenery className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh] w-full" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="animate-bob text-6xl" aria-hidden>🍃</p>
          <h1 className="mt-2 text-outline text-5xl font-bold tracking-wide text-cream">Mosswood</h1>
          <p className="mt-2 text-bark-600">
            Ein gemütliches Tal, das ihr gemeinsam aufbaut. Ohne Angriffe, ohne Eile.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <label className="block">
            <span className="text-sm font-bold text-bark-700">Wie heißt du?</span>
            <input
              className="mt-1 w-full slot px-4 py-2.5 outline-none focus:border-moss-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Juna"
              maxLength={24}
              required
              minLength={2}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-bark-700">Einladungscode (optional)</span>
            <input
              className="mt-1 w-full slot px-4 py-2.5 font-mono uppercase tracking-widest outline-none focus:border-moss-400"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              maxLength={12}
            />
            <span className="mt-1 block text-xs text-bark-500">
              Ohne Code ziehst du in ein Tal mit freiem Platz, oder ein neues wird gegründet.
            </span>
          </label>
          {error && <p className="rounded-xl bg-clay-200 px-3 py-2 text-sm font-semibold text-clay-500">{error}</p>}
          <button className="btn-primary w-full py-3 text-lg" disabled={busy || name.trim().length < 2}>
            {busy ? 'Einen Moment …' : 'Ins Tal ziehen'}
          </button>
        </form>
      </div>
    </main>
  );
}
