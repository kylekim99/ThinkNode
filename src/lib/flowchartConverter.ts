import { nanoid } from 'nanoid';
import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { MindMapNodeData, FlowchartNodeData } from '../types/mindmap';

const V_GAP = 160;
const H_GAP = 200;

interface ConversionResult {
  nodes: Node<MindMapNodeData>[];
  edges: Edge[];
}

/**
 * Converts mindmap nodes (with parentId relationships) into flowchart nodes and edges.
 *
 * Mapping rules:
 * - Root node -> start-end shape
 * - Nodes with 2+ children -> decision shape
 * - Nodes with 1 child -> process shape
 * - Leaf nodes -> process shape
 */
export function convertMindmapToFlowchart(
  mindmapNodes: Node<MindMapNodeData>[],
  mindmapEdges: Edge[]
): ConversionResult {
  if (mindmapNodes.length < 2) {
    throw new Error('At least 2 nodes are required to convert to a flowchart');
  }

  // Build parent-children map
  const childrenMap = new Map<string, string[]>();
  for (const node of mindmapNodes) {
    const parentId = node.data.parentId;
    if (parentId) {
      const existing = childrenMap.get(parentId) || [];
      existing.push(node.id);
      childrenMap.set(parentId, existing);
    }
  }

  // Find root(s)
  const roots = mindmapNodes.filter((n) => !n.data.parentId);

  // Determine shape for each node
  function getShape(nodeId: string, isRoot: boolean): FlowchartNodeData['shape'] {
    if (isRoot) return 'start-end';
    const children = childrenMap.get(nodeId) || [];
    if (children.length >= 2) return 'decision';
    return 'process';
  }

  // Map old node IDs to new node IDs
  const idMap = new Map<string, string>();
  const flowchartNodes: Node<MindMapNodeData>[] = [];
  const flowchartEdges: Edge[] = [];

  // Position nodes in a top-down layout using BFS
  const visited = new Set<string>();
  const queue: { id: string; depth: number; siblingIndex: number; siblingCount: number }[] = [];

  for (const root of roots) {
    queue.push({ id: root.id, depth: 0, siblingIndex: 0, siblingCount: 1 });
  }

  // First pass: determine depth and horizontal positions
  const nodeDepths = new Map<string, number>();
  const depthNodes = new Map<number, string[]>();

  const bfsQueue = [...queue];
  while (bfsQueue.length > 0) {
    const { id, depth } = bfsQueue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    nodeDepths.set(id, depth);
    const existing = depthNodes.get(depth) || [];
    existing.push(id);
    depthNodes.set(depth, existing);

    const children = childrenMap.get(id) || [];
    for (const childId of children) {
      bfsQueue.push({ id: childId, depth: depth + 1, siblingIndex: 0, siblingCount: children.length });
    }
  }

  // Assign positions
  for (const [depth, nodeIds] of depthNodes) {
    const y = depth * V_GAP;
    const totalWidth = (nodeIds.length - 1) * H_GAP;
    const startX = -totalWidth / 2;

    for (let i = 0; i < nodeIds.length; i++) {
      const oldId = nodeIds[i];
      const newId = nanoid();
      idMap.set(oldId, newId);

      const originalNode = mindmapNodes.find((n) => n.id === oldId)!;
      const isRoot = roots.some((r) => r.id === oldId);
      const shape = getShape(oldId, isRoot);

      flowchartNodes.push({
        id: newId,
        type: 'flowchartNode',
        position: { x: startX + i * H_GAP, y },
        data: {
          content: originalNode.data.content,
          parentId: null,
          shape,
        } as unknown as MindMapNodeData,
      });
    }
  }

  // Create edges
  for (const node of mindmapNodes) {
    if (!node.data.parentId) continue;
    const sourceNewId = idMap.get(node.data.parentId);
    const targetNewId = idMap.get(node.id);
    if (!sourceNewId || !targetNewId) continue;

    // For decision nodes, assign labels based on child index
    const parentChildren = childrenMap.get(node.data.parentId) || [];
    const childIndex = parentChildren.indexOf(node.id);
    const parentIsDecision = parentChildren.length >= 2;

    let label: string | undefined;
    if (parentIsDecision) {
      if (childIndex === 0) label = 'Yes';
      else if (childIndex === 1) label = 'No';
      else label = `Branch ${childIndex + 1}`;
    }

    // Try to find matching edge from mindmap edges
    const edgeId = `e-${sourceNewId}-${targetNewId}`;
    const originalEdge = mindmapEdges.find(
      (e) => e.source === node.data.parentId && e.target === node.id
    );

    flowchartEdges.push({
      id: edgeId,
      source: sourceNewId,
      target: targetNewId,
      type: 'smoothstep',
      animated: true,
      label: label || (typeof originalEdge?.label === 'string' ? originalEdge.label : undefined),
      style: { stroke: '#64748b', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    });
  }

  return {
    nodes: flowchartNodes,
    edges: flowchartEdges,
  };
}
