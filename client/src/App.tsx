import { useCallback, useState } from 'react';
import { Login } from './components/Login';
import { Shell } from './components/Shell';
import { GameProvider } from './game/GameProvider';
import { tokenStore } from './lib/api';

export default function App() {
  const [token, setToken] = useState<string | null>(() => tokenStore.get());

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
      <Shell />
    </GameProvider>
  );
}
