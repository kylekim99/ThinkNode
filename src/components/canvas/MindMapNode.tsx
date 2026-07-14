import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { differenceInDays, parseISO, isToday, isPast, format } from 'date-fns';
import type { MindMapNodeData } from '../../types/mindmap';
import { useMapStore } from '../../store/useMapStore';
import { useThemeStore, colorfulBorders } from '../../store/useThemeStore';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// CustomNodeResizer는 임시 비활성화 상태 (Boss msg 3048). 재활성화 시 아래 주석 해제
// import { CustomNodeResizer } from './CustomNodeResizer';

type MindMapNodeProps = NodeProps & { data: MindMapNodeData };

function MindMapNodeComponent({ id, data, selected }: MindMapNodeProps) {
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const updateNodeContent = useMapStore((s) => s.updateNodeContent);
  const selectNode = useMapStore((s) => s.selectNode);
  // 레이아웃 방향에 따라 필요한 Handle만 렌더 → 8개 → 2개 축소 (엣지 흔들림 해소)
  const layoutDirection = useMapStore((s) => s.layoutDirection);
  // 노드 리사이즈: CustomNodeResizer가 store 액션을 직접 호출하므로 여기서는 selector 불필요.
  // (기존 snapshotForResize/resizeNodeLive는 store에 남아 있으나 이 컴포넌트에서 참조하지 않음)
  // 편집 종료 직후 전역 keydown 리스너가 같은 Enter 이벤트로 새 노드를 만드는
  // double-trigger를 막기 위한 타임스탬프 갱신 액션
  const markCommit = useMapStore((s) => s.markCommit);

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
    // 커밋 순간 타임스탬프를 기록 → 곧바로 이어지는 global keydown Enter가 새 노드 생성을 skip
    markCommit();
    setEditingNode(null);
    // Return focus to the canvas so global keyboard shortcuts (Enter for sibling) work immediately
    requestAnimationFrame(() => {
      const pane = document.querySelector('.react-flow__pane') as HTMLElement;
      pane?.focus();
    });
  }, [editValue, data.content, id, updateNodeContent, setEditingNode, markCommit]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id);
    setEditingNode(id);
  }, [id, selectNode, setEditingNode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // IME 조합 중 Enter는 조합 확정 전용 → 편집 종료·전파 방지 로직을 건너뜀
      if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // React SyntheticEvent 전파 + 네이티브 이벤트 전파(window listener까지) 모두 차단
        // ↳ 이 두 줄이 없으면 native bubble이 window에 도달하여 useKeyboardShortcuts가 새 노드 생성 (double-trigger 버그의 primary 원인)
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        commitEdit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        setEditingNode(null);
        return;
      }
      // 그 외 키(백스페이스/Del/방향키 등)는 native 기본 동작(텍스트 편집)만 허용
      // 전역 노드 shortcut으로 전파되지 않도록 native 전파도 명시적으로 중단
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
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

  // 사용자 저장 크기가 있으면 inner div에 명시적 픽셀 width/height 적용 (React Flow wrapper가 이 child를 측정 → 동일 크기)
  // 저장된 사이즈 없으면 CSS `min-w-[120px] max-w-[260px]`로 content-sized 초기 상태
  // ↳ 이전 v0.3의 width:100%는 wrapper 크기 확보가 상황에 따라 unstable해서 explicit px로 회귀 (msg 3032 fix)
  const hasCustomSize = data.width != null && data.height != null;
  const sizeStyle = hasCustomSize
    ? { width: data.width, height: data.height }
    : {};

  return (
    <div
      className={
        hasCustomSize
          ? 'px-4 py-2 rounded-lg border-2 transition-all duration-150 hover:shadow-lg cursor-pointer flex items-center justify-center'
          : 'min-w-[120px] max-w-[260px] px-4 py-2 rounded-lg border-2 transition-all duration-150 hover:shadow-lg cursor-pointer'
      }
      style={{
        ...sizeStyle,
        // CustomNodeResizer의 absolute handle들이 이 요소를 기준으로 배치되도록 position: relative
        position: 'relative',
        backgroundColor: nodeStyle.backgroundColor,
        borderColor: nodeStyle.borderColor,
        boxShadow: selected ? `0 10px 15px -3px ${nodeStyle.borderColor}33` : '0 4px 6px -1px rgba(0,0,0,0.1)',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* 노드 리사이즈 임시 비활성화 (Boss msg 3048, 2026-07-14)
       * 4차례 fix에도 근본 해결 실패 → workaround로 UI 자체 렌더 중지.
       * CustomNodeResizer.tsx 파일과 useMapStore의 관련 액션은 그대로 보존 →
       * Friday 직접 진단 or 대체 접근(react-resizable 등) 후 재활성화 시 이 주석 제거만 하면 됨.
       * 기존 저장된 data.width/height 는 IndexedDB에 그대로 유지 → 재활성화 시 즉시 복구 가능.
       */}
      {/*
      <CustomNodeResizer
        nodeId={id}
        visible={selected}
        minWidth={120}
        minHeight={40}
      />
      */}
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
