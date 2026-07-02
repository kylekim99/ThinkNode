import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { differenceInDays, parseISO, isToday, isPast, format } from 'date-fns';
import type { MindMapNodeData } from '../../types/mindmap';
import { useMapStore } from '../../store/useMapStore';
import { useThemeStore, colorfulBorders } from '../../store/useThemeStore';

type MindMapNodeProps = NodeProps & { data: MindMapNodeData };

function MindMapNodeComponent({ id, data, selected }: MindMapNodeProps) {
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const updateNodeContent = useMapStore((s) => s.updateNodeContent);
  const selectNode = useMapStore((s) => s.selectNode);
  // 레이아웃 방향에 따라 필요한 Handle만 렌더 → 8개 → 2개 축소 (엣지 흔들림 해소)
  const layoutDirection = useMapStore((s) => s.layoutDirection);

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
  const theme = useThemeStore((s) => s.theme);
  const themeConfig = useThemeStore((s) => s.getConfig());

  // Determine node colors based on theme and customColor
  const nodeStyle = useMemo(() => {
    const customColor = data.customColor;
    if (customColor) {
      return {
        backgroundColor: customColor,
        borderColor: selected ? themeConfig.node.selectedBorder : customColor,
        color: themeConfig.node.text,
      };
    }
    if (isRoot) {
      return {
        backgroundColor: themeConfig.node.rootBg,
        borderColor: selected ? themeConfig.node.selectedBorder : themeConfig.node.rootBorder,
        color: themeConfig.node.text,
      };
    }
    if (theme === 'colorful') {
      // Use rotating colorful borders based on node id hash
      const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const borderColor = colorfulBorders[hash % colorfulBorders.length];
      return {
        backgroundColor: themeConfig.node.bg,
        borderColor: selected ? themeConfig.node.selectedBorder : borderColor,
        color: themeConfig.node.text,
      };
    }
    return {
      backgroundColor: themeConfig.node.bg,
      borderColor: selected ? themeConfig.node.selectedBorder : themeConfig.node.border,
      color: themeConfig.node.text,
    };
  }, [data.customColor, isRoot, selected, theme, themeConfig, id]);

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
      className="min-w-[120px] max-w-[260px] px-4 py-2 rounded-lg border-2 transition-all duration-150 hover:shadow-lg cursor-pointer"
      style={{
        backgroundColor: nodeStyle.backgroundColor,
        borderColor: nodeStyle.borderColor,
        boxShadow: selected ? `0 10px 15px -3px ${nodeStyle.borderColor}33` : '0 4px 6px -1px rgba(0,0,0,0.1)',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* 레이아웃 방향 기반 handle 렌더링 (2개만 활성 → closest-handle 흔들림 해소) */}
      {layoutDirection === 'vertical' && (
        <>
          <Handle type="target" position={Position.Top} id="top"
            className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
          <Handle type="source" position={Position.Bottom} id="bottom-src"
            className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
        </>
      )}
      {layoutDirection === 'horizontal-lr' && (
        <>
          <Handle type="target" position={Position.Left} id="left"
            className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
          <Handle type="source" position={Position.Right} id="right-src"
            className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
        </>
      )}
      {layoutDirection === 'horizontal-rl' && (
        <>
          <Handle type="target" position={Position.Right} id="right"
            className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
          <Handle type="source" position={Position.Left} id="left-src"
            className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-400 hover:!bg-blue-400 hover:!border-blue-500 !transition-colors" />
        </>
      )}

      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent outline-none text-center text-sm font-medium border-b-2 border-blue-400"
          style={{ color: nodeStyle.color }}
        />
      ) : (
        <div className="text-center text-sm font-medium select-none truncate" style={{ color: nodeStyle.color }}>
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
