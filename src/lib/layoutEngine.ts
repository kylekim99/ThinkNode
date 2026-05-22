import type { SerializedNode } from '../types/mindmap';

const H_GAP = 60;
const V_GAP = 100;
const NODE_WIDTH = 160;

interface TreeNode {
  id: string;
  children: TreeNode[];
  width: number;
  x: number;
  y: number;
}

function buildTree(nodes: SerializedNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const childMap = new Map<string, string[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, { id: n.id, children: [], width: 0, x: 0, y: 0 });
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

function calcSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) {
    node.width = NODE_WIDTH;
    return NODE_WIDTH;
  }
  let totalWidth = 0;
  for (const child of node.children) {
    totalWidth += calcSubtreeWidth(child);
  }
  // H_GAP is the space between sibling subtrees
  totalWidth += (node.children.length - 1) * H_GAP;
  node.width = Math.max(NODE_WIDTH, totalWidth);
  return node.width;
}

function assignPositions(node: TreeNode, x: number, y: number): void {
  node.x = x;
  node.y = y;

  if (node.children.length === 0) return;

  const totalChildrenWidth =
    node.children.reduce((sum, c) => sum + c.width, 0) +
    (node.children.length - 1) * H_GAP;

  let currentX = x - totalChildrenWidth / 2;

  for (const child of node.children) {
    const childCenterX = currentX + child.width / 2;
    assignPositions(child, childCenterX, y + V_GAP);
    currentX += child.width + H_GAP;
  }
}

function collectPositions(node: TreeNode, result: Map<string, { x: number; y: number }>): void {
  result.set(node.id, { x: node.x, y: node.y });
  for (const child of node.children) {
    collectPositions(child, result);
  }
}

export function computeLayout(nodes: SerializedNode[]): Map<string, { x: number; y: number }> {
  const roots = buildTree(nodes);
  const positions = new Map<string, { x: number; y: number }>();

  let offsetX = 0;
  for (const root of roots) {
    calcSubtreeWidth(root);
    assignPositions(root, offsetX + root.width / 2, 0);
    collectPositions(root, positions);
    offsetX += root.width + H_GAP;
  }

  return positions;
}
