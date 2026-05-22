import { useTagStore, type TagEntry } from '../../store/useTagStore';
import { useMapStore } from '../../store/useMapStore';

export function SearchResults() {
  const selectedTag = useTagStore((s) => s.selectedTag);
  const searchResults = useTagStore((s) => s.searchResults);
  const setViewMode = useTagStore((s) => s.setViewMode);
  const selectTag = useTagStore((s) => s.selectTag);
  const loadMap = useMapStore((s) => s.loadMap);
  const selectNode = useMapStore((s) => s.selectNode);

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

  function handleBackToMap() {
    selectTag(null);
    setViewMode('mindmap');
  }

  async function handleResultClick(entry: TagEntry) {
    await loadMap(entry.mapId);
    selectNode(entry.nodeId);
    selectTag(null);
    setViewMode('mindmap');
  }

  return (
    <div className="flex-1 h-full bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {selectedTag ? (
              <>
                Nodes tagged{' '}
                <span className="text-blue-600">#{selectedTag}</span>
              </>
            ) : (
              'Search Results'
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {searchResults.length} node{searchResults.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          onClick={handleBackToMap}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to map
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {searchResults.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">No matching nodes found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([mapId, { mapName, entries }]) => (
              <div key={mapId}>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  {mapName}
                </h3>
                <div className="space-y-1.5">
                  {entries.map((entry) => (
                    <button
                      key={`${entry.mapId}-${entry.nodeId}`}
                      onClick={() => handleResultClick(entry)}
                      className="w-full text-left px-4 py-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                    >
                      <p className="text-sm text-slate-800 group-hover:text-blue-700 transition-colors">
                        {entry.nodeContent}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`
                              text-xs px-1.5 py-0.5 rounded-full
                              ${tag === selectedTag ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}
                            `}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
