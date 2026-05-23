import { useState } from 'react';
import { useSyncStore } from '../../store/useSyncStore';

export function SyncLoginDialog() {
  const isOpen = useSyncStore((s) => s.loginDialogOpen);
  const setOpen = useSyncStore((s) => s.setLoginDialogOpen);
  const login = useSyncStore((s) => s.login);
  const error = useSyncStore((s) => s.error);
  const clearError = useSyncStore((s) => s.clearError);

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);
    clearError();
    const success = await login(token.trim());
    setLoading(false);
    if (success) {
      setToken('');
    }
  };

  const handleClose = () => {
    setToken('');
    clearError();
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md mx-4 rounded-xl shadow-2xl p-6"
        style={{ backgroundColor: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Connect to GitHub</h2>
            <p className="text-xs opacity-60">Sync your maps across devices</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed" style={{ backgroundColor: 'var(--canvas-bg)' }}>
          <p className="mb-2">Enter a GitHub Personal Access Token with <strong>repo</strong> scope to enable sync.</p>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=ThinkNode%20Sync"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline"
          >
            Create a token on GitHub
          </a>
        </div>

        {/* Token input */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5 opacity-70">
            Personal Access Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConnect();
              if (e.key === 'Escape') handleClose();
            }}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            autoFocus
            className="w-full text-sm border rounded-lg px-3 py-2.5 outline-none transition-colors font-mono"
            style={{
              backgroundColor: 'var(--canvas-bg)',
              borderColor: 'var(--sidebar-border)',
              color: 'var(--sidebar-text)',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--sidebar-text)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!token.trim() || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        {/* Security note */}
        <p className="mt-4 text-xs opacity-40 text-center">
          Token is stored locally in your browser. Your maps are synced to a private GitHub repo.
        </p>
      </div>
    </div>
  );
}
