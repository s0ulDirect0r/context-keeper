// Client-side localStorage helpers

const OTTER_SESSION_KEY = 'context-keeper:otter-session';
const PREFERENCES_KEY = 'context-keeper:preferences';

export interface StoredOtterSession {
  email: string;
  userId: string;
  cookies: string;
  csrfToken?: string;
}

export interface Preferences {
  rememberCredentials: boolean;
}

export function getStoredSession(): StoredOtterSession | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(OTTER_SESSION_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as StoredOtterSession;
  } catch {
    return null;
  }
}

export function storeSession(session: StoredOtterSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OTTER_SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OTTER_SESSION_KEY);
}

export function getPreferences(): Preferences {
  if (typeof window === 'undefined') {
    return { rememberCredentials: true };
  }

  const stored = localStorage.getItem(PREFERENCES_KEY);
  if (!stored) {
    return { rememberCredentials: true };
  }

  try {
    return JSON.parse(stored) as Preferences;
  } catch {
    return { rememberCredentials: true };
  }
}

export function setPreferences(prefs: Preferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}
