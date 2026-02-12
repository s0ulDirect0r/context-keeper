import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { ConstellationData, ConstellationNode, ConstellationEdge } from './types/cedar';

// Card dimensions per node type (width x height in pixels)
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  seed: { width: 200, height: 60 },
  pearl: { width: 288, height: 180 },
  'pearl-cluster': { width: 224, height: 100 },
  decision: { width: 240, height: 140 },
  action: { width: 200, height: 100 },
};

const DEFAULT_DIMENSIONS = { width: 200, height: 80 };

interface LayoutOptions {
  /** Horizontal gap between sibling nodes. Default: 60 */
  nodesep?: number;
  /** Vertical gap between ranks. Default: 80 */
  ranksep?: number;
  /** Gap between disconnected trees. Default: 100 */
  componentGap?: number;
}

/**
 * Compute a deterministic tree layout for constellation data using Dagre.
 * Returns React Flow-compatible nodes (with positions) and edges.
 *
 * Handles disconnected components (multiple summary trees) by laying out
 * each component separately and arranging them side by side.
 */
export function computeConstellationLayout(
  data: ConstellationData,
  options: LayoutOptions = {},
): { nodes: Node[]; edges: Edge[] } {
  const { nodesep = 80, ranksep = 100, componentGap = 120 } = options;

  if (data.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Find connected components
  const components = findConnectedComponents(data.nodes, data.edges);

  // Layout each component separately, then offset horizontally
  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];
  let offsetX = 0;

  for (const component of components) {
    const componentNodeIds = new Set(component.map((n) => n.id));
    const componentEdges = data.edges.filter(
      (e) => componentNodeIds.has(e.source) && componentNodeIds.has(e.target),
    );

    const { nodes, edges, width } = layoutComponent(
      component,
      componentEdges,
      { nodesep, ranksep },
      offsetX,
    );

    allNodes.push(...nodes);
    allEdges.push(...edges);
    offsetX += width + componentGap;
  }

  // Add cross-component edges (edges between different trees)
  const allNodeIds = new Set(allNodes.map((n) => n.id));
  for (const edge of data.edges) {
    const edgeId = `${edge.source}-${edge.target}`;
    const alreadyAdded = allEdges.some((e) => e.id === edgeId);
    if (!alreadyAdded && allNodeIds.has(edge.source) && allNodeIds.has(edge.target)) {
      allEdges.push(toReactFlowEdge(edge));
    }
  }

  return { nodes: allNodes, edges: allEdges };
}

/** Layout a single connected component with Dagre */
function layoutComponent(
  nodes: ConstellationNode[],
  edges: ConstellationEdge[],
  config: { nodesep: number; ranksep: number },
  offsetX: number,
): { nodes: Node[]; edges: Edge[]; width: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: config.nodesep,
    ranksep: config.ranksep,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with dimensions
  for (const node of nodes) {
    const dims = NODE_DIMENSIONS[node.type] ?? DEFAULT_DIMENSIONS;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Extract positioned nodes (Dagre returns center coords, React Flow wants top-left)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const layoutNodes: Node[] = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const dims = NODE_DIMENSIONS[node.type] ?? DEFAULT_DIMENSIONS;
    return {
      id: node.id,
      type: node.type,
      position: {
        x: dagreNode.x - dims.width / 2 + offsetX,
        y: dagreNode.y - dims.height / 2,
      },
      data: { ...node },
    };
  });

  const layoutEdges: Edge[] = edges.map((edge) => toReactFlowEdge(edge));

  const graphLabel = g.graph();
  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    width: graphLabel.width ?? 0,
  };
}

/** Convert a ConstellationEdge to a React Flow Edge */
function toReactFlowEdge(edge: ConstellationEdge): Edge {
  const isSprouts = edge.type === 'sprouts';
  const isContradicts = edge.type === 'contradicts';
  return {
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: false,
    style: {
      stroke: isContradicts ? '#ef4444' : '#d1d5db',
      strokeWidth: isSprouts ? 1.5 : Math.max(1, edge.strength * 2),
      strokeDasharray: isContradicts ? '4 4' : undefined,
      opacity: isSprouts ? 0.5 : 0.6,
    },
  };
}

/**
 * Find connected components in the graph using BFS.
 * Returns arrays of ConstellationNode[], one per component.
 */
function findConnectedComponents(
  nodes: ConstellationNode[],
  edges: ConstellationEdge[],
): ConstellationNode[][] {
  // Build undirected adjacency
  const adj = new Map<string, Set<string>>();
  for (const node of nodes) {
    adj.set(node.id, new Set());
  }
  for (const edge of edges) {
    adj.get(edge.source)?.add(edge.target);
    adj.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const components: ConstellationNode[][] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const component: ConstellationNode[] = [];
    const queue = [node.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const n = nodeMap.get(current);
      if (n) component.push(n);

      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}
