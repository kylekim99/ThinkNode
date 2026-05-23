import { useState, useRef, useEffect, useCallback } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { useThemeStore, type ThemeName } from '../../store/useThemeStore';
import { useReactFlow } from '@xyflow/react';
import { convertMindmapToFlowchart } from '../../lib/flowchartConverter';
import type { LayoutDirection } from '../../lib/layoutEngine';

const layoutOptions: { value: LayoutDirection; label: string; icon: string }[] = [
  { value: 'vertical', label: 'Top \u2192 Bottom', icon: '\u2193' },
  { value: 'horizontal-lr', label: 'Left \u2192 Right', icon: '\u2192' },
  { value: 'horizontal-rl', label: 'Right \u2192 Left', icon: '\u2190' },
];

const themeOptions: { value: ThemeName; label: string; color: string }[] = [
  { value: 'light', label: 'Light', color: '#f8fafc' },
  { value: 'dark', label: 'Dark', color: '#1e1e2e' },
  { value: 'colorful', label: 'Colorful', color: '#8b5cf6' },
];

export function Toolbar() {
  const activeMapId = useMapStore((s) => s.activeMapId);
  const maps = useMapStore((s) => s.maps);
  const nodes = useMapStore((s) => s.nodes);
  const edges = useMapStore((s) => s.edges);
  const past = useMapStore((s) => s.past);
  const future = useMapStore((s) => s.future);
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const applyLayout = useMapStore((s) => s.applyLayout);
  const layoutDirection = useMapStore((s) => s.layoutDirection);
  const dirty = useMapStore((s) => s.dirty);
  const createMap = useMapStore((s) => s.createMap);
  const setNodes = useMapStore((s) => s.setNodes);
  const setEdges = useMapStore((s) => s.setEdges);
  const saveNow = useMapStore((s) => s.saveNow);
  const exportCurrentMap = useMapStore((s) => s.exportCurrentMap);
  const importMap = useMapStore((s) => s.importMap);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMap = maps.find((m) => m.id === activeMapId);
  const isFlowchart = activeMap?.type === 'flowchart';

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    }
    if (showLayoutMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showLayoutMenu]);

  function handleLayoutSelect(direction: LayoutDirection) {
    applyLayout(direction);
    setShowLayoutMenu(false);
    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
  }

  const handleConvertToFlowchart = useCallback(async () => {
    if (!activeMapId || !activeMap || isFlowchart) return;
    if (nodes.length < 2) {
      alert('At least 2 nodes are required to convert to a flowchart.');
      return;
    }

    try {
      const result = convertMindmapToFlowchart(nodes, edges);
      const name = `${activeMap.name} (Flowchart)`;
      await createMap(name, 'flowchart');
      // After createMap, the new map is active; replace its nodes/edges with converted ones
      setNodes(result.nodes);
      setEdges(result.edges);
      await saveNow();
      setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed';
      alert(msg);
    }
  }, [activeMapId, activeMap, isFlowchart, nodes, edges, createMap, setNodes, setEdges, saveNow, fitView]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importMap(file);
      setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      alert(msg);
    }
    // Reset file input so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [importMap, fitView]);

  const currentOption = layoutOptions.find((o) => o.value === layoutDirection) || layoutOptions[0];

  return (
    <div className="h-12 min-h-[48px] border-b flex items-center px-4 gap-2" style={{ backgroundColor: 'var(--toolbar-bg)', borderColor: 'var(--toolbar-border)' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {activeMap ? (
          <h3 className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--toolbar-text)' }}>
            <span>{isFlowchart ? '\uD83D\uDCD0' : '\uD83E\uDDE0'}</span>
            {activeMap.name}
          </h3>
        ) : (
          <h3 className="text-sm font-semibold" style={{ color: 'var(--toolbar-text)' }}>ThinkNode</h3>
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

          {/* Layout button with dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              title="Auto Layout (Ctrl+L)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm4 8a1 1 0 011-1h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1v-2zm2 8a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2z" />
              </svg>
              Layout {currentOption.icon}
              <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLayoutMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                {layoutOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleLayoutSelect(option.value)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                      layoutDirection === option.value
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-5 text-center">{option.icon}</span>
                    {option.label}
                    {layoutDirection === option.value && (
                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Convert to Flowchart button (only for mindmaps with 2+ nodes) */}
          {!isFlowchart && nodes.length >= 2 && (
            <>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <button
                onClick={handleConvertToFlowchart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                title="Convert to Flowchart"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                To Flowchart
              </button>
            </>
          )}

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Export button */}
          <button
            onClick={exportCurrentMap}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--toolbar-text)' }}
            title="Export as JSON"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          {/* Import button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--toolbar-text)' }}
            title="Import JSON"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Theme Selector */}
          <div className="flex items-center gap-1">
            {themeOptions.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  theme === t.value ? 'scale-110 ring-2 ring-offset-1 ring-blue-400' : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: t.color,
                  borderColor: theme === t.value ? '#3b82f6' : '#94a3b8',
                }}
                title={t.label}
              />
            ))}
          </div>
        </div>
      )}

      {/* Show import/export and theme even when no map is active */}
      {!activeMapId && (
        <div className="flex items-center gap-1">
          {/* Import button (always available) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--toolbar-text)' }}
            title="Import JSON"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Theme Selector */}
          <div className="flex items-center gap-1">
            {themeOptions.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  theme === t.value ? 'scale-110 ring-2 ring-offset-1 ring-blue-400' : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: t.color,
                  borderColor: theme === t.value ? '#3b82f6' : '#94a3b8',
                }}
                title={t.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
