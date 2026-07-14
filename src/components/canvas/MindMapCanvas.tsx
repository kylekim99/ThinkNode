import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { MindMapNode } from './MindMapNode';
import { SnapGuideLines } from './SnapGuideLines';
import { useMapStore } from '../../store/useMapStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useSnapGuides } from '../../hooks/useSnapGuides';
import type { MindMapNodeData } from '../../types/mindmap';
import type { Node, Edge } from '@xyflow/react';

const nodeTypes = { mindMapNode: MindMapNode };

export function MindMapCanvas() {
  const nodes = useMapStore((s) => s.nodes);
  const edges = useMapStore((s) => s.edges);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const selectNode = useMapStore((s) => s.selectNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const moveNode = useMapStore((s) => s.moveNode);
  const connectNodes = useMapStore((s) => s.connectNodes);
  const setNodes = useMapStore((s) => s.setNodes);
  const setEdges = useMapStore((s) => s.setEdges);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const themeConfig = useThemeStore((s) => s.getConfig());
  const { setCenter, getZoom } = useReactFlow();
  const { guides, handleNodeDrag, handleNodeDragStop, snapNodeChanges } = useSnapGuides(nodes);
  const prevNodesLengthRef = useRef(nodes.length);
  const isDraggingRef = useRef(false);

  // 노드 추가 시 새 노드로 중앙 이동 (드래그 중/클릭 시에는 비활성화)
  const nodesLengthRef = useRef(nodes.length);

  useEffect(() => {
    if (isDraggingRef.current) {
      nodesLengthRef.current = nodes.length;
      prevNodesLengthRef.current = nodes.length;
      return;
    }

    const nodeAdded = nodes.length > nodesLengthRef.current;
    nodesLengthRef.current = nodes.length;

    if (nodeAdded && selectedNodeId) {
      // 새 노드 추가됨 — 해당 노드로 부드럽게 이동
      const newNode = nodes.find((n) => n.id === selectedNodeId);
      if (newNode) {
        const zoom = getZoom();
        setTimeout(() => {
          setCenter(newNode.position.x, newNode.position.y, { zoom: Math.max(zoom, 0.8), duration: 300 });
        }, 60);
      }
    }

    // posHash 기반 fitView는 수동 레이아웃 버튼(Ctrl+L)에서만 작동하도록 제거
    // 노드 클릭/선택 시 불필요한 fitView 호출 방지
    prevNodesLengthRef.current = nodes.length;
  }, [nodes.length, selectedNodeId, setCenter, getZoom]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const snapped = snapNodeChanges(changes);
      const updated = applyNodeChanges(snapped, nodes) as Node<MindMapNodeData>[];
      setNodes(updated);
    },
    [nodes, setNodes, snapNodeChanges]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const updated = applyEdgeChanges(changes, edges) as Edge[];
      setEdges(updated);
    },
    [edges, setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onNodeDragStart: NodeMouseHandler = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const onNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      isDraggingRef.current = false;
      moveNode(node.id, node.position);
      handleNodeDragStop();
    },
    [moveNode, handleNodeDragStop]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        connectNodes(
          connection.source,
          connection.target,
          connection.sourceHandle ?? undefined,
          connection.targetHandle ?? undefined,
        );
      }
    },
    [connectNodes]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setEditingNode(null);
  }, [selectNode, setEditingNode]);

  if (!activeMapId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-bg)', color: 'var(--node-text)', opacity: 0.5 }}>
        <div className="text-center">
          <div className="text-5xl mb-4">&#128065;</div>
          <p className="text-lg font-medium">Select or create a mind map</p>
          <p className="text-sm mt-1">Use the sidebar to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full" style={{ backgroundColor: themeConfig.canvas.bg }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{
          // step: L자 직각 엣지 (참고이미지 1 스타일). React Flow 내장 step edge는 별도 옵션 없이 orthogonal 렌더.
          type: 'step',
          style: { stroke: themeConfig.name === 'dark' ? '#94a3b8' : '#475569', strokeWidth: 3 },
        }}
        proOptions={{ hideAttribution: true }}
        // React Flow 기본 방향키 노드 nudge(위치 이동) 비활성화 — 방향키는 useKeyboardShortcuts에서 포커스 이동만 처리 (msg 3032 fix)
        disableKeyboardA11y={true}
        style={{ backgroundColor: themeConfig.canvas.bg }}
      >
        <SnapGuideLines guides={guides} />
        <Background color={themeConfig.canvas.dotColor} gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!shadow-md"
          style={{ backgroundColor: themeConfig.toolbar.bg, borderColor: themeConfig.toolbar.border }}
        />
        <MiniMap
          nodeStrokeColor={themeConfig.node.border}
          nodeColor={themeConfig.node.bg}
          maskColor={themeConfig.name === 'dark' ? 'rgba(26, 26, 46, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
          className="!shadow-md"
          style={{ backgroundColor: themeConfig.sidebar.bg, borderColor: themeConfig.sidebar.border }}
        />
      </ReactFlow>
    </div>
  );
}
