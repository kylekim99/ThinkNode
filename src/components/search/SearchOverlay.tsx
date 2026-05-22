import { useEffect, useRef, useCallback } from 'react';
import { useTagStore, type TagEntry } from '../../store/useTagStore';
import { useMapStore } from '../../store/useMapStore';

export function SearchOverlay() {
  const searchOverlayOpen = useTagStore((s) => s.searchOverlayOpen);
  const setSearchOverlayOpen = useTagStore((s) => s.setSearchOverlayOpen);
  const searchQuery = useTagStore((s) => s.searchQuery);
  const searchResults = useTagStore((s) => s.searchResults);
  const search = useTagStore((s) => s.search);
  const selectTag = useTagStore((s) => s.selectTag);
  const setViewMode = useTagStore((s) => s.setViewMode);
  const loadMap = useMapStore((s) => s.loadMap);
  const selectNode = useMapStore((s) => s.selectNode);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOverlayOpen) {
      // Small delay to let the overlay render before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [searchOverlayOpen]);

  const handleClose = useCallback(() => {
    setSearchOverlayOpen(false);
  }, [setSearchOverlayOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose]
  );

  async function handleResultClick(entry: TagEntry) {
    handleClose();
    await loadMap(entry.mapId);
    selectNode(entry.nodeId);
    selectTag(null);
    setViewMode('mindmap');
  }

  if (!searchOverlayOpen) return null;

  // Group results by map
  const grouped = searchResults.reduce<Record<string, { mapName: string; entries: TagEntry[] }>>(
    (acc, entry) => {
      if (!acc[entry.mapId]) {
        acc[entry.mapId] = { mapName: entry.mapName, entries: [] };
      }
      acc[entry.mapId].entries.push(entry);
      return acc;
    },
    {}
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[560px] bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => search(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search nodes and tags across all maps..."
            className="flex-1 text-sm outline-none placeholder-slate-400 text-slate-800"
          />
          <kbd className="hidden sm:inline-block text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {searchQuery.trim() === '' ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Type to search across all mind maps...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No results for "{searchQuery}"
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(grouped).map(([mapId, { mapName, entries }]) => (
                <div key={mapId}>
                  <div className="px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                    {mapName}
                  </div>
                  {entries.map((entry) => (
                    <button
                      key={`${entry.mapId}-${entry.nodeId}`}
                      onClick={() => handleResultClick(entry)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-start gap-3"
                    >
                      <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate">
                          {entry.nodeContent}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
