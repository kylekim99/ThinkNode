import { create } from 'zustand';
import { validateToken } from '../sync/githubApi';
import { pushToGitHub, pullFromGitHub, syncMaps } from '../sync/syncManager';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncStore {
  // Auth
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;

  // Sync status
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;

  // Sync results (for notification)
  lastResult: { pushed: string[]; pulled: string[] } | null;

  // Login dialog
  loginDialogOpen: boolean;
  setLoginDialogOpen: (open: boolean) => void;

  // Actions
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  sync: () => Promise<void>;
  silentValidate: () => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

function loadToken(): string | null {
  try {
    return localStorage.getItem('thinknode-gh-token');
  } catch {
    return null;
  }
}

function loadUsername(): string | null {
  try {
    return localStorage.getItem('thinknode-gh-user');
  } catch {
    return null;
  }
}

function saveAuth(token: string, username: string): void {
  try {
    localStorage.setItem('thinknode-gh-token', token);
    localStorage.setItem('thinknode-gh-user', username);
  } catch {
    // localStorage unavailable
  }
}

function clearAuth(): void {
  try {
    localStorage.removeItem('thinknode-gh-token');
    localStorage.removeItem('thinknode-gh-user');
  } catch {
    // localStorage unavailable
  }
}

const storedToken = loadToken();
const storedUsername = loadUsername();

export const useSyncStore = create<SyncStore>((set, get) => ({
  token: storedToken,
  username: storedUsername,
  isAuthenticated: !!(storedToken && storedUsername),
  status: 'idle',
  lastSyncAt: null,
  error: null,
  lastResult: null,
  loginDialogOpen: false,

  setLoginDialogOpen: (open) => set({ loginDialogOpen: open }),

  login: async (token: string) => {
    const username = await validateToken(token);
    if (!username) {
      set({ error: 'Invalid token. Please check your Personal Access Token.' });
      return false;
    }

    saveAuth(token, username);
    set({
      token,
      username,
      isAuthenticated: true,
      error: null,
      loginDialogOpen: false,
    });
    return true;
  },

  logout: () => {
    clearAuth();
    set({
      token: null,
      username: null,
      isAuthenticated: false,
      status: 'idle',
      lastSyncAt: null,
      error: null,
      lastResult: null,
    });
  },

  push: async () => {
    const { token, username } = get();
    if (!token || !username) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ status: 'syncing', error: null });

    try {
      const pushed = await pushToGitHub(token, username);
      set({
        status: 'synced',
        lastSyncAt: new Date().toISOString(),
        lastResult: { pushed, pulled: [] },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Push failed';
      set({ status: 'error', error: message });
    }
  },

  pull: async () => {
    const { token, username } = get();
    if (!token || !username) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ status: 'syncing', error: null });

    try {
      const pulled = await pullFromGitHub(token, username);
      set({
        status: 'synced',
        lastSyncAt: new Date().toISOString(),
        lastResult: { pushed: [], pulled },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pull failed';
      set({ status: 'error', error: message });
    }
  },

  sync: async () => {
    const { token, username } = get();
    if (!token || !username) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ status: 'syncing', error: null });

    try {
      const result = await syncMaps(token, username);
      set({
        status: 'synced',
        lastSyncAt: new Date().toISOString(),
        lastResult: { pushed: result.pushed, pulled: result.pulled },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      set({ status: 'error', error: message });
    }
  },

  silentValidate: async () => {
    const { token } = get();
    if (!token) return;

    const username = await validateToken(token);
    if (!username) {
      // Token is invalid/expired — clear auth silently
      clearAuth();
      set({
        token: null,
        username: null,
        isAuthenticated: false,
        status: 'idle',
      });
    } else {
      set({ username, isAuthenticated: true });
    }
  },

  clearError: () => set({ error: null }),
  clearResult: () => set({ lastResult: null }),
}));
