export interface MindMapMeta {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MindMapNodeData extends Record<string, unknown> {
  content: string;
  parentId: string | null;
  tags?: string[];
}

export interface MapData {
  mapId: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

export interface SerializedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: MindMapNodeData;
}

export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface HistoryEntry {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}
