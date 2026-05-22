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
import { useMapStore } from '../../store/useMapStore';
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
  const { fitView } = useReactFlow();
  const prevNodesLengthRef = useRef(nodes.length);

  useEffect(() => {
    if (nodes.length !== prevNodesLengthRef.current) {
      prevNodesLengthRef.current = nodes.length;
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    }
  }, [nodes.length, fitView]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const updated = applyNodeChanges(changes, nodes) as Node<MindMapNodeData>[];
      setNodes(updated);
    },
    [nodes, setNodes]
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

  const onNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      moveNode(node.id, node.position);
    },
    [moveNode]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        connectNodes(connection.source, connection.target);
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
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <div className="text-5xl mb-4">&#128065;</div>
          <p className="text-lg font-medium">Select or create a mind map</p>
          <p className="text-sm mt-1">Use the sidebar to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-white !border-slate-200 !shadow-md [&>button]:!border-slate-200 [&>button]:!bg-white [&>button:hover]:!bg-slate-50"
        />
        <MiniMap
          nodeStrokeColor="#64748b"
          nodeColor="#e2e8f0"
          maskColor="rgba(241, 245, 249, 0.7)"
          className="!bg-white !border-slate-200 !shadow-md"
        />
      </ReactFlow>
    </div>
  );
}
