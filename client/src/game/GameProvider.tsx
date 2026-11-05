import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, ApiError, SERVER_URL } from '../lib/api';
import { fx } from '../lib/fx';
import { sound, type SoundName } from '../lib/sound';
import type {
  Ack, GameContent, Inventory, Me, ValleyEvent, ValleyState, VillageState,
} from '../lib/types';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

interface GameApi {
  content: GameContent;
  me: Me;
  village: VillageState | null;
  valley: ValleyState | null;
  events: ValleyEvent[];
  connected: boolean;
  toasts: Toast[];
  notify: (text: string, tone?: Toast['tone']) => void;
  logout: () => void;
  /** Aktionen liefern bei Erfolg die Server-Antwort, bei Fehlern undefined (der Fehler wird als Hinweis gezeigt). */
  actions: {
    assignVillager: (villagerId: string, buildingId: string | null) => Promise<unknown>;
    collect: (buildingId: string) => Promise<{ moved: Inventory } | undefined>;
    build: (type: string) => Promise<{ name: string; icon: string; buildingId: string } | undefined>;
    contribute: (projectId: string, resource: string, amount: number) => Promise<{ amount: number; completed: boolean } | undefined>;
    loadShip: (resource: string, amount: number) => Promise<{ amount: number; completed: boolean } | undefined>;
    unlockTech: (techKey: string) => Promise<{ name: string } | undefined>;
  };
}

const GameContext = createContext<GameApi | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame muss innerhalb von <GameProvider> verwendet werden');
  return ctx;
}

export function GameProvider({
  token, onLogout, children,
}: { token: string; onLogout: () => void; children: ReactNode }) {
  const [content, setContent] = useState<GameContent | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [village, setVillage] = useState<VillageState | null>(null);
  const [valley, setValley] = useState<ValleyState | null>(null);
  const [events, setEvents] = useState<ValleyEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Stammdaten + Profil laden
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.content(), api.me(token)])
      .then(([c, m]) => {
        if (cancelled) return;
        setContent(c);
        setMe(m.user);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) onLogout();
        else setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, onLogout]);

  // Echtzeit-Verbindung
  useEffect(() => {
    const socket = io(SERVER_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      setConnected(false);
      if (err.message === 'UNAUTHORIZED') onLogout();
    });
    socket.on('village:state', (state: VillageState) => setVillage(state));
    socket.on('valley:state', (state: ValleyState) => setValley(state));
    socket.on('valley:event', (event: ValleyEvent) => {
      setEvents((list) => [event, ...list].slice(0, 30));
      // Fertige Monumente und volle Schiffe feiert das ganze Tal hörbar mit.
      if (event.icon === '🎉' || event.icon === '🏵️') sound.play('fanfare');
      else if (event.icon === '⚓') sound.play('chime');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, onLogout]);

  const emit = useCallback(<T,>(event: string, payload: unknown) =>
    new Promise<T>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) return reject(new Error('Keine Verbindung zum Tal'));
      socket.timeout(8000).emit(event, payload, (err: Error | null, res: Ack<T>) => {
        if (err) reject(new Error('Der Server antwortet nicht'));
        else if (!res.ok) reject(new Error(res.error));
        else resolve(res.data);
      });
    }), []);

  // Fehler aus Aktionen als Hinweis anzeigen statt sie zu verschlucken
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: SoundName): Promise<T | undefined> => {
      try {
        const res = await fn();
        if (success) sound.play(success);
        return res;
      } catch (err) {
        sound.play('error');
        notify((err as Error).message, 'error');
        return undefined;
      }
    },
    [notify],
  );

  const actions = useMemo<GameApi['actions']>(() => ({
    assignVillager: (villagerId, buildingId) =>
      run(() => emit('villager:assign', { villagerId, buildingId }), 'clack'),
    collect: (buildingId) =>
      run(() => emit<{ moved: Inventory }>('building:collect', { buildingId }), 'pop'),
    build: (type) =>
      run(async () => {
        const res = await emit<{ name: string; icon: string; buildingId: string; feature: string | null }>('building:build', { type });
        fx.emit({ type: 'built', buildingType: type });
        notify(
          res.feature === 'research'
            ? `${res.icon} ${res.name} gebaut! Tippe ihn an, um zu forschen.`
            : res.feature === 'valley'
              ? `${res.icon} ${res.name} gebaut! Die Bahn fährt jetzt ins Tal.`
              : `${res.icon} ${res.name} gebaut!`,
        );
        return res;
      }, 'build'),
    contribute: (projectId, resource, amount) =>
      run(() => emit<{ amount: number; completed: boolean }>('project:contribute', { projectId, resource, amount }), 'clack'),
    loadShip: (resource, amount) =>
      run(() => emit<{ amount: number; completed: boolean }>('ship:load', { resource, amount }), 'clack'),
    unlockTech: (techKey) =>
      run(async () => {
        const res = await emit<{ name: string }>('research:unlock', { techKey });
        notify(`„${res.name}“ erforscht!`);
        return res;
      }, 'chime'),
  }), [emit, run, notify]);

  // Hofbuch: abgeschlossene Aufgaben feiern und neu Freigeschaltetes ansagen
  const lastStep = useRef<number | null>(null);
  const questStep = village?.progression.step;
  useEffect(() => {
    if (questStep == null || !content) return;
    const prev = lastStep.current;
    lastStep.current = questStep;
    if (prev === null || questStep <= prev) return;
    for (const quest of content.quests.slice(prev, questStep)) {
      const gifts = [
        ...(quest.reward.features ?? []).map((f) => `${content.features[f]?.icon} ${content.features[f]?.name}`),
        ...Object.entries(quest.reward.resources ?? {}).map(([r, n]) => `${n} ${content.resources[r]?.icon ?? ''}`),
      ];
      notify(`✔ ${quest.title} geschafft!${gifts.length ? ` Belohnung: ${gifts.join(', ')}` : ''}`);
    }
    sound.play('fanfare');
    fx.emit({ type: 'screen', x: window.innerWidth / 2, y: window.innerHeight * 0.3, label: '🎉 Aufgabe geschafft', tone: 'gold' });
  }, [questStep, content, notify]);

  // Siegel & Prestige aktuell halten (kommen über den Tal-Zustand)
  const liveMe = useMemo(() => {
    if (!me) return null;
    const member = valley?.members.find((m) => m.id === me.id);
    return member ? { ...me, seals: member.seals, prestige: member.prestige } : me;
  }, [me, valley]);

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="card max-w-sm p-6 text-center">
          <p className="text-4xl">🌧️</p>
          <h2 className="mt-2 text-xl font-semibold">Das Tal ist gerade nicht erreichbar</h2>
          <p className="mt-1 text-sm text-bark-600">{loadError}</p>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Erneut versuchen</button>
        </div>
      </div>
    );
  }

  if (!content || !liveMe) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="animate-bob font-display text-2xl text-moss-700">🍃 Das Tal erwacht …</p>
      </div>
    );
  }

  return (
    <GameContext.Provider
      value={{
        content, me: liveMe, village, valley, events, connected, toasts, notify, logout: onLogout, actions,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
