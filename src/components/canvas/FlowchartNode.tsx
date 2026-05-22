import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowchartNodeData } from '../../types/mindmap';
import { useMapStore } from '../../store/useMapStore';

type FlowchartNodeProps = NodeProps & { data: FlowchartNodeData };

const handleClass =
  '!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors';

function FlowchartNodeComponent({ id, data, selected }: FlowchartNodeProps) {
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
      const focus = () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      };
      focus();
      const timer = setTimeout(focus, 50);
      const timer2 = setTimeout(focus, 150);
      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
      };
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== data.content) {
      updateNodeContent(id, trimmed);
    }
    setEditingNode(null);
    requestAnimationFrame(() => {
      const pane = document.querySelector('.react-flow__pane') as HTMLElement;
      pane?.focus();
    });
  }, [editValue, data.content, id, updateNodeContent, setEditingNode]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectNode(id);
      setEditingNode(id);
    },
    [id, selectNode, setEditingNode]
  );

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

  const shape = data.shape || 'process';

  const selectionRing = selected
    ? 'ring-2 ring-blue-500 ring-offset-2'
    : '';

  const textContent = isEditing ? (
    <input
      ref={inputRef}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={handleKeyDown}
      className="w-full bg-transparent outline-none text-center text-sm font-medium text-white border-b-2 border-white/50 placeholder-white/60"
    />
  ) : (
    <div className="text-center text-sm font-medium text-white select-none truncate">
      {data.content}
    </div>
  );

  const handles = (
    <>
      <Handle type="target" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Top} id="top-src" className={handleClass} />
      <Handle type="target" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom-src" className={handleClass} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left-src" className={handleClass} />
      <Handle type="target" position={Position.Right} id="right" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right-src" className={handleClass} />
    </>
  );

  if (shape === 'start-end') {
    return (
      <div
        className={`min-w-[140px] max-w-[220px] px-6 py-3 rounded-full bg-emerald-500 shadow-md hover:shadow-lg cursor-pointer transition-all ${selectionRing}`}
        onDoubleClick={handleDoubleClick}
      >
        {handles}
        {textContent}
      </div>
    );
  }

  if (shape === 'process') {
    return (
      <div
        className={`min-w-[140px] max-w-[220px] px-5 py-3 rounded-lg bg-blue-500 shadow-md hover:shadow-lg cursor-pointer transition-all ${selectionRing}`}
        onDoubleClick={handleDoubleClick}
      >
        {handles}
        {textContent}
      </div>
    );
  }

  if (shape === 'decision') {
    return (
      <div
        className={`relative cursor-pointer ${selectionRing ? 'p-1' : ''}`}
        onDoubleClick={handleDoubleClick}
        style={{ width: 140, height: 140 }}
      >
        {handles}
        <div
          className={`absolute inset-0 bg-amber-500 shadow-md hover:shadow-lg transition-all ${selectionRing}`}
          style={{
            transform: 'rotate(45deg)',
            borderRadius: '8px',
            top: '20px',
            left: '20px',
            width: '100px',
            height: '100px',
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="px-2 max-w-[120px]" style={{ pointerEvents: 'auto' }}>
            {textContent}
          </div>
        </div>
      </div>
    );
  }

  if (shape === 'io') {
    return (
      <div
        className={`min-w-[140px] max-w-[220px] px-6 py-3 bg-purple-500 shadow-md hover:shadow-lg cursor-pointer transition-all ${selectionRing}`}
        style={{ transform: 'skewX(-12deg)', borderRadius: '4px' }}
        onDoubleClick={handleDoubleClick}
      >
        {handles}
        <div style={{ transform: 'skewX(12deg)' }}>{textContent}</div>
      </div>
    );
  }

  // Fallback
  return (
    <div
      className={`min-w-[140px] max-w-[220px] px-5 py-3 rounded-lg bg-slate-500 shadow-md cursor-pointer ${selectionRing}`}
      onDoubleClick={handleDoubleClick}
    >
      {handles}
      {textContent}
    </div>
  );
}

export const FlowchartNode = memo(FlowchartNodeComponent);
