import type { MindMapMeta, SerializedNode, SerializedEdge } from '../types/mindmap';

interface ExportedMap {
  version: string;
  app: string;
  exportedAt: string;
  map: {
    name: string;
    type: 'mindmap' | 'flowchart';
    nodes: SerializedNode[];
    edges: SerializedEdge[];
  };
}

export function exportMapToJSON(
  meta: MindMapMeta,
  nodes: SerializedNode[],
  edges: SerializedEdge[]
): void {
  const data: ExportedMap = {
    version: '1.0',
    app: 'ThinkNode',
    exportedAt: new Date().toISOString(),
    map: {
      name: meta.name,
      type: meta.type,
      nodes,
      edges,
    },
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${meta.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.thinknode.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseImportFile(file: File): Promise<ExportedMap> {
  const text = await file.text();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file. Could not parse the file contents.');
  }

  // Validate structure
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid file format. Expected a JSON object.');
  }

  const obj = data as Record<string, unknown>;

  if (obj.app !== 'ThinkNode') {
    throw new Error('This file was not exported from ThinkNode.');
  }

  if (typeof obj.version !== 'string') {
    throw new Error('Missing version field in the exported file.');
  }

  if (typeof obj.map !== 'object' || obj.map === null) {
    throw new Error('Missing map data in the exported file.');
  }

  const map = obj.map as Record<string, unknown>;

  if (typeof map.name !== 'string' || !map.name.trim()) {
    throw new Error('Invalid or missing map name.');
  }

  if (map.type !== 'mindmap' && map.type !== 'flowchart') {
    throw new Error('Invalid map type. Must be "mindmap" or "flowchart".');
  }

  if (!Array.isArray(map.nodes)) {
    throw new Error('Invalid or missing nodes array.');
  }

  if (!Array.isArray(map.edges)) {
    throw new Error('Invalid or missing edges array.');
  }

  // Validate each node has required fields
  for (const node of map.nodes) {
    if (typeof node !== 'object' || node === null) {
      throw new Error('Invalid node format.');
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string') throw new Error('Node missing id field.');
    if (typeof n.type !== 'string') throw new Error('Node missing type field.');
    if (typeof n.position !== 'object' || n.position === null) throw new Error('Node missing position field.');
    if (typeof n.data !== 'object' || n.data === null) throw new Error('Node missing data field.');
  }

  // Validate each edge has required fields
  for (const edge of map.edges) {
    if (typeof edge !== 'object' || edge === null) {
      throw new Error('Invalid edge format.');
    }
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== 'string') throw new Error('Edge missing id field.');
    if (typeof e.source !== 'string') throw new Error('Edge missing source field.');
    if (typeof e.target !== 'string') throw new Error('Edge missing target field.');
  }

  return data as ExportedMap;
}
