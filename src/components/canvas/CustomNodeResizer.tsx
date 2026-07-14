import { memo, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useMapStore } from '../../store/useMapStore';

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface CustomNodeResizerProps {
  nodeId: string;
  visible: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface DragState {
  startMouseX: number;
  startMouseY: number;
  corner: ResizeCorner;
  zoom: number;
}

/**
 * 커스텀 NodeResizer — @xyflow/react 내장 NodeResizer 완전 대체 (Boss msg 3040, 폐기 후 재구현).
 *
 * 재구현 이유: 이전 3차례 fix에도 wrapper만 커지고 실제 노드가 반응하지 않는 증상 지속.
 * 원인 가설(내장 NodeResizer의 이중 사이징 시스템, 콜백 params, 클로저 timing)이
 * 확실히 짚이지 않아 접근 방식 자체를 폐기 후 mouse event 직접 처리 방식으로 재구현.
 *
 * 아키텍처:
 *  - 4모서리(nw·ne·sw·se) handle을 absolute position으로 렌더
 *  - mousedown 시 부모(inner div)의 offsetWidth/offsetHeight로 world 크기 측정
 *      (React Flow는 zoom을 transform으로 처리 → offsetWidth = layout 크기 = world 크기)
 *  - document 레벨 mousemove/mouseup 리스너 → 드래그 중 handle 밖으로 나가도 추적 유지
 *  - 리사이즈 상태(startPos, startW, startH)는 useMapStore의 resizeContext에서 관리
 *      → CustomNodeResizer는 delta만 store에 전달, 계산·클램프·position offset은 store에서 일괄 처리
 *  - onResize 콜백마다 히스토리 push 없음 (beginCustomResize에서 스냅샷 1회 → 1드래그당 Undo 1회)
 */
function CustomNodeResizerBase({
  nodeId,
  visible,
  minWidth = 120,
  minHeight = 40,
  maxWidth = 1600,
  maxHeight = 900,
}: CustomNodeResizerProps) {
  const { getZoom } = useReactFlow();
  const beginResize = useMapStore((s) => s.beginCustomResize);
  const updateResize = useMapStore((s) => s.updateCustomResize);
  const endResize = useMapStore((s) => s.endCustomResize);
  const dragRef = useRef<DragState | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, corner: ResizeCorner) => {
      // React Flow의 pane drag / selection과 충돌 방지
      e.preventDefault();
      e.stopPropagation();

      const handleEl = e.currentTarget as HTMLElement;
      // 부모(MindMapNode inner div)의 layout 크기가 world 크기
      const parent = handleEl.parentElement;
      if (!parent) return;

      const startW = parent.offsetWidth;
      const startH = parent.offsetHeight;

      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        corner,
        zoom: getZoom() || 1,
      };

      beginResize(nodeId, startW, startH);

      const onMove = (mv: MouseEvent) => {
        const s = dragRef.current;
        if (!s) return;
        // screen delta → world delta (zoom 반영)
        const worldDx = (mv.clientX - s.startMouseX) / s.zoom;
        const worldDy = (mv.clientY - s.startMouseY) / s.zoom;
        updateResize(worldDx, worldDy, s.corner, minWidth, minHeight, maxWidth, maxHeight);
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        endResize();
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [nodeId, getZoom, beginResize, updateResize, endResize, minWidth, minHeight, maxWidth, maxHeight],
  );

  if (!visible) return null;

  const handleBase: React.CSSProperties = {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#3b82f6',
    border: '2px solid #ffffff',
    borderRadius: 3,
    zIndex: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  };

  return (
    <>
      <div
        role="button"
        aria-label="Resize top-left"
        style={{ ...handleBase, top: -8, left: -8, cursor: 'nwse-resize' }}
        onMouseDown={(e) => handleMouseDown(e, 'nw')}
      />
      <div
        role="button"
        aria-label="Resize top-right"
        style={{ ...handleBase, top: -8, right: -8, cursor: 'nesw-resize' }}
        onMouseDown={(e) => handleMouseDown(e, 'ne')}
      />
      <div
        role="button"
        aria-label="Resize bottom-left"
        style={{ ...handleBase, bottom: -8, left: -8, cursor: 'nesw-resize' }}
        onMouseDown={(e) => handleMouseDown(e, 'sw')}
      />
      <div
        role="button"
        aria-label="Resize bottom-right"
        style={{ ...handleBase, bottom: -8, right: -8, cursor: 'nwse-resize' }}
        onMouseDown={(e) => handleMouseDown(e, 'se')}
      />
    </>
  );
}

export const CustomNodeResizer = memo(CustomNodeResizerBase);
