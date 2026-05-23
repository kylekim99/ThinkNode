import { useEffect, useCallback } from 'react';
import { useSyncStore } from '../../store/useSyncStore';

export function SyncStatus() {
  const isAuthenticated = useSyncStore((s) => s.isAuthenticated);
  const username = useSyncStore((s) => s.username);
  const status = useSyncStore((s) => s.status);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const error = useSyncStore((s) => s.error);
  const lastResult = useSyncStore((s) => s.lastResult);
  const setLoginDialogOpen = useSyncStore((s) => s.setLoginDialogOpen);
  const push = useSyncStore((s) => s.push);
  const pull = useSyncStore((s) => s.pull);
  const sync = useSyncStore((s) => s.sync);
  const logout = useSyncStore((s) => s.logout);
  const silentValidate = useSyncStore((s) => s.silentValidate);
  const clearError = useSyncStore((s) => s.clearError);
  const clearResult = useSyncStore((s) => s.clearResult);

  // Validate token on mount
  useEffect(() => {
    silentValidate();
  }, [silentValidate]);

  // Auto-clear result notification after 5 seconds
  useEffect(() => {
    if (lastResult) {
      const timer = setTimeout(() => clearResult(), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastResult, clearResult]);

  const handleSync = useCallback(() => {
    clearError();
    sync();
  }, [sync, clearError]);

  if (!isAuthenticated) {
    return (
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
        <button
          onClick={() => setLoginDialogOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-slate-600 hover:bg-slate-50"
          style={{ color: 'var(--sidebar-text)' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" opacity={0.7}>
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Connect GitHub
        </button>
      </div>
    );
  }

  const isSyncing = status === 'syncing';

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
      {/* Result notification */}
      {lastResult && (lastResult.pushed.length > 0 || lastResult.pulled.length > 0) && (
        <div
          className="mb-2 p-2 rounded-lg text-xs"
          style={{ backgroundColor: 'var(--canvas-bg)' }}
        >
          {lastResult.pushed.length > 0 && (
            <p className="text-green-600">
              Pushed {lastResult.pushed.length} map{lastResult.pushed.length > 1 ? 's' : ''}
            </p>
          )}
          {lastResult.pulled.length > 0 && (
            <p className="text-blue-600">
              Pulled {lastResult.pulled.length} map{lastResult.pulled.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start justify-between gap-1">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* User info + status */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            status === 'synced' ? 'bg-green-500' :
            status === 'syncing' ? 'bg-yellow-500 animate-pulse' :
            status === 'error' ? 'bg-red-500' :
            'bg-gray-400'
          }`}
        />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--sidebar-text)', opacity: 0.7 }}>
          {username}
        </span>
        {lastSyncAt && (
          <span className="text-xs shrink-0" style={{ color: 'var(--sidebar-text)', opacity: 0.4 }}>
            {formatTime(lastSyncAt)}
          </span>
        )}
      </div>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: isSyncing ? 'var(--canvas-bg)' : undefined,
          color: 'var(--sidebar-text)',
        }}
      >
        <svg
          className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isSyncing ? 'Syncing...' : 'Sync'}
      </button>

      {/* Push / Pull individual buttons */}
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={() => { clearError(); push(); }}
          disabled={isSyncing}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
          style={{ backgroundColor: 'var(--canvas-bg)', color: 'var(--sidebar-text)' }}
          title="Push local maps to GitHub"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
          Push
        </button>
        <button
          onClick={() => { clearError(); pull(); }}
          disabled={isSyncing}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
          style={{ backgroundColor: 'var(--canvas-bg)', color: 'var(--sidebar-text)' }}
          title="Pull maps from GitHub"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
          Pull
        </button>
      </div>

      {/* Disconnect */}
      <button
        onClick={logout}
        className="w-full mt-2 text-xs text-center py-1 transition-colors hover:opacity-70"
        style={{ color: 'var(--sidebar-text)', opacity: 0.4 }}
      >
        Disconnect
      </button>
    </div>
  );
}
