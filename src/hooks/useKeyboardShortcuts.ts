import { useEffect } from 'react';
import type { Node } from '@xyflow/react';
import { useMapStore } from '../store/useMapStore';
import { useTagStore } from '../store/useTagStore';
import type { MindMapNodeData } from '../types/mindmap';

// 입력 요소(input/textarea/contenteditable)에 포커스가 있는지 확인
// 검색 오버레이·다른 폼 입력 중 방향키·엔터가 노드 네비게이션으로 흡수되는 것을 방지
function isTypingInInput(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}

// 부모 노드 조회
function findParent(nodeId: string, nodes: Node<MindMapNodeData>[]): Node<MindMapNodeData> | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node?.data.parentId) return null;
  return nodes.find((n) => n.id === node.data.parentId) ?? null;
}

// 형제 노드 조회 (같은 parentId 공유) — 지정 축 기준 오름차순 정렬
function findSiblingsSorted(
  nodeId: string,
  nodes: Node<MindMapNodeData>[],
  axis: 'x' | 'y',
): Node<MindMapNodeData>[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const parentId = node.data.parentId;
  return nodes
    .filter((n) => n.data.parentId === parentId && n.type !== 'flowchartNode')
    .sort((a, b) => a.position[axis] - b.position[axis]);
}

// 자식 노드 조회 — 지정 축 기준 오름차순 정렬
function findChildrenSorted(
  nodeId: string,
  nodes: Node<MindMapNodeData>[],
  axis: 'x' | 'y',
): Node<MindMapNodeData>[] {
  return nodes
    .filter((n) => n.data.parentId === nodeId && n.type !== 'flowchartNode')
    .sort((a, b) => a.position[axis] - b.position[axis]);
}

// 자식이 여러 개인 경우 중앙 자식 선택 (사용자 직관에 가장 가까움)
function pickMiddle<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(arr.length / 2)];
}

export function useKeyboardShortcuts() {
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const nodes = useMapStore((s) => s.nodes);
  const layoutDirection = useMapStore((s) => s.layoutDirection);
  const addNode = useMapStore((s) => s.addNode);
  const addSibling = useMapStore((s) => s.addSibling);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const selectNode = useMapStore((s) => s.selectNode);
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const applyLayout = useMapStore((s) => s.applyLayout);
  const setSearchOverlayOpen = useTagStore((s) => s.setSearchOverlayOpen);
  const searchOverlayOpen = useTagStore((s) => s.searchOverlayOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // IME(한글) 조합 중이면 모든 단축키 skip — 한국어 입력 안정성 확보
      if (e.isComposing || e.keyCode === 229) return;

      // Ctrl/Cmd+F: 검색 오버레이 토글 (입력 요소 focus 여부 무관)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOverlayOpen(!searchOverlayOpen);
        return;
      }

      // Ctrl/Cmd+L: 자동 레이아웃
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        applyLayout();
        return;
      }

      // 편집 모드거나 다른 입력 요소에 focus가 있으면 노드 단축키 skip
      // (MindMapNode의 input이 Enter/Escape를 자체 처리 · 방향키는 텍스트 커서 이동)
      if (editingNodeId || isTypingInInput()) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if (!selectedNodeId) return;

      // Tab: 자식 노드 생성 (기존 유지)
      if (e.key === 'Tab') {
        e.preventDefault();
        addNode(selectedNodeId);
        return;
      }

      // 방향키: 노드 포커스 이동 (Boss msg 3012 신규 요구)
      // 레이아웃 방향에 따라 계층/형제 축이 다름:
      //   horizontal-lr : 좌=상위, 우=하위, 위=이전 형제, 아래=다음 형제
      //   horizontal-rl : 우=상위, 좌=하위, 위=이전 형제, 아래=다음 형제
      //   vertical      : 위=상위, 아래=하위, 좌=이전 형제, 우=다음 형제
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        const dir = layoutDirection;
        const isHorizontal = dir === 'horizontal-lr' || dir === 'horizontal-rl';
        // 수평 레이아웃 → 형제는 y축 정렬 · 수직 레이아웃 → 형제는 x축 정렬
        const siblingAxis: 'x' | 'y' = isHorizontal ? 'y' : 'x';
        // 자식 정렬 축은 형제 축과 동일 (부모 아래 나열된 자식들 사이에서 중앙 선택용)
        const childAxis: 'x' | 'y' = siblingAxis;

        let target: string | null = null;

        if (e.key === 'ArrowLeft') {
          if (dir === 'horizontal-lr') {
            target = findParent(selectedNodeId, nodes)?.id ?? null;
          } else if (dir === 'horizontal-rl') {
            target = pickMiddle(findChildrenSorted(selectedNodeId, nodes, childAxis))?.id ?? null;
          } else {
            const siblings = findSiblingsSorted(selectedNodeId, nodes, siblingAxis);
            const idx = siblings.findIndex((n) => n.id === selectedNodeId);
            target = idx > 0 ? siblings[idx - 1].id : null;
          }
        } else if (e.key === 'ArrowRight') {
          if (dir === 'horizontal-lr') {
            target = pickMiddle(findChildrenSorted(selectedNodeId, nodes, childAxis))?.id ?? null;
          } else if (dir === 'horizontal-rl') {
            target = findParent(selectedNodeId, nodes)?.id ?? null;
          } else {
            const siblings = findSiblingsSorted(selectedNodeId, nodes, siblingAxis);
            const idx = siblings.findIndex((n) => n.id === selectedNodeId);
            target = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null;
          }
        } else if (e.key === 'ArrowUp') {
          if (dir === 'vertical') {
            target = findParent(selectedNodeId, nodes)?.id ?? null;
          } else {
            const siblings = findSiblingsSorted(selectedNodeId, nodes, siblingAxis);
            const idx = siblings.findIndex((n) => n.id === selectedNodeId);
            target = idx > 0 ? siblings[idx - 1].id : null;
          }
        } else if (e.key === 'ArrowDown') {
          if (dir === 'vertical') {
            target = pickMiddle(findChildrenSorted(selectedNodeId, nodes, childAxis))?.id ?? null;
          } else {
            const siblings = findSiblingsSorted(selectedNodeId, nodes, siblingAxis);
            const idx = siblings.findIndex((n) => n.id === selectedNodeId);
            target = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null;
          }
        }

        if (target && target !== selectedNodeId) {
          e.preventDefault();
          selectNode(target);
        }
        // 이동 대상이 없으면 preventDefault도 하지 않음 → 페이지 스크롤 등 기본 동작 허용
        return;
      }

      // Enter: 새 노드 생성 + 편집 모드 진입
      // 상태 머신 (Boss msg 3012):
      //   선택(편집 X) → Enter → 새 노드 생성 + 편집 모드 진입
      //   편집 중 → Enter → MindMapNode의 input이 자체 처리 (commitEdit → 편집 종료)
      //   위 두 상태가 반복되면 Enter 반복만으로 형제 노드 계속 생성 가능
      // Root 노드에서는 형제가 불가 → 자식(addNode) 생성으로 폴백
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selectedNode = nodes.find((n) => n.id === selectedNodeId);
        if (selectedNode && !selectedNode.data.parentId) {
          addNode(selectedNodeId);
        } else {
          addSibling(selectedNodeId);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(selectedNodeId);
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        setEditingNode(selectedNodeId);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    editingNodeId,
    nodes,
    layoutDirection,
    addNode,
    addSibling,
    deleteNode,
    setEditingNode,
    selectNode,
    undo,
    redo,
    applyLayout,
    setSearchOverlayOpen,
    searchOverlayOpen,
  ]);
}
