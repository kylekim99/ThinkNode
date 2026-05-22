import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindMapNodeData } from '../../types/mindmap';
import { useMapStore } from '../../store/useMapStore';

type MindMapNodeProps = NodeProps & { data: MindMapNodeData };

function MindMapNodeComponent({ id, data, selected }: MindMapNodeProps) {
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const updateNodeContent = useMapStore((s) => s.updateNodeContent);
  const selectNode = useMapStore((s) => s.selectNode);

  const isEditing = editingNodeId === id;
  const [editValue, setEditValue] = useState(data.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevEditingRef = useRef(false);

  useEffect(() => {
    if (isEditing && !prevEditingRef.current) {
      setEditValue(data.content);
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, data.content]);

  useEffect(() => {
    if (isEditing) {
      // Immediate attempt + delayed retry for newly created nodes
      const focus = () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      };
      focus();
      const timer = setTimeout(focus, 50);
      const timer2 = setTimeout(focus, 150);
      return () => { clearTimeout(timer); clearTimeout(timer2); };
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== data.content) {
      updateNodeContent(id, trimmed);
    }
    setEditingNode(null);
    // Return focus to the canvas so global keyboard shortcuts (Enter for sibling) work immediately
    requestAnimationFrame(() => {
      const pane = document.querySelector('.react-flow__pane') as HTMLElement;
      pane?.focus();
    });
  }, [editValue, data.content, id, updateNodeContent, setEditingNode]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id);
    setEditingNode(id);
  }, [id, selectNode, setEditingNode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingNode(null);
      }
      e.stopPropagation();
    },
    [commitEdit, setEditingNode]
  );

  const isRoot = !data.parentId;

  return (
    <div
      className={`
        min-w-[120px] max-w-[260px] px-4 py-2 rounded-lg
        border-2 transition-all duration-150
        ${selected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-slate-200 shadow-md'}
        ${isRoot ? 'bg-blue-50 border-blue-300' : 'bg-white'}
        hover:shadow-lg cursor-pointer
      `}
      onDoubleClick={handleDoubleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors"
      />

      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent outline-none text-center text-sm font-medium text-slate-800 border-b-2 border-blue-400"
        />
      ) : (
        <div className="text-center text-sm font-medium text-slate-800 select-none truncate">
          {data.content}
        </div>
      )}

      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-1.5">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 leading-tight"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const MindMapNode = memo(MindMapNodeComponent);
