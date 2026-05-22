import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { differenceInDays, parseISO, isToday, isPast, format } from 'date-fns';
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

  const dueDateBadge = useMemo(() => {
    if (!data.dueDate) return null;
    const dueDate = parseISO(data.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = differenceInDays(dueDate, today);
    let colorClass: string;
    if (isToday(dueDate) || isPast(dueDate)) {
      colorClass = 'bg-red-100 text-red-600';
    } else if (diff <= 3) {
      colorClass = 'bg-amber-100 text-amber-600';
    } else {
      colorClass = 'bg-green-100 text-green-600';
    }
    const formatted = format(dueDate, 'M/d');
    return { colorClass, formatted };
  }, [data.dueDate]);

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
      {/* 4-directional connection handles */}
      <Handle type="target" position={Position.Top} id="top"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
      <Handle type="source" position={Position.Top} id="top-src"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
      <Handle type="target" position={Position.Bottom} id="bottom"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
      <Handle type="source" position={Position.Bottom} id="bottom-src"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
      <Handle type="target" position={Position.Left} id="left"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
      <Handle type="source" position={Position.Left} id="left-src"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
      <Handle type="target" position={Position.Right} id="right"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
      <Handle type="source" position={Position.Right} id="right-src"
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />

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

      {dueDateBadge && (
        <div className="flex justify-center mt-1.5">
          <span className={`text-xs px-1.5 py-0.5 rounded-full leading-tight ${dueDateBadge.colorClass}`}>
            {'\uD83D\uDCC5'} {dueDateBadge.formatted}
          </span>
        </div>
      )}
    </div>
  );
}

export const MindMapNode = memo(MindMapNodeComponent);
