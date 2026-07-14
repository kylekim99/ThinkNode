import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { MindMapMeta, MindMapNodeData, FlowchartNodeData, HistoryEntry, SerializedNode, SerializedEdge } from '../types/mindmap';
import { getAllMaps, createMap as dbCreateMap, updateMapMeta, deleteMapFromDB, getMapData, saveMapData } from '../db/database';
import { computeLayout, type LayoutDirection } from '../lib/layoutEngine';
import { parseTags } from '../lib/tagParser';
import { exportMapToJSON, parseImportFile } from '../lib/exportImport';
import { useTagStore } from './useTagStore';

function serializeNodes(nodes: Node<MindMapNodeData>[]): SerializedNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type || 'mindMapNode',
    position: { ...n.position },
    data: { ...n.data },
  }));
}

function serializeEdges(edges: Edge[]): SerializedEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    // step: L자 직각 엣지 (기본). 저장된 smoothstep도 유효 (하위 호환)
    type: e.type || 'step',
    label: typeof e.label === 'string' ? e.label : undefined,
  }));
}

function deserializeNodes(nodes: SerializedNode[]): Node<MindMapNodeData>[] {
  return nodes.map((n) => {
    const node: Node<MindMapNodeData> = {
      id: n.id,
      type: n.type || 'mindMapNode',
      position: { ...n.position },
      data: { ...n.data },
    };
    // 사용자 저장 리사이즈 크기가 있으면 React Flow wrapper 크기도 함께 복원
    // ↳ 그래야 wrapper 사이즈가 확보되어 inner div의 width:100% 채움이 시각적으로 정확
    const savedW = (n.data as { width?: number }).width;
    const savedH = (n.data as { height?: number }).height;
    if (typeof savedW === 'number' && typeof savedH === 'number') {
      node.width = savedW;
      node.height = savedH;
    }
    return node;
  });
}

function deserializeEdges(edges: SerializedEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    // 하위 호환: 기존 smoothstep 저장분도 그대로 로드 가능
    type: e.type || 'step',
    ...(e.label ? { label: e.label } : {}),
  }));
}

// React Flow가 렌더 후 측정한 실제 DOM 크기(Node.width/height)를 layoutEngine에 넘길 수 있도록 Map으로 추출.
// data.width/height(사용자 저장 리사이즈 값)가 우선이므로 여기서는 fallback 용도.
function collectMeasuredSizes(nodes: Node<MindMapNodeData>[]): Map<string, { width: number; height: number }> {
  const map = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    // React Flow Node 타입에는 width/height가 optional로 존재 (측정 완료 후 채워짐)
    const w = (n as { width?: number | null }).width;
    const h = (n as { height?: number | null }).height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
      map.set(n.id, { width: w, height: h });
    }
  }
  return map;
}

function edgesFromNodes(nodes: Node<MindMapNodeData>[], layoutDir?: LayoutDirection): Edge[] {
  const edges: Edge[] = [];
  for (const node of nodes) {
    if (node.data.parentId) {
      // 사용자가 직접 연결한 핸들 정보가 있으면 우선 사용
      const sh = (node.data as Record<string, unknown>)._sourceHandle as string | undefined;
      const th = (node.data as Record<string, unknown>)._targetHandle as string | undefined;

      let sourceHandle = sh;
      let targetHandle = th;

      // 사용자 지정 핸들이 없으면 레이아웃 방향에 따라 자동 결정 (default: horizontal-lr)
      if (!sourceHandle || !targetHandle) {
        const dir = layoutDir || 'horizontal-lr';
        if (dir === 'vertical') {
          sourceHandle = 'bottom-src';
          targetHandle = 'top';
        } else if (dir === 'horizontal-lr') {
          sourceHandle = 'right-src';
          targetHandle = 'left';
        } else {
          sourceHandle = 'left-src';
          targetHandle = 'right';
        }
      }

      edges.push({
        id: `e-${node.data.parentId}-${node.id}`,
        source: node.data.parentId,
        target: node.id,
        // step 엣지: L자 직각선 (참고이미지 1 스타일)
        type: 'step',
        sourceHandle,
        targetHandle,
      });
    }
  }
  return edges;
}

function getDescendantIds(nodeId: string, nodes: Node<MindMapNodeData>[]): string[] {
  const ids: string[] = [];
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of nodes) {
      if (n.data.parentId === current) {
        ids.push(n.id);
        queue.push(n.id);
      }
    }
  }
  return ids;
}

interface MapStore {
  maps: MindMapMeta[];
  activeMapId: string | null;
  nodes: Node<MindMapNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  selectedEdgeId: string | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  dirty: boolean;
  // 편집 종료(commitEdit) 순간 기록되는 타임스탬프. 전역 Enter 리스너가 200ms 이내면 skip → 편집 종료+새 노드 생성 double-trigger 방지
  lastCommitAt: number;
  markCommit: () => void;

  init: () => Promise<void>;
  createMap: (name: string, type?: 'mindmap' | 'flowchart') => Promise<void>;
  loadMap: (mapId: string) => Promise<void>;
  deleteMap: (mapId: string) => Promise<void>;
  renameMap: (mapId: string, name: string) => Promise<void>;
  addNode: (parentId: string | null, content?: string) => void;
  addSibling: (nodeId: string) => void;
  addFlowchartNode: (shape: FlowchartNodeData['shape'], position: { x: number; y: number }, content?: string) => void;
  updateNodeContent: (nodeId: string, content: string) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newPosition: { x: number; y: number }) => void;
  resizeNode: (nodeId: string, width: number, height: number) => void;
  snapshotForResize: () => void;
  resizeNodeLive: (nodeId: string, width: number, height: number) => void;
  selectNode: (nodeId: string | null) => void;
  setEditingNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  setDueDate: (nodeId: string, date: string | null) => void;
  connectNodes: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void;
  connectFlowchartNodes: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void;
  setNodes: (nodes: Node<MindMapNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  layoutDirection: LayoutDirection;
  applyLayout: (direction?: LayoutDirection) => void;
  setNodeColor: (nodeId: string, color: string | null) => void;
  exportCurrentMap: () => void;
  importMap: (file: File) => Promise<void>;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
  getActiveMapType: () => 'mindmap' | 'flowchart';
}

function pushHistory(state: { past: HistoryEntry[]; nodes: Node<MindMapNodeData>[]; edges: Edge[] }): HistoryEntry[] {
  const entry: HistoryEntry = {
    nodes: serializeNodes(state.nodes),
    edges: serializeEdges(state.edges),
  };
  const newPast = [...state.past, entry];
  if (newPast.length > 50) newPast.shift();
  return newPast;
}

export const useMapStore = create<MapStore>((set, get) => ({
  maps: [],
  activeMapId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  editingNodeId: null,
  selectedEdgeId: null,
  layoutDirection: 'horizontal-lr' as LayoutDirection,
  past: [],
  future: [],
  dirty: false,
  lastCommitAt: 0,

  markCommit: () => set({ lastCommitAt: Date.now() }),

  init: async () => {
    const maps = await getAllMaps();
    // Ensure backward compatibility: maps without type default to 'mindmap'
    const normalizedMaps = maps.map((m) => ({
      ...m,
      type: m.type || 'mindmap',
    })) as MindMapMeta[];
    set({ maps: normalizedMaps });
  },

  getActiveMapType: () => {
    const state = get();
    const activeMap = state.maps.find((m) => m.id === state.activeMapId);
    return activeMap?.type || 'mindmap';
  },

  createMap: async (name: string, type?: 'mindmap' | 'flowchart') => {
    const mapType = type || 'mindmap';
    const id = nanoid();
    const now = new Date();
    const meta: MindMapMeta = { id, name, type: mapType, createdAt: now, updatedAt: now };
    await dbCreateMap(meta);

    let rootNode: Node<MindMapNodeData>;
    if (mapType === 'flowchart') {
      rootNode = {
        id: nanoid(),
        type: 'flowchartNode',
        position: { x: 0, y: 0 },
        data: { content: 'Start', parentId: null, shape: 'start-end' } as unknown as MindMapNodeData,
      };
    } else {
      rootNode = {
        id: nanoid(),
        type: 'mindMapNode',
        position: { x: 0, y: 0 },
        data: { content: name, parentId: null },
      };
    }

    await saveMapData({
      mapId: id,
      nodes: serializeNodes([rootNode]),
      edges: [],
    });

    const maps = await getAllMaps();
    const normalizedMaps = maps.map((m) => ({
      ...m,
      type: m.type || 'mindmap',
    })) as MindMapMeta[];
    set({
      maps: normalizedMaps,
      activeMapId: id,
      nodes: [rootNode],
      edges: [],
      selectedNodeId: rootNode.id,
      editingNodeId: null,
      selectedEdgeId: null,
      past: [],
      future: [],
      dirty: false,
    });
  },

  loadMap: async (mapId: string) => {
    const data = await getMapData(mapId);
    if (data) {
      set({
        activeMapId: mapId,
        nodes: deserializeNodes(data.nodes),
        edges: deserializeEdges(data.edges),
        selectedNodeId: null,
        editingNodeId: null,
        selectedEdgeId: null,
        past: [],
        future: [],
        dirty: false,
      });
    }
  },

  deleteMap: async (mapId: string) => {
    await deleteMapFromDB(mapId);
    const maps = await getAllMaps();
    const normalizedMaps = maps.map((m) => ({
      ...m,
      type: m.type || 'mindmap',
    })) as MindMapMeta[];
    const state = get();
    if (state.activeMapId === mapId) {
      set({ maps: normalizedMaps, activeMapId: null, nodes: [], edges: [], selectedNodeId: null, editingNodeId: null, selectedEdgeId: null, past: [], future: [] });
    } else {
      set({ maps: normalizedMaps });
    }
    // Rebuild tag index so deleted map's tags are removed
    useTagStore.getState().buildTagIndex();
  },

  renameMap: async (mapId: string, name: string) => {
    await updateMapMeta(mapId, { name, updatedAt: new Date() });
    const maps = await getAllMaps();
    const normalizedMaps = maps.map((m) => ({
      ...m,
      type: m.type || 'mindmap',
    })) as MindMapMeta[];
    set({ maps: normalizedMaps });
  },

  addNode: (parentId: string | null, content?: string) => {
    const state = get();
    const newPast = pushHistory(state);
    const newId = nanoid();
    const newNode: Node<MindMapNodeData> = {
      id: newId,
      type: 'mindMapNode',
      position: { x: 0, y: 0 },
      data: { content: content || 'New node', parentId },
    };
    const newNodes = [...state.nodes, newNode];
    const newEdges = edgesFromNodes(newNodes, get().layoutDirection);

    // 현재 레이아웃 방향에 맞춰 자동 정렬 (React Flow 측정 크기 fallback 반영 → 겹침 회피 강화)
    const serialized = serializeNodes(newNodes);
    const measured = collectMeasuredSizes(newNodes);
    const positions = computeLayout(serialized, state.layoutDirection, measured);
    for (const n of newNodes) {
      const pos = positions.get(n.id);
      if (pos) n.position = pos;
    }

    set({
      nodes: [...newNodes],
      edges: newEdges,
      selectedNodeId: newId,
      editingNodeId: newId,
      past: newPast,
      future: [],
      dirty: true,
    });
  },

  addSibling: (nodeId: string) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node || !node.data.parentId) return;

    const newPast = pushHistory(state);
    const newId = nanoid();
    const newNode: Node<MindMapNodeData> = {
      id: newId,
      type: 'mindMapNode',
      position: { x: node.position.x + 200, y: node.position.y },
      data: { content: 'New node', parentId: node.data.parentId },
    };
    const newNodes = [...state.nodes, newNode];
    const newEdges = edgesFromNodes(newNodes, get().layoutDirection);

    // 현재 레이아웃 방향에 맞춰 자동 정렬 (React Flow 측정 크기 fallback 반영 → 겹침 회피 강화)
    const serialized = serializeNodes(newNodes);
    const measured = collectMeasuredSizes(newNodes);
    const positions = computeLayout(serialized, state.layoutDirection, measured);
    for (const n of newNodes) {
      const pos = positions.get(n.id);
      if (pos) n.position = pos;
    }

    set({
      nodes: [...newNodes],
      edges: newEdges,
      selectedNodeId: newId,
      editingNodeId: newId,
      past: newPast,
      future: [],
      dirty: true,
    });
  },

  addFlowchartNode: (shape: FlowchartNodeData['shape'], position: { x: number; y: number }, content?: string) => {
    const state = get();
    const newPast = pushHistory(state);
    const newId = nanoid();

    const defaultContent: Record<FlowchartNodeData['shape'], string> = {
      'start-end': 'Start / End',
      'process': 'Process',
      'decision': 'Decision?',
      'io': 'Input / Output',
    };

    const newNode: Node<MindMapNodeData> = {
      id: newId,
      type: 'flowchartNode',
      position,
      data: {
        content: content || defaultContent[shape],
        parentId: null,
        shape,
      } as unknown as MindMapNodeData,
    };

    set({
      nodes: [...state.nodes, newNode],
      selectedNodeId: newId,
      editingNodeId: newId,
      past: newPast,
      future: [],
      dirty: true,
    });
  },

  updateNodeContent: (nodeId: string, content: string) => {
    const state = get();
    const newPast = pushHistory(state);
    const tags = parseTags(content);
    const newNodes = state.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, content, tags } } : n
    );
    set({ nodes: newNodes, past: newPast, future: [], dirty: true });
  },

  setDueDate: (nodeId: string, date: string | null) => {
    const state = get();
    const newPast = pushHistory(state);
    const newNodes = state.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, dueDate: date } } : n
    );
    set({ nodes: newNodes, past: newPast, future: [], dirty: true });
  },

  deleteNode: (nodeId: string) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const mapType = get().getActiveMapType();
    // For mindmaps, prevent deleting root. For flowcharts, allow deleting any node.
    if (mapType === 'mindmap' && !node.data.parentId) return;

    const newPast = pushHistory(state);

    if (mapType === 'flowchart') {
      // For flowcharts, just remove the single node and any connected edges
      const newNodes = state.nodes.filter((n) => n.id !== nodeId);
      const newEdges = state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      set({
        nodes: newNodes,
        edges: newEdges,
        selectedNodeId: null,
        editingNodeId: null,
        past: newPast,
        future: [],
        dirty: true,
      });
    } else {
      const descendantIds = getDescendantIds(nodeId, state.nodes);
      const idsToRemove = new Set([nodeId, ...descendantIds]);
      const newNodes = state.nodes.filter((n) => !idsToRemove.has(n.id));
      const newEdges = edgesFromNodes(newNodes, get().layoutDirection);

      set({
        nodes: newNodes,
        edges: newEdges,
        selectedNodeId: null,
        editingNodeId: null,
        past: newPast,
        future: [],
        dirty: true,
      });
    }
  },

  connectNodes: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => {
    const state = get();
    // 자기 자신 연결 방지
    if (sourceId === targetId) return;
    const targetNode = state.nodes.find((n) => n.id === targetId);
    if (!targetNode) return;
    // 순환 연결 방지
    let current = state.nodes.find((n) => n.id === sourceId);
    while (current?.data.parentId) {
      if (current.data.parentId === targetId) return;
      current = state.nodes.find((n) => n.id === current!.data.parentId);
    }

    const newPast = pushHistory(state);
    // 노드에 parentId, 연결 핸들 정보 저장
    const newNodes = state.nodes.map((n) =>
      n.id === targetId
        ? { ...n, data: { ...n.data, parentId: sourceId, _sourceHandle: sourceHandle, _targetHandle: targetHandle } }
        : n
    );
    const newEdges = edgesFromNodes(newNodes, get().layoutDirection);

    set({
      nodes: newNodes,
      edges: newEdges,
      past: newPast,
      future: [],
      dirty: true,
    });
  },

  connectFlowchartNodes: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => {
    const state = get();
    if (sourceId === targetId) return;

    // Check if edge already exists between these two nodes
    const existingEdge = state.edges.find(
      (e) => e.source === sourceId && e.target === targetId
    );
    if (existingEdge) return;

    const newPast = pushHistory(state);
    const edgeId = `e-${sourceId}-${targetId}-${nanoid(6)}`;

    // Check if source is a decision node
    const sourceNode = state.nodes.find((n) => n.id === sourceId);
    const isDecision = sourceNode?.data && (sourceNode.data as unknown as FlowchartNodeData).shape === 'decision';

    // Count existing outgoing edges from the source (for decision label defaults)
    const existingOutgoing = state.edges.filter((e) => e.source === sourceId).length;
    let defaultLabel = '';
    if (isDecision) {
      if (existingOutgoing === 0) defaultLabel = 'Yes';
      else if (existingOutgoing === 1) defaultLabel = 'No';
    }

    const newEdge: Edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: sourceHandle || undefined,
      targetHandle: targetHandle || undefined,
      type: 'smoothstep',
      animated: true,
      label: defaultLabel || undefined,
      style: { stroke: '#64748b', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    };

    set({
      edges: [...state.edges, newEdge],
      past: newPast,
      future: [],
      dirty: true,
    });
  },

  selectEdge: (edgeId: string | null) => {
    set({ selectedEdgeId: edgeId });
  },

  updateEdgeLabel: (edgeId: string, label: string) => {
    const state = get();
    const newPast = pushHistory(state);
    const newEdges = state.edges.map((e) =>
      e.id === edgeId ? { ...e, label } : e
    );
    set({ edges: newEdges, past: newPast, future: [], dirty: true });
  },

  moveNode: (nodeId: string, newPosition: { x: number; y: number }) => {
    const state = get();
    const newNodes = state.nodes.map((n) =>
      n.id === nodeId ? { ...n, position: newPosition } : n
    );
    set({ nodes: newNodes, dirty: true });
  },

  resizeNode: (nodeId: string, width: number, height: number) => {
    // 노드 리사이즈 저장 (Undo/Redo 히스토리 포함, IndexedDB에 자동 지속)
    // React Flow wrapper의 width/height도 동시에 반영 → 시각 크기와 wrapper 크기 일치
    const state = get();
    const newPast = pushHistory(state);
    const newNodes = state.nodes.map((n) =>
      n.id === nodeId
        ? { ...n, width, height, data: { ...n.data, width, height } as MindMapNodeData }
        : n
    );
    set({ nodes: newNodes, past: newPast, future: [], dirty: true });
  },

  // 리사이즈 드래그 시작 시 호출 — 현재 상태를 히스토리에 push해 Undo 지점을 확보
  // 이후 onResize에서 라이브 업데이트되는 값은 히스토리에 쌓이지 않음
  snapshotForResize: () => {
    const state = get();
    const newPast = pushHistory(state);
    set({ past: newPast, future: [] });
  },

  // 드래그 중(onResize)에 호출되는 실시간 업데이트 — 히스토리 push 없이
  // data.width/height + node.width/height를 동시에 갱신해 wrapper와 시각 크기 동기화
  resizeNodeLive: (nodeId: string, width: number, height: number) => {
    const state = get();
    const newNodes = state.nodes.map((n) =>
      n.id === nodeId
        ? { ...n, width, height, data: { ...n.data, width, height } as MindMapNodeData }
        : n
    );
    set({ nodes: newNodes, dirty: true });
  },

  selectNode: (nodeId: string | null) => {
    // Zustand selectedNodeId뿐 아니라 React Flow의 nodes[].selected 필드도 함께 동기화
    // ↳ 이 필드가 파란 테두리·화면 focus를 결정하므로 방향키 네비게이션 시 UI 반영 필수 (msg 3032 fix)
    const state = get();
    const newNodes = state.nodes.map((n) => {
      const shouldSelect = n.id === nodeId;
      if ((n.selected ?? false) === shouldSelect) return n;
      return { ...n, selected: shouldSelect };
    });
    set({ selectedNodeId: nodeId, nodes: newNodes });
  },

  setEditingNode: (nodeId: string | null) => {
    set({ editingNodeId: nodeId });
  },

  setNodes: (nodes: Node<MindMapNodeData>[]) => {
    set({ nodes, dirty: true });
  },

  setEdges: (edges: Edge[]) => {
    set({ edges, dirty: true });
  },

  setNodeColor: (nodeId: string, color: string | null) => {
    const state = get();
    const newPast = pushHistory(state);
    const newNodes = state.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const newData = { ...n.data };
      if (color) {
        newData.customColor = color;
      } else {
        delete newData.customColor;
      }
      return { ...n, data: newData };
    });
    set({ nodes: newNodes, past: newPast, future: [], dirty: true });
  },

  exportCurrentMap: () => {
    const state = get();
    if (!state.activeMapId) return;
    const activeMap = state.maps.find((m) => m.id === state.activeMapId);
    if (!activeMap) return;
    exportMapToJSON(
      activeMap,
      serializeNodes(state.nodes),
      serializeEdges(state.edges)
    );
  },

  importMap: async (file: File) => {
    const parsed = await parseImportFile(file);
    const id = nanoid();
    const now = new Date();
    const meta: MindMapMeta = {
      id,
      name: parsed.map.name,
      type: parsed.map.type,
      createdAt: now,
      updatedAt: now,
    };
    await dbCreateMap(meta);
    await saveMapData({
      mapId: id,
      nodes: parsed.map.nodes,
      edges: parsed.map.edges,
    });
    const maps = await getAllMaps();
    const normalizedMaps = maps.map((m) => ({
      ...m,
      type: m.type || 'mindmap',
    })) as MindMapMeta[];
    set({
      maps: normalizedMaps,
      activeMapId: id,
      nodes: deserializeNodes(parsed.map.nodes),
      edges: deserializeEdges(parsed.map.edges),
      selectedNodeId: null,
      editingNodeId: null,
      selectedEdgeId: null,
      past: [],
      future: [],
      dirty: false,
    });
    useTagStore.getState().buildTagIndex();
  },

  applyLayout: (direction?: LayoutDirection) => {
    const state = get();
    const dir = direction || state.layoutDirection;
    const newPast = pushHistory(state);
    const serialized = serializeNodes(state.nodes);
    const measured = collectMeasuredSizes(state.nodes);
    const positions = computeLayout(serialized, dir, measured);
    const newNodes = state.nodes.map((n) => {
      const pos = positions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
    // 레이아웃 방향 변경 시 엣지 핸들도 업데이트
    const newEdges = edgesFromNodes(newNodes, dir);
    set({ nodes: newNodes, edges: newEdges, layoutDirection: dir, past: newPast, future: [], dirty: true });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    const futureEntry: HistoryEntry = {
      nodes: serializeNodes(state.nodes),
      edges: serializeEdges(state.edges),
    };
    set({
      nodes: deserializeNodes(previous.nodes),
      edges: deserializeEdges(previous.edges),
      past: newPast,
      future: [futureEntry, ...state.future],
      dirty: true,
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    const pastEntry: HistoryEntry = {
      nodes: serializeNodes(state.nodes),
      edges: serializeEdges(state.edges),
    };
    set({
      nodes: deserializeNodes(next.nodes),
      edges: deserializeEdges(next.edges),
      past: [...state.past, pastEntry],
      future: newFuture,
      dirty: true,
    });
  },

  saveNow: async () => {
    const state = get();
    if (!state.activeMapId) return;
    await saveMapData({
      mapId: state.activeMapId,
      nodes: serializeNodes(state.nodes),
      edges: serializeEdges(state.edges),
    });
    await updateMapMeta(state.activeMapId, { updatedAt: new Date() });
    set({ dirty: false });
  },
}));
