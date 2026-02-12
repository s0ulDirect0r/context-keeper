'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PearlClusterNode } from './nodes/PearlClusterNode';
import { DecisionNode } from './nodes/DecisionNode';
import { ActionNode } from './nodes/ActionNode';
import { computeConstellationLayout } from '@/lib/constellation-layout';
import type { ConstellationData, ConstellationNode } from '@/lib/types/cedar';

const nodeTypes = {
  'pearl-cluster': PearlClusterNode,
  decision: DecisionNode,
  action: ActionNode,
};

interface ConstellationFlowProps {
  data: ConstellationData;
  selectedNodeId: string | null;
  onNodeClick: (node: ConstellationNode) => void;
}

function ConstellationFlowInner({ data, selectedNodeId, onNodeClick }: ConstellationFlowProps) {
  const layout = useMemo(() => computeConstellationLayout(data), [data]);
  const { fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges] = useEdgesState(layout.edges);

  // Sync nodes/edges when data changes (e.g. surfacing, team toggle)
  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick(node.data as unknown as ConstellationNode);
    },
    [onNodeClick],
  );

  const handleResetLayout = useCallback(() => {
    const fresh = computeConstellationLayout(data);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setTimeout(() => fitView({ duration: 300 }), 50);
  }, [data, setNodes, setEdges, fitView]);

  return (
    <div data-testid="constellation-graph" className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap nodeClassName={(node) => node.type ?? ''} pannable zoomable />
        <Panel position="top-right">
          <button
            onClick={handleResetLayout}
            className="px-2 py-1 text-xs rounded border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          >
            Reset layout
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function ConstellationFlow(props: ConstellationFlowProps) {
  return (
    <ReactFlowProvider>
      <ConstellationFlowInner {...props} />
    </ReactFlowProvider>
  );
}
