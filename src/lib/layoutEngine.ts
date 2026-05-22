import type { SerializedNode } from '../types/mindmap';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const H_GAP = 50;
const V_GAP = 110;

export type LayoutDirection = 'vertical' | 'horizontal-lr' | 'horizontal-rl';

interface TreeNode {
  id: string;
  children: TreeNode[];
  subtreeSpan: number; // width for vertical, height for horizontal
  x: number;
  y: number;
}

function buildTree(nodes: SerializedNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const childMap = new Map<string, string[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, { id: n.id, children: [], subtreeSpan: 0, x: 0, y: 0 });
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

// --- Vertical layout (top → bottom) ---

function calcSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) {
    node.subtreeSpan = NODE_WIDTH;
    return NODE_WIDTH;
  }
  let total = 0;
  for (const child of node.children) {
    total += calcSubtreeWidth(child);
  }
  total += (node.children.length - 1) * H_GAP;
  node.subtreeSpan = Math.max(NODE_WIDTH, total);
  return node.subtreeSpan;
}

function assignVertical(node: TreeNode, centerX: number, y: number): void {
  node.x = centerX;
  node.y = y;
  if (node.children.length === 0) return;

  const totalWidth = node.children.reduce((s, c) => s + c.subtreeSpan, 0) + (node.children.length - 1) * H_GAP;
  let currentLeft = centerX - totalWidth / 2;
  for (const child of node.children) {
    assignVertical(child, currentLeft + child.subtreeSpan / 2, y + V_GAP);
    currentLeft += child.subtreeSpan + H_GAP;
  }
}

// --- Horizontal layout (left → right or right → left) ---

function calcSubtreeHeight(node: TreeNode): number {
  if (node.children.length === 0) {
    node.subtreeSpan = NODE_HEIGHT;
    return NODE_HEIGHT;
  }
  let total = 0;
  for (const child of node.children) {
    total += calcSubtreeHeight(child);
  }
  total += (node.children.length - 1) * H_GAP;
  node.subtreeSpan = Math.max(NODE_HEIGHT, total);
  return node.subtreeSpan;
}

function assignHorizontalLR(node: TreeNode, x: number, centerY: number): void {
  node.x = x;
  node.y = centerY;
  if (node.children.length === 0) return;

  const totalHeight = node.children.reduce((s, c) => s + c.subtreeSpan, 0) + (node.children.length - 1) * H_GAP;
  let currentTop = centerY - totalHeight / 2;
  for (const child of node.children) {
    assignHorizontalLR(child, x + NODE_WIDTH + H_GAP, currentTop + child.subtreeSpan / 2);
    currentTop += child.subtreeSpan + H_GAP;
  }
}

function assignHorizontalRL(node: TreeNode, x: number, centerY: number): void {
  node.x = x;
  node.y = centerY;
  if (node.children.length === 0) return;

  const totalHeight = node.children.reduce((s, c) => s + c.subtreeSpan, 0) + (node.children.length - 1) * H_GAP;
  let currentTop = centerY - totalHeight / 2;
  for (const child of node.children) {
    assignHorizontalRL(child, x - NODE_WIDTH - H_GAP, currentTop + child.subtreeSpan / 2);
    currentTop += child.subtreeSpan + H_GAP;
  }
}

// --- Common ---

function collectPositions(node: TreeNode, result: Map<string, { x: number; y: number }>): void {
  result.set(node.id, { x: node.x, y: node.y });
  for (const child of node.children) {
    collectPositions(child, result);
  }
}

function resolveOverlaps(positions: Map<string, { x: number; y: number }>, direction: LayoutDirection): void {
  const isVertical = direction === 'vertical';
  // Group by the "level" axis
  const levels = new Map<number, { id: string; primary: number }[]>();
  for (const [id, pos] of positions) {
    const levelKey = Math.round(isVertical ? pos.y : pos.x);
    if (!levels.has(levelKey)) levels.set(levelKey, []);
    levels.get(levelKey)!.push({ id, primary: isVertical ? pos.x : pos.y });
  }

  const minDist = isVertical ? NODE_WIDTH + H_GAP / 2 : NODE_HEIGHT + H_GAP / 2;
  for (const [, nodesOnLevel] of levels) {
    if (nodesOnLevel.length < 2) continue;
    nodesOnLevel.sort((a, b) => a.primary - b.primary);
    for (let i = 1; i < nodesOnLevel.length; i++) {
      const prev = nodesOnLevel[i - 1];
      const curr = nodesOnLevel[i];
      const dist = curr.primary - prev.primary;
      if (dist < minDist) {
        const shift = minDist - dist;
        for (let j = i; j < nodesOnLevel.length; j++) {
          nodesOnLevel[j].primary += shift;
          const pos = positions.get(nodesOnLevel[j].id)!;
          if (isVertical) pos.x += shift;
          else pos.y += shift;
        }
      }
    }
  }
}

export function computeLayout(
  nodes: SerializedNode[],
  direction: LayoutDirection = 'vertical'
): Map<string, { x: number; y: number }> {
  const roots = buildTree(nodes);
  const positions = new Map<string, { x: number; y: number }>();

  if (direction === 'vertical') {
    let offsetX = 0;
    for (const root of roots) {
      calcSubtreeWidth(root);
      assignVertical(root, offsetX + root.subtreeSpan / 2, 0);
      collectPositions(root, positions);
      offsetX += root.subtreeSpan + H_GAP;
    }
  } else if (direction === 'horizontal-lr') {
    let offsetY = 0;
    for (const root of roots) {
      calcSubtreeHeight(root);
      assignHorizontalLR(root, 0, offsetY + root.subtreeSpan / 2);
      collectPositions(root, positions);
      offsetY += root.subtreeSpan + H_GAP;
    }
  } else {
    // horizontal-rl
    let offsetY = 0;
    for (const root of roots) {
      calcSubtreeHeight(root);
      assignHorizontalRL(root, 0, offsetY + root.subtreeSpan / 2);
      collectPositions(root, positions);
      offsetY += root.subtreeSpan + H_GAP;
    }
  }

  resolveOverlaps(positions, direction);
  return positions;
}

export { NODE_WIDTH, NODE_HEIGHT, H_GAP, V_GAP };
