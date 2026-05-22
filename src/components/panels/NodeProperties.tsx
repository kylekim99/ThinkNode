import { useMapStore } from '../../store/useMapStore';

export function NodeProperties() {
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const updateNodeContent = useMapStore((s) => s.updateNodeContent);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const addNode = useMapStore((s) => s.addNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) return null;

  const isRoot = !selectedNode.data.parentId;
  const childCount = nodes.filter((n) => n.data.parentId === selectedNode.id).length;

  return (
    <div className="w-[280px] min-w-[280px] h-full bg-white border-l border-slate-200 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Node Properties</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Content</label>
          <textarea
            value={selectedNode.data.content}
            onChange={(e) => updateNodeContent(selectedNode.id, e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Info</label>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Type</span>
              <span className="text-slate-700 font-medium">{isRoot ? 'Root' : 'Child'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Children</span>
              <span className="text-slate-700 font-medium">{childCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Position</span>
              <span className="text-slate-700 font-mono text-xs">
                {Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Actions</label>
          <button
            onClick={() => {
              setEditingNode(selectedNode.id);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit (F2)
          </button>
          <button
            onClick={() => addNode(selectedNode.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Child (Tab)
          </button>
          {!isRoot && (
            <button
              onClick={() => deleteNode(selectedNode.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete (Del)
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
        ID: {selectedNode.id.slice(0, 12)}...
      </div>
    </div>
  );
}
