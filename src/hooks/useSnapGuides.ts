import { useCallback, useState } from 'react';
import type { Node, NodeChange } from '@xyflow/react';
import type { MindMapNodeData } from '../types/mindmap';

const SNAP_THRESHOLD = 8; // pixels

export interface GuideLine {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
}

/**
 * Hook that provides snap-to-alignment guides when dragging nodes.
 * Returns guide lines to render and an onNodesChange wrapper that snaps positions.
 */
export function useSnapGuides(nodes: Node<MindMapNodeData>[]) {
  const [guides, setGuides] = useState<GuideLine[]>([]);

  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const newGuides: GuideLine[] = [];
      const dragX = draggedNode.position.x;
      const dragY = draggedNode.position.y;

      for (const node of nodes) {
        if (node.id === draggedNode.id) continue;

        // Vertical alignment (same X = left edges aligned)
        if (Math.abs(node.position.x - dragX) < SNAP_THRESHOLD) {
          newGuides.push({ type: 'vertical', position: node.position.x });
        }

        // Horizontal alignment (same Y = top edges aligned)
        if (Math.abs(node.position.y - dragY) < SNAP_THRESHOLD) {
          newGuides.push({ type: 'horizontal', position: node.position.y });
        }
      }

      // Deduplicate
      const unique = newGuides.filter(
        (g, i, arr) => arr.findIndex((o) => o.type === g.type && Math.abs(o.position - g.position) < 2) === i
      );
      setGuides(unique);
    },
    [nodes]
  );

  const handleNodeDragStop = useCallback(() => {
    setGuides([]);
  }, []);

  /**
   * Wraps applyNodeChanges to snap dragging nodes to nearby alignment positions.
   */
  const snapNodeChanges = useCallback(
    (changes: NodeChange[]): NodeChange[] => {
      return changes.map((change) => {
        if (change.type !== 'position' || !change.position || change.dragging === false) {
          return change;
        }

        const dragId = change.id;
        let { x, y } = change.position;

        for (const node of nodes) {
          if (node.id === dragId) continue;

          // Snap X
          if (Math.abs(node.position.x - x) < SNAP_THRESHOLD) {
            x = node.position.x;
          }

          // Snap Y
          if (Math.abs(node.position.y - y) < SNAP_THRESHOLD) {
            y = node.position.y;
          }
        }

        return { ...change, position: { x, y } };
      });
    },
    [nodes]
  );

  return { guides, handleNodeDrag, handleNodeDragStop, snapNodeChanges };
}
