import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Sidebar } from './components/sidebar/Sidebar';
import { Toolbar } from './components/toolbar/Toolbar';
import { MindMapCanvas } from './components/canvas/MindMapCanvas';
import { NodeProperties } from './components/panels/NodeProperties';
import { SearchResults } from './components/panels/SearchResults';
import { TimelineView } from './components/timeline/TimelineView';
import { SearchOverlay } from './components/search/SearchOverlay';
import { useMapStore } from './store/useMapStore';
import { useTagStore } from './store/useTagStore';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function AppContent() {
  const init = useMapStore((s) => s.init);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const viewMode = useTagStore((s) => s.viewMode);

  useEffect(() => {
    init();
  }, [init]);

  useAutoSave();
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
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
              <MindMapCanvas />
              {selectedNodeId && <NodeProperties />}
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
