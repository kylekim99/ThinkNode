import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Node, Edge } from '@xyflow/react';
import type { MindMapMeta, MindMapNodeData, HistoryEntry, SerializedNode, SerializedEdge } from '../types/mindmap';
import { getAllMaps, createMap as dbCreateMap, updateMapMeta, deleteMapFromDB, getMapData, saveMapData } from '../db/database';
import { computeLayout } from '../lib/layoutEngine';
import { parseTags } from '../lib/tagParser';

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
    type: e.type || 'smoothstep',
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
    type: e.type || 'smoothstep',
  }));
}

function edgesFromNodes(nodes: Node<MindMapNodeData>[]): Edge[] {
  const edges: Edge[] = [];
  for (const node of nodes) {
    if (node.data.parentId) {
      edges.push({
        id: `e-${node.data.parentId}-${node.id}`,
        source: node.data.parentId,
        target: node.id,
        type: 'smoothstep',
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
  past: HistoryEntry[];
  future: HistoryEntry[];
  dirty: boolean;

  init: () => Promise<void>;
  createMap: (name: string) => Promise<void>;
  loadMap: (mapId: string) => Promise<void>;
  deleteMap: (mapId: string) => Promise<void>;
  renameMap: (mapId: string, name: string) => Promise<void>;
  addNode: (parentId: string | null, content?: string) => void;
  addSibling: (nodeId: string) => void;
  updateNodeContent: (nodeId: string, content: string) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newPosition: { x: number; y: number }) => void;
  selectNode: (nodeId: string | null) => void;
  setEditingNode: (nodeId: string | null) => void;
  connectNodes: (sourceId: string, targetId: string) => void;
  setNodes: (nodes: Node<MindMapNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  applyLayout: () => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
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
  past: [],
  future: [],
  dirty: false,

  init: async () => {
    const maps = await getAllMaps();
    set({ maps });
  },

  createMap: async (name: string) => {
    const id = nanoid();
    const now = new Date();
    const meta: MindMapMeta = { id, name, createdAt: now, updatedAt: now };
    await dbCreateMap(meta);

    const rootNode: Node<MindMapNodeData> = {
      id: nanoid(),
      type: 'mindMapNode',
      position: { x: 0, y: 0 },
      data: { content: name, parentId: null },
    };

    await saveMapData({
      mapId: id,
      nodes: serializeNodes([rootNode]),
      edges: [],
    });

    const maps = await getAllMaps();
    set({
      maps,
      activeMapId: id,
      nodes: [rootNode],
      edges: [],
      selectedNodeId: rootNode.id,
      editingNodeId: null,
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
        past: [],
        future: [],
        dirty: false,
      });
    }
  },

  deleteMap: async (mapId: string) => {
    await deleteMapFromDB(mapId);
    const maps = await getAllMaps();
    const state = get();
    if (state.activeMapId === mapId) {
      set({ maps, activeMapId: null, nodes: [], edges: [], selectedNodeId: null, editingNodeId: null, past: [], future: [] });
    } else {
      set({ maps });
    }
  },

  renameMap: async (mapId: string, name: string) => {
    await updateMapMeta(mapId, { name, updatedAt: new Date() });
    const maps = await getAllMaps();
    set({ maps });
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
    const newEdges = edgesFromNodes(newNodes);

    const serialized = serializeNodes(newNodes);
    const positions = computeLayout(serialized);
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
    const newEdges = edgesFromNodes(newNodes);

    const serialized = serializeNodes(newNodes);
    const positions = computeLayout(serialized);
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

  updateNodeContent: (nodeId: string, content: string) => {
    const state = get();
    const newPast = pushHistory(state);
    const tags = parseTags(content);
    const newNodes = state.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, content, tags } } : n
    );
    set({ nodes: newNodes, past: newPast, future: [], dirty: true });
  },

  deleteNode: (nodeId: string) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (!node.data.parentId) return;

    const newPast = pushHistory(state);
    const descendantIds = getDescendantIds(nodeId, state.nodes);
    const idsToRemove = new Set([nodeId, ...descendantIds]);
    const newNodes = state.nodes.filter((n) => !idsToRemove.has(n.id));
    const newEdges = edgesFromNodes(newNodes);

    set({
      nodes: newNodes,
      edges: newEdges,
      selectedNodeId: null,
      editingNodeId: null,
      past: newPast,
      future: [],
      dirty: true,
    });
  },

  connectNodes: (sourceId: string, targetId: string) => {
    const state = get();
    // Prevent self-connection
    if (sourceId === targetId) return;
    // Prevent connecting to a node that already has a parent (would create multi-parent)
    const targetNode = state.nodes.find((n) => n.id === targetId);
    if (!targetNode) return;
    // Prevent circular connection (target is ancestor of source)
    const sourceAncestors = new Set<string>();
    let current = state.nodes.find((n) => n.id === sourceId);
    while (current?.data.parentId) {
      if (current.data.parentId === targetId) return; // would create cycle
      sourceAncestors.add(current.data.parentId);
      current = state.nodes.find((n) => n.id === current!.data.parentId);
    }

    const newPast = pushHistory(state);
    const newNodes = state.nodes.map((n) =>
      n.id === targetId ? { ...n, data: { ...n.data, parentId: sourceId } } : n
    );
    const newEdges = edgesFromNodes(newNodes);

    set({
      nodes: newNodes,
      edges: newEdges,
      past: newPast,
      future: [],
      dirty: true,
    });
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

  applyLayout: () => {
    const state = get();
    const newPast = pushHistory(state);
    const serialized = serializeNodes(state.nodes);
    const positions = computeLayout(serialized);
    const newNodes = state.nodes.map((n) => {
      const pos = positions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
    set({ nodes: newNodes, past: newPast, future: [], dirty: true });
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
