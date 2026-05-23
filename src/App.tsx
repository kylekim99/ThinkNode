import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Sidebar } from './components/sidebar/Sidebar';
import { Toolbar } from './components/toolbar/Toolbar';
import { MindMapCanvas } from './components/canvas/MindMapCanvas';
import { FlowchartCanvas } from './components/canvas/FlowchartCanvas';
import { NodeProperties } from './components/panels/NodeProperties';
import { SearchResults } from './components/panels/SearchResults';
import { TimelineView } from './components/timeline/TimelineView';
import { SearchOverlay } from './components/search/SearchOverlay';
import { useMapStore } from './store/useMapStore';
import { useTagStore } from './store/useTagStore';
import { useThemeStore } from './store/useThemeStore';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function AppContent() {
  const init = useMapStore((s) => s.init);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const viewMode = useTagStore((s) => s.viewMode);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const maps = useMapStore((s) => s.maps);

  const activeMap = maps.find((m) => m.id === activeMapId);
  const isFlowchart = activeMap?.type === 'flowchart';
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    init();
  }, [init]);

  useAutoSave();
  useKeyboardShortcuts();

  // Keep theme variable in scope for reactivity
  void theme;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--canvas-bg)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Toolbar />
        <div className="flex-1 flex min-h-0">
          {viewMode === 'search' ? (
            <SearchResults />
          ) : viewMode === 'timeline' ? (
            <TimelineView />
          ) : (
            <>
              {isFlowchart ? <FlowchartCanvas /> : <MindMapCanvas />}
              {selectedNodeId && !isFlowchart && <NodeProperties />}
            </>
          )}
        </div>
      </div>
      <SearchOverlay />
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}

export default App;
