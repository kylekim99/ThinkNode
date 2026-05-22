import type { SerializedNode } from '../types/mindmap';

// Node dimensions — generous to prevent overlap even with tags/long text
const NODE_WIDTH = 220;  // accounts for max-w-[260px] nodes + margin
const H_GAP = 50;        // horizontal gap between sibling subtree edges
const V_GAP = 110;       // vertical gap between levels (room for tag badges)
const NODE_HEIGHT = 60;  // estimated node height for overlap checks

interface TreeNode {
  id: string;
  children: TreeNode[];
  subtreeWidth: number;
  x: number;
  y: number;
}

function buildTree(nodes: SerializedNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const childMap = new Map<string, string[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, { id: n.id, children: [], subtreeWidth: 0, x: 0, y: 0 });
    const parentId = n.data.parentId;
    if (parentId) {
      if (!childMap.has(parentId)) childMap.set(parentId, []);
      childMap.get(parentId)!.push(n.id);
    }
  }

  for (const [parentId, childIds] of childMap) {
    const parent = nodeMap.get(parentId);
    if (parent) {
      parent.children = childIds.map((id) => nodeMap.get(id)!).filter(Boolean);
    }
  }

  const roots: TreeNode[] = [];
  for (const n of nodes) {
    if (!n.data.parentId) {
      const treeNode = nodeMap.get(n.id);
      if (treeNode) roots.push(treeNode);
    }
  }

  return roots;
}

/**
 * Calculate the width needed for the entire subtree rooted at this node.
 * Leaf nodes need NODE_WIDTH. Parent nodes need enough space for all children + gaps.
 * The parent node itself also needs at least NODE_WIDTH, so we take the max.
 */
function calcSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) {
    node.subtreeWidth = NODE_WIDTH;
    return NODE_WIDTH;
  }

  let childrenTotalWidth = 0;
  for (const child of node.children) {
    childrenTotalWidth += calcSubtreeWidth(child);
  }
  // Add gaps between children
  childrenTotalWidth += (node.children.length - 1) * H_GAP;

  // Subtree must be at least as wide as the node itself
  node.subtreeWidth = Math.max(NODE_WIDTH, childrenTotalWidth);
  return node.subtreeWidth;
}

/**
 * Assign x,y positions top-down. Parent is centered over its children.
 * Children are spread horizontally with their subtree widths + gaps.
 */
function assignPositions(node: TreeNode, centerX: number, y: number): void {
  node.x = centerX;
  node.y = y;

  if (node.children.length === 0) return;

  // Total width needed for all children
  const totalChildrenWidth =
    node.children.reduce((sum, c) => sum + c.subtreeWidth, 0) +
    (node.children.length - 1) * H_GAP;

  // Start from the left edge of the children block
  let currentLeft = centerX - totalChildrenWidth / 2;

  for (const child of node.children) {
    const childCenterX = currentLeft + child.subtreeWidth / 2;
    assignPositions(child, childCenterX, y + V_GAP);
    currentLeft += child.subtreeWidth + H_GAP;
  }
}

function collectPositions(node: TreeNode, result: Map<string, { x: number; y: number }>): void {
  result.set(node.id, { x: node.x, y: node.y });
  for (const child of node.children) {
    collectPositions(child, result);
  }
}

/**
 * Post-process: verify no two nodes on the same level overlap.
 * If overlap detected, push nodes apart.
 */
function resolveOverlaps(positions: Map<string, { x: number; y: number }>): void {
  // Group nodes by y-level
  const levels = new Map<number, { id: string; x: number }[]>();
  for (const [id, pos] of positions) {
    const roundedY = Math.round(pos.y);
    if (!levels.has(roundedY)) levels.set(roundedY, []);
    levels.get(roundedY)!.push({ id, x: pos.x });
  }

  // For each level, sort by x and fix overlaps
  for (const [, nodesOnLevel] of levels) {
    if (nodesOnLevel.length < 2) continue;
    nodesOnLevel.sort((a, b) => a.x - b.x);

    const minDistance = NODE_WIDTH + H_GAP / 2;
    for (let i = 1; i < nodesOnLevel.length; i++) {
      const prev = nodesOnLevel[i - 1];
      const curr = nodesOnLevel[i];
      const distance = curr.x - prev.x;
      if (distance < minDistance) {
        const shift = minDistance - distance;
        // Push current and all subsequent nodes to the right
        for (let j = i; j < nodesOnLevel.length; j++) {
          nodesOnLevel[j].x += shift;
          positions.get(nodesOnLevel[j].id)!.x += shift;
        }
      }
    }
  }
}

export function computeLayout(nodes: SerializedNode[]): Map<string, { x: number; y: number }> {
  const roots = buildTree(nodes);
  const positions = new Map<string, { x: number; y: number }>();

  let offsetX = 0;
  for (const root of roots) {
    calcSubtreeWidth(root);
    assignPositions(root, offsetX + root.subtreeWidth / 2, 0);
    collectPositions(root, positions);
    offsetX += root.subtreeWidth + H_GAP;
  }

  // Safety net: resolve any remaining overlaps
  resolveOverlaps(positions);

  return positions;
}

export { NODE_WIDTH, NODE_HEIGHT, H_GAP, V_GAP };
