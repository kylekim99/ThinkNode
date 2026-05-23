import { useMapStore } from '../../store/useMapStore';

const colorPresets = [
  { name: 'Red', color: '#fecaca' },
  { name: 'Blue', color: '#bfdbfe' },
  { name: 'Green', color: '#bbf7d0' },
  { name: 'Purple', color: '#ddd6fe' },
  { name: 'Orange', color: '#fed7aa' },
  { name: 'Pink', color: '#fbcfe8' },
  { name: 'Yellow', color: '#fef08a' },
  { name: 'Gray', color: '#e2e8f0' },
];

export function NodeProperties() {
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const updateNodeContent = useMapStore((s) => s.updateNodeContent);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const addNode = useMapStore((s) => s.addNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const setDueDate = useMapStore((s) => s.setDueDate);
  const setNodeColor = useMapStore((s) => s.setNodeColor);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) return null;

  const isRoot = !selectedNode.data.parentId;
  const childCount = nodes.filter((n) => n.data.parentId === selectedNode.id).length;

  return (
    <div className="w-[280px] min-w-[280px] h-full border-l flex flex-col" style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--sidebar-text)' }}>Node Properties</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>Content</label>
          <textarea
            value={selectedNode.data.content}
            onChange={(e) => updateNodeContent(selectedNode.id, e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
            style={{ borderColor: 'var(--node-border)', backgroundColor: 'var(--node-bg)', color: 'var(--node-text)' }}
            rows={3}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>Info</label>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--sidebar-text)', opacity: 0.5 }}>Type</span>
              <span className="font-medium" style={{ color: 'var(--sidebar-text)' }}>{isRoot ? 'Root' : 'Child'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--sidebar-text)', opacity: 0.5 }}>Children</span>
              <span className="font-medium" style={{ color: 'var(--sidebar-text)' }}>{childCount}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--sidebar-text)', opacity: 0.5 }}>Position</span>
              <span className="font-mono text-xs" style={{ color: 'var(--sidebar-text)' }}>
                {Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>Node Color</label>
          <div className="flex flex-wrap gap-1.5">
            {colorPresets.map((preset) => (
              <button
                key={preset.color}
                onClick={() => setNodeColor(selectedNode.id, preset.color)}
                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                  selectedNode.data.customColor === preset.color ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: preset.color,
                  borderColor: selectedNode.data.customColor === preset.color ? '#3b82f6' : '#94a3b8',
                }}
                title={preset.name}
              />
            ))}
            {selectedNode.data.customColor && (
              <button
                onClick={() => setNodeColor(selectedNode.id, null)}
                className="px-2 py-0.5 text-xs font-medium rounded-lg border transition-colors hover:bg-slate-50"
                style={{ color: 'var(--sidebar-text)', borderColor: 'var(--node-border)' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>Due Date</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedNode.data.dueDate || ''}
              onChange={(e) => setDueDate(selectedNode.id, e.target.value || null)}
              className="flex-1 text-sm border rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
              style={{ borderColor: 'var(--node-border)', backgroundColor: 'var(--node-bg)', color: 'var(--node-text)' }}
            />
            {selectedNode.data.dueDate && (
              <button
                onClick={() => setDueDate(selectedNode.id, null)}
                className="px-2 py-1.5 text-xs font-medium border rounded-lg transition-colors"
                style={{ color: 'var(--sidebar-text)', borderColor: 'var(--node-border)' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>Actions</label>
          <button
            onClick={() => {
              setEditingNode(selectedNode.id);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors"
            style={{ color: 'var(--sidebar-text)', borderColor: 'var(--node-border)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit (F2)
          </button>
          <button
            onClick={() => addNode(selectedNode.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors"
            style={{ color: 'var(--sidebar-text)', borderColor: 'var(--node-border)' }}
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

      <div className="px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--sidebar-border)', color: 'var(--sidebar-text)', opacity: 0.5 }}>
        ID: {selectedNode.id.slice(0, 12)}...
      </div>
    </div>
  );
}
