import { useState, useRef, useEffect } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { format } from 'date-fns';

export function MapList() {
  const maps = useMapStore((s) => s.maps);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const loadMap = useMapStore((s) => s.loadMap);
  const deleteMap = useMapStore((s) => s.deleteMap);
  const renameMap = useMapStore((s) => s.renameMap);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      renameMap(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('Delete this mind map?')) {
      deleteMap(id);
    }
  }

  if (maps.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-slate-400 text-sm">
        No maps yet. Create one above.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {maps.map((map) => (
        <div
          key={map.id}
          onClick={() => loadMap(map.id)}
          className={`
            group px-3 py-2.5 cursor-pointer border-b border-slate-100
            hover:bg-slate-50 transition-colors
            ${activeMapId === map.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            {renamingId === map.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="flex-1 text-sm font-medium bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-medium text-slate-700 truncate flex-1">
                {map.name}
              </span>
            )}

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(map.id, map.name);
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                title="Rename"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={(e) => handleDelete(map.id, e)}
                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {format(new Date(map.updatedAt), 'MMM d, yyyy HH:mm')}
          </div>
        </div>
      ))}
    </div>
  );
}
