export interface MindMapMeta {
  id: string;
  name: string;
  type: 'mindmap' | 'flowchart';
  createdAt: Date;
  updatedAt: Date;
}

export interface MindMapNodeData extends Record<string, unknown> {
  content: string;
  parentId: string | null;
  tags?: string[];
  dueDate?: string | null;  // ISO date string "YYYY-MM-DD"
  customColor?: string;     // hex color for custom node bg
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

export interface FlowchartNodeData extends Record<string, unknown> {
  content: string;
  shape: 'start-end' | 'process' | 'decision' | 'io';
}

export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: string;
  label?: string;
}

export interface HistoryEntry {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}
