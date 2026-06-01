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
    type: e.type || 'smoothstep',
    label: typeof e.label === 'string' ? e.label : undefined,
  }));
}

function deserializeNodes(nodes: SerializedNode[]): Node<MindMapNodeData>[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type || 'mindMapNode',
    position: { ...n.position },
    data: { ...n.data },
  }));
}

function deserializeEdges(edges: SerializedEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    type: e.type || 'smoothstep',
    ...(e.label ? { label: e.label } : {}),
  }));
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

      // 사용자 지정 핸들이 없으면 레이아웃 방향에 따라 자동 결정
      if (!sourceHandle || !targetHandle) {
        const dir = layoutDir || 'vertical';
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
        type: 'smoothstep',
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
  layoutDirection: 'vertical' as LayoutDirection,
  past: [],
  future: [],
  dirty: false,

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

    // 현재 레이아웃 방향에 맞춰 자동 정렬
    const serialized = serializeNodes(newNodes);
    const positions = computeLayout(serialized, state.layoutDirection);
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

    // 현재 레이아웃 방향에 맞춰 자동 정렬
    const serialized = serializeNodes(newNodes);
    const positions = computeLayout(serialized, state.layoutDirection);
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

  selectNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
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
    const positions = computeLayout(serialized, dir);
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
