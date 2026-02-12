'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { drag } from 'd3-drag';
import 'd3-transition'; // Extends Selection with .transition()
import type { ConstellationData, ConstellationNode, ConstellationEdge } from '@/lib/types/cedar';

interface GraphProps {
  data: ConstellationData;
  selectedNodeId: string | null;
  onNodeClick: (node: ConstellationNode) => void;
}

// Extended node type for D3 simulation
interface SimNode extends SimulationNodeDatum, ConstellationNode {
  x: number;
  y: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  type: ConstellationEdge['type'];
  strength: number;
}

const NODE_COLORS = {
  'pearl-cluster': { fill: '#f59e0b', stroke: '#d97706' }, // amber
  decision: { fill: '#3b82f6', stroke: '#2563eb' }, // blue
  action: { fill: '#10b981', stroke: '#059669' }, // emerald
} as const;

const CONFIDENCE_DASH = {
  low: '4,4',
  medium: '8,4',
  high: '', // solid
} as const;

const ACTION_STATUS_COLORS = {
  pending: '#9ca3af', // gray
  in_progress: '#f59e0b', // amber
  done: '#10b981', // green
} as const;

export function Graph({ data, selectedNodeId, onNodeClick }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);

  const renderGraph = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || data.nodes.length === 0) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;

    // Prepare simulation data
    const nodes: SimNode[] = data.nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = data.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        type: e.type,
        strength: e.strength,
      }));

    // Clear previous
    const svgSel = select(svg);
    svgSel.selectAll('*').remove();

    // Create container for zoom
    const g = svgSel.append('g');

    // Set up zoom
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svgSel.call(zoomBehavior);

    // Draw edges
    const linkSel = g
      .append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => (d.type === 'contradicts' ? '#ef4444' : '#d1d5db'))
      .attr('stroke-width', (d) => d.strength * 2)
      .attr('stroke-dasharray', (d) => (d.type === 'contradicts' ? '4,4' : ''))
      .attr('stroke-opacity', 0.5);

    // Draw nodes
    const nodeSel = g
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        const original = data.nodes.find((n) => n.id === d.id);
        if (original) onNodeClick(original);
      });

    // Node circles
    nodeSel
      .append('circle')
      .attr('r', (d) => d.size / 2)
      .attr('fill', (d) => {
        if (d.type === 'action' && d.actionStatus) {
          return ACTION_STATUS_COLORS[d.actionStatus];
        }
        return NODE_COLORS[d.type].fill;
      })
      .attr('stroke', (d) => NODE_COLORS[d.type].stroke)
      .attr('stroke-width', (d) => (d.id === selectedNodeId ? 3 : 1.5))
      .attr('stroke-dasharray', (d) => {
        if (d.type === 'decision' && d.confidence) {
          return CONFIDENCE_DASH[d.confidence];
        }
        return '';
      })
      .attr('opacity', (d) => 0.4 + d.recency * 0.6);

    // Node labels
    nodeSel
      .append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.size / 2 + 14)
      .attr('font-size', '10px')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.7);

    // Contributor badges (team view)
    nodeSel
      .filter((d) => !!d.contributor)
      .append('text')
      .text((d) => d.contributor?.charAt(0) ?? '')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white');

    // Drag behavior
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(dragBehavior);

    // Force simulation
    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => d.strength * 0.5),
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => d.size / 2 + 8),
      )
      .on('tick', () => {
        linkSel
          .attr('x1', (d) => (d.source as SimNode).x)
          .attr('y1', (d) => (d.source as SimNode).y)
          .attr('x2', (d) => (d.target as SimNode).x)
          .attr('y2', (d) => (d.target as SimNode).y);

        nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });

    simulationRef.current = simulation;

    // Fit to viewport after settling
    simulation.on('end', () => {
      // Auto-zoom to fit all nodes
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs) - 40;
      const maxX = Math.max(...xs) + 40;
      const minY = Math.min(...ys) - 40;
      const maxY = Math.max(...ys) + 40;
      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;
      const scale = Math.min(width / graphWidth, height / graphHeight, 1.5) * 0.9;
      const tx = (width - graphWidth * scale) / 2 - minX * scale;
      const ty = (height - graphHeight * scale) / 2 - minY * scale;
      svgSel
        .transition()
        .duration(500)
        .call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(scale));
    });
  }, [data, selectedNodeId, onNodeClick]);

  useEffect(() => {
    renderGraph();
    return () => {
      simulationRef.current?.stop();
    };
  }, [renderGraph]);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => renderGraph();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderGraph]);

  return <svg ref={svgRef} className="w-full h-full" data-testid="constellation-graph" />;
}
