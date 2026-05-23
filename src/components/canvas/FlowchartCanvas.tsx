import { useCallback, useRef, useEffect, useState } from 'react';
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
  type EdgeMouseHandler,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from '@xyflow/react';
import { FlowchartNode } from './FlowchartNode';
import { SnapGuideLines } from './SnapGuideLines';
import { useMapStore } from '../../store/useMapStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useSnapGuides } from '../../hooks/useSnapGuides';
import type { MindMapNodeData, FlowchartNodeData } from '../../types/mindmap';
import type { Node, Edge } from '@xyflow/react';

const nodeTypes = { flowchartNode: FlowchartNode };

const shapes: { shape: FlowchartNodeData['shape']; label: string; icon: string; color: string }[] = [
  { shape: 'start-end', label: 'Start / End', icon: '\u2B2D', color: 'bg-emerald-500' },
  { shape: 'process', label: 'Process', icon: '\u25A0', color: 'bg-blue-500' },
  { shape: 'decision', label: 'Decision', icon: '\u25C6', color: 'bg-amber-500' },
  { shape: 'io', label: 'Input / Output', icon: '\u25B1', color: 'bg-purple-500' },
];

export function FlowchartCanvas() {
  const nodes = useMapStore((s) => s.nodes);
  const edges = useMapStore((s) => s.edges);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const selectNode = useMapStore((s) => s.selectNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const moveNode = useMapStore((s) => s.moveNode);
  const connectFlowchartNodes = useMapStore((s) => s.connectFlowchartNodes);
  const addFlowchartNode = useMapStore((s) => s.addFlowchartNode);
  const setNodes = useMapStore((s) => s.setNodes);
  const setEdges = useMapStore((s) => s.setEdges);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const updateEdgeLabel = useMapStore((s) => s.updateEdgeLabel);
  const themeConfig = useThemeStore((s) => s.getConfig());
  const { fitView, setCenter, getZoom, getViewport } = useReactFlow();
  const { guides, handleNodeDrag, handleNodeDragStop: clearGuides, snapNodeChanges } = useSnapGuides(nodes);
  const prevNodesLengthRef = useRef(nodes.length);

  const [edgeLabelInput, setEdgeLabelInput] = useState('');
  const [showEdgeLabelEditor, setShowEdgeLabelEditor] = useState(false);

  // When a new node is added, center on it
  useEffect(() => {
    const nodeAdded = nodes.length > prevNodesLengthRef.current;
    if (nodeAdded && selectedNodeId) {
      const newNode = nodes.find((n) => n.id === selectedNodeId);
      if (newNode) {
        const zoom = getZoom();
        setTimeout(() => {
          setCenter(newNode.position.x, newNode.position.y, {
            zoom: Math.max(zoom, 0.8),
            duration: 300,
          });
        }, 60);
      }
    }
    prevNodesLengthRef.current = nodes.length;
  }, [nodes, selectedNodeId, fitView, setCenter, getZoom]);

  // Open edge label editor when edge selected
  useEffect(() => {
    if (selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      setEdgeLabelInput(typeof edge?.label === 'string' ? edge.label : '');
      setShowEdgeLabelEditor(true);
    } else {
      setShowEdgeLabelEditor(false);
    }
  }, [selectedEdgeId, edges]);

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
      selectEdge(null);
    },
    [selectNode, selectEdge]
  );

  const onNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      moveNode(node.id, node.position);
      clearGuides();
    },
    [moveNode, clearGuides]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        connectFlowchartNodes(
          connection.source,
          connection.target,
          connection.sourceHandle || undefined,
          connection.targetHandle || undefined
        );
      }
    },
    [connectFlowchartNodes]
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      selectEdge(edge.id);
      selectNode(null);
    },
    [selectEdge, selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setEditingNode(null);
    selectEdge(null);
  }, [selectNode, setEditingNode, selectEdge]);

  const handleAddShape = useCallback(
    (shape: FlowchartNodeData['shape']) => {
      const viewport = getViewport();
      // Place the node near the center of the viewport
      const x = (-viewport.x + 400) / viewport.zoom;
      const y = (-viewport.y + 300) / viewport.zoom;
      addFlowchartNode(shape, { x, y });
    },
    [getViewport, addFlowchartNode]
  );

  const handleEdgeLabelSave = useCallback(() => {
    if (selectedEdgeId) {
      updateEdgeLabel(selectedEdgeId, edgeLabelInput);
    }
    selectEdge(null);
    setShowEdgeLabelEditor(false);
  }, [selectedEdgeId, edgeLabelInput, updateEdgeLabel, selectEdge]);

  if (!activeMapId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-bg)', color: 'var(--node-text)', opacity: 0.5 }}>
        <div className="text-center">
          <div className="text-5xl mb-4">&#128065;</div>
          <p className="text-lg font-medium">Select or create a flowchart</p>
          <p className="text-sm mt-1">Use the sidebar to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full relative" style={{ backgroundColor: themeConfig.canvas.bg }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#64748b', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
        }}
        proOptions={{ hideAttribution: true }}
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

      {/* Shape Palette */}
      <div className="absolute top-4 left-4 border rounded-xl shadow-lg p-2 flex flex-col gap-1 z-10" style={{ backgroundColor: 'var(--toolbar-bg)', borderColor: 'var(--toolbar-border)' }}>
        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--toolbar-text)', opacity: 0.7 }}>
          Shapes
        </div>
        {shapes.map((s) => (
          <button
            key={s.shape}
            onClick={() => handleAddShape(s.shape)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
            title={`Add ${s.label}`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs ${s.color}`}
            >
              {s.icon}
            </span>
            <span className="font-medium">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Edge Label Editor */}
      {showEdgeLabelEditor && selectedEdgeId && (
        <div className="absolute top-4 right-4 border rounded-xl shadow-lg p-4 z-10 w-64" style={{ backgroundColor: 'var(--toolbar-bg)', borderColor: 'var(--toolbar-border)' }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--toolbar-text)', opacity: 0.7 }}>
            Edge Label
          </div>
          <input
            autoFocus
            value={edgeLabelInput}
            onChange={(e) => setEdgeLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEdgeLabelSave();
              if (e.key === 'Escape') {
                selectEdge(null);
                setShowEdgeLabelEditor(false);
              }
            }}
            placeholder="e.g. Yes, No, ..."
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400 mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleEdgeLabelSave}
              className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                selectEdge(null);
                setShowEdgeLabelEditor(false);
              }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
