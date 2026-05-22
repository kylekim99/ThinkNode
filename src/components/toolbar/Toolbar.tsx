import { useMapStore } from '../../store/useMapStore';
import { useReactFlow } from '@xyflow/react';

export function Toolbar() {
  const activeMapId = useMapStore((s) => s.activeMapId);
  const maps = useMapStore((s) => s.maps);
  const past = useMapStore((s) => s.past);
  const future = useMapStore((s) => s.future);
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const applyLayout = useMapStore((s) => s.applyLayout);
  const dirty = useMapStore((s) => s.dirty);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const activeMap = maps.find((m) => m.id === activeMapId);

  return (
    <div className="h-12 min-h-[48px] bg-white border-b border-slate-200 flex items-center px-4 gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {activeMap ? (
          <h3 className="text-sm font-semibold text-slate-700 truncate">
            {activeMap.name}
          </h3>
        ) : (
          <h3 className="text-sm font-semibold text-slate-700">ThinkNode</h3>
        )}
        {dirty && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
        )}
      </div>

      {activeMapId && (
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={past.length === 0}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
            </svg>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={() => zoomIn({ duration: 200 })}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
          <button
            onClick={() => zoomOut({ duration: 200 })}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <button
            onClick={() => fitView({ padding: 0.3, duration: 300 })}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Fit View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={applyLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            title="Auto Layout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm4 8a1 1 0 011-1h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1v-2zm2 8a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2z" />
            </svg>
            Layout
          </button>
        </div>
      )}
    </div>
  );
}
