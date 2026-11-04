import type { GameContent, Me } from './types';

const TOKEN_KEY = 'mosswood.token';

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
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
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
