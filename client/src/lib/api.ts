import type { GameContent, Me } from './types';

const TOKEN_KEY = 'mosswood.token';

// Leer im Dev-Modus und bei Docker (gleiche Herkunft), gesetzt beim Build für GitHub Pages.
export const SERVER_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* privates Fenster o. Ä. – Login gilt dann nur für diese Sitzung */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignorieren */
    }
  },
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  if (!SERVER_URL && window.location.hostname.endsWith('github.io')) {
    throw new ApiError(
      'Für diese Seite ist noch kein Spielserver eingetragen (Repository-Variable API_URL).',
      0,
    );
  }
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Der Spielserver ist gerade nicht erreichbar. Falls er geschlafen hat, versuch es in einer Minute noch einmal.',
      0,
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Fehler ${res.status}`, res.status);
  return body as T;
}

export const api = {
  content: () => request<GameContent>('/content'),
  me: (token: string) => request<{ user: Me }>('/me', {}, token),
  guestLogin: (displayName: string, inviteCode?: string) =>
    request<{ token: string; user: Me }>('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName, inviteCode }),
    }),
};
