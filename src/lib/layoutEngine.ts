import type { SerializedNode } from '../types/mindmap';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const H_GAP = 50;
const V_GAP = 110;
// 2D 충돌 회피 시 최소 유지 간격 (레이아웃 방향과 무관하게 노드 간 여백)
const OVERLAP_MARGIN = 20;
const MAX_OVERLAP_ITER = 30;

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

// 노드별 실제 크기 맵 (사용자 리사이즈 반영). 없으면 default NODE_WIDTH/NODE_HEIGHT 사용
function buildSizeMap(nodes: SerializedNode[]): Map<string, { width: number; height: number }> {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    const w = typeof n.data.width === 'number' ? n.data.width : NODE_WIDTH;
    const h = typeof n.data.height === 'number' ? n.data.height : NODE_HEIGHT;
    sizes.set(n.id, { width: w, height: h });
  }
  return sizes;
}

// --- Vertical layout (top → bottom) ---

function calcSubtreeWidth(node: TreeNode, sizes: Map<string, { width: number; height: number }>): number {
  const size = sizes.get(node.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
  if (node.children.length === 0) {
    node.subtreeSpan = size.width;
    return size.width;
  }
  let total = 0;
  for (const child of node.children) {
    total += calcSubtreeWidth(child, sizes);
  }
  total += (node.children.length - 1) * H_GAP;
  node.subtreeSpan = Math.max(size.width, total);
  return node.subtreeSpan;
}

function assignVertical(
  node: TreeNode,
  centerX: number,
  y: number,
  sizes: Map<string, { width: number; height: number }>,
): void {
  node.x = centerX;
  node.y = y;
  if (node.children.length === 0) return;

  const size = sizes.get(node.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
  const totalWidth = node.children.reduce((s, c) => s + c.subtreeSpan, 0) + (node.children.length - 1) * H_GAP;
  let currentLeft = centerX - totalWidth / 2;
  for (const child of node.children) {
    // 실제 높이 반영 → 자식 위치를 부모 높이만큼 내려 배치
    assignVertical(child, currentLeft + child.subtreeSpan / 2, y + size.height + V_GAP - NODE_HEIGHT, sizes);
    currentLeft += child.subtreeSpan + H_GAP;
  }
}

// --- Horizontal layout (left → right or right → left) ---

function calcSubtreeHeight(node: TreeNode, sizes: Map<string, { width: number; height: number }>): number {
  const size = sizes.get(node.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
  if (node.children.length === 0) {
    node.subtreeSpan = size.height;
    return size.height;
  }
  let total = 0;
  for (const child of node.children) {
    total += calcSubtreeHeight(child, sizes);
  }
  total += (node.children.length - 1) * H_GAP;
  node.subtreeSpan = Math.max(size.height, total);
  return node.subtreeSpan;
}

function assignHorizontalLR(
  node: TreeNode,
  x: number,
  centerY: number,
  sizes: Map<string, { width: number; height: number }>,
): void {
  node.x = x;
  node.y = centerY;
  if (node.children.length === 0) return;

  const size = sizes.get(node.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
  const totalHeight = node.children.reduce((s, c) => s + c.subtreeSpan, 0) + (node.children.length - 1) * H_GAP;
  let currentTop = centerY - totalHeight / 2;
  for (const child of node.children) {
    // 자식은 부모 오른쪽에 실제 width만큼 떨어져 배치
    assignHorizontalLR(child, x + size.width + H_GAP, currentTop + child.subtreeSpan / 2, sizes);
    currentTop += child.subtreeSpan + H_GAP;
  }
}

function assignHorizontalRL(
  node: TreeNode,
  x: number,
  centerY: number,
  sizes: Map<string, { width: number; height: number }>,
): void {
  node.x = x;
  node.y = centerY;
  if (node.children.length === 0) return;

  const childSize = sizes.get(node.children[0].id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
  const totalHeight = node.children.reduce((s, c) => s + c.subtreeSpan, 0) + (node.children.length - 1) * H_GAP;
  let currentTop = centerY - totalHeight / 2;
  for (const child of node.children) {
    // 자식은 부모 왼쪽에 자식의 width만큼 떨어져 배치 (Confluence-style RTL)
    const cs = sizes.get(child.id) ?? childSize;
    assignHorizontalRL(child, x - cs.width - H_GAP, currentTop + child.subtreeSpan / 2, sizes);
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

// 1D 레벨 기반 충돌 회피 (동일 축상 이웃 노드 간 최소 간격 강제)
function resolveOverlaps1D(
  positions: Map<string, { x: number; y: number }>,
  sizes: Map<string, { width: number; height: number }>,
  direction: LayoutDirection,
): void {
  const isVertical = direction === 'vertical';
  const levels = new Map<number, { id: string; primary: number }[]>();
  for (const [id, pos] of positions) {
    const levelKey = Math.round(isVertical ? pos.y : pos.x);
    if (!levels.has(levelKey)) levels.set(levelKey, []);
    levels.get(levelKey)!.push({ id, primary: isVertical ? pos.x : pos.y });
  }

  for (const [, nodesOnLevel] of levels) {
    if (nodesOnLevel.length < 2) continue;
    nodesOnLevel.sort((a, b) => a.primary - b.primary);
    for (let i = 1; i < nodesOnLevel.length; i++) {
      const prev = nodesOnLevel[i - 1];
      const curr = nodesOnLevel[i];
      const prevSize = sizes.get(prev.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
      // 이전 노드의 실제 width/height 기준으로 최소 간격 계산
      const minDist = (isVertical ? prevSize.width : prevSize.height) + OVERLAP_MARGIN;
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

// 2D AABB 충돌 회피 (레벨과 무관하게 모든 노드 쌍 검사 · 사용자 리사이즈 반영)
// 반복 push 방식으로 안정 상태에 수렴. iteration cap 존재.
function resolveOverlaps2D(
  positions: Map<string, { x: number; y: number }>,
  sizes: Map<string, { width: number; height: number }>,
  direction: LayoutDirection,
): void {
  const isVertical = direction === 'vertical';
  const ids = Array.from(positions.keys());

  for (let iter = 0; iter < MAX_OVERLAP_ITER; iter++) {
    let anyMoved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const posA = positions.get(idA)!;
        const posB = positions.get(idB)!;
        const sizeA = sizes.get(idA) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
        const sizeB = sizes.get(idB) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };

        // AABB (with OVERLAP_MARGIN as required gap)
        const overlapX =
          Math.min(posA.x + sizeA.width, posB.x + sizeB.width) -
          Math.max(posA.x, posB.x) +
          OVERLAP_MARGIN;
        const overlapY =
          Math.min(posA.y + sizeA.height, posB.y + sizeB.height) -
          Math.max(posA.y, posB.y) +
          OVERLAP_MARGIN;

        if (overlapX > 0 && overlapY > 0) {
          // 겹침 발생 → 레이아웃 방향에 따라 밀어냄
          //   수직 레이아웃 → 형제는 x축을 공유하므로 x축으로 push
          //   수평 레이아웃 → 형제는 y축을 공유하므로 y축으로 push
          anyMoved = true;
          if (isVertical) {
            if (posA.x <= posB.x) posB.x += overlapX;
            else posA.x += overlapX;
          } else {
            if (posA.y <= posB.y) posB.y += overlapY;
            else posA.y += overlapY;
          }
        }
      }
    }
    if (!anyMoved) break;
  }
}

export function computeLayout(
  nodes: SerializedNode[],
  direction: LayoutDirection = 'vertical',
): Map<string, { x: number; y: number }> {
  const roots = buildTree(nodes);
  const sizes = buildSizeMap(nodes);
  const positions = new Map<string, { x: number; y: number }>();

  if (direction === 'vertical') {
    let offsetX = 0;
    for (const root of roots) {
      calcSubtreeWidth(root, sizes);
      assignVertical(root, offsetX + root.subtreeSpan / 2, 0, sizes);
      collectPositions(root, positions);
      offsetX += root.subtreeSpan + H_GAP;
    }
  } else if (direction === 'horizontal-lr') {
    let offsetY = 0;
    for (const root of roots) {
      calcSubtreeHeight(root, sizes);
      assignHorizontalLR(root, 0, offsetY + root.subtreeSpan / 2, sizes);
      collectPositions(root, positions);
      offsetY += root.subtreeSpan + H_GAP;
    }
  } else {
    // horizontal-rl
    let offsetY = 0;
    for (const root of roots) {
      calcSubtreeHeight(root, sizes);
      assignHorizontalRL(root, 0, offsetY + root.subtreeSpan / 2, sizes);
      collectPositions(root, positions);
      offsetY += root.subtreeSpan + H_GAP;
    }
  }

  // 1단계: 레벨 기반 1D 정리 (기존 로직, 실제 사이즈 반영)
  resolveOverlaps1D(positions, sizes, direction);
  // 2단계: 2D AABB 정리 (리사이즈된 노드·서로 다른 레벨 노드 간 겹침까지 안전)
  resolveOverlaps2D(positions, sizes, direction);

  return positions;
}

export { NODE_WIDTH, NODE_HEIGHT, H_GAP, V_GAP };
