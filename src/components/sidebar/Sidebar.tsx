import { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { MapList } from './MapList';
import { TagExplorer } from './TagExplorer';

export function Sidebar() {
  const createMap = useMapStore((s) => s.createMap);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  function handleCreate() {
    const name = newName.trim() || 'Untitled Map';
    createMap(name);
    setNewName('');
    setIsCreating(false);
  }

  return (
    <div className="w-[250px] min-w-[250px] h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight">ThinkNode</h2>
        </div>
        <p className="text-xs text-slate-400">Mind Map Editor</p>
      </div>

      <div className="px-3 py-2 border-b border-slate-100">
        {isCreating ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
              }}
              placeholder="Map name..."
              className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-400"
            />
            <button
              onClick={handleCreate}
              className="px-2.5 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Map
          </button>
        )}
      </div>

      <MapList />
      <TagExplorer />
    </div>
  );
}
