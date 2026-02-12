'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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

export function ConstellationFlow({ data, selectedNodeId, onNodeClick }: ConstellationFlowProps) {
  const layout = useMemo(() => computeConstellationLayout(data), [data]);

  const [nodes, , onNodesChange] = useNodesState(layout.nodes);
  const [edges] = useEdgesState(layout.edges);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // node.data is the ConstellationNode we stored in layout
      onNodeClick(node.data as unknown as ConstellationNode);
    },
    [onNodeClick],
  );

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
      </ReactFlow>
    </div>
  );
}
