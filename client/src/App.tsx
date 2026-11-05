import { useCallback, useMemo, useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { Login } from './components/Login';
import { Shell } from './components/Shell';
import { GameProvider } from './game/GameProvider';
import { tokenStore } from './lib/api';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const webgl = useMemo(hasWebGL, []);
  // Ohne WebGL (oder wenn die 3D-Welt abstürzt) gibt es die klassische Ansicht mit Reitern.
  const [classic, setClassic] = useState(!webgl);

  const login = useCallback((t: string) => {
    tokenStore.set(t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
  }, []);

  if (!token) return <Login onLogin={login} />;

  return (
    <GameProvider token={token} onLogout={logout}>
      {classic ? <Shell /> : <GameScreen onSceneFailed={() => setClassic(true)} />}
    </GameProvider>
  );
}
