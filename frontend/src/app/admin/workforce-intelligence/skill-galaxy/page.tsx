'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ZoomIn, ZoomOut, Maximize2, Filter } from 'lucide-react';
import { RiskBadge } from '@/components/workforce-intelligence/risk-badge';
import * as careerApi from '@/lib/api/endpoints/career-intelligence';
import type {
  SimilarSkill,
  SimilarOccupationsResponse,
} from '@/lib/api/endpoints/career-intelligence';

// ============================================
// TYPES
// ============================================

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'skill' | 'occupation';
  skillType?: string; // skill, knowledge, competence
  riskLevel?: string;
  employeeCount?: number;
  uri?: string;
  iscoCode?: string;
  expanded?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  type: 'has_skill' | 'similar' | 'requires';
  strength: number;
}

// ============================================
// CONSTANTS
// ============================================

const SKILL_TYPE_COLORS: Record<string, string> = {
  skill: '#3B82F6',
  knowledge: '#8B5CF6',
  competence: '#14B8A6',
};

const OCCUPATION_COLOR = '#F59E0B';

const RISK_BORDER_COLORS: Record<string, string> = {
  CRITICAL_GAP: '#e03131',
  critical: '#e03131',
  SCARCE: '#f76707',
  high: '#f76707',
  HEALTHY: '#37b24d',
  healthy: '#37b24d',
  moderate: '#f59f00',
  WIDESPREAD: '#2b8a3e',
};

const MAX_INITIAL_NODES = 50;
const MAX_EXPANSION_NODES = 10;
const MAX_SIMULATION_TICKS = 300;

// ============================================
// HELPERS
// ============================================

function nodeColor(node: GraphNode): string {
  if (node.type === 'occupation') return OCCUPATION_COLOR;
  return SKILL_TYPE_COLORS[node.skillType ?? 'skill'] ?? '#3B82F6';
}

function nodeRadius(node: GraphNode): number {
  return node.type === 'occupation' ? 20 : 12;
}

function riskBorderColor(level?: string): string {
  if (!level) return 'transparent';
  return RISK_BORDER_COLORS[level] ?? 'transparent';
}

function mapRiskLevel(level: string): 'critical' | 'high' | 'moderate' | 'healthy' {
  switch (level) {
    case 'CRITICAL_GAP':
      return 'critical';
    case 'SCARCE':
      return 'high';
    case 'HEALTHY':
      return 'moderate';
    case 'WIDESPREAD':
      return 'healthy';
    default:
      return level as 'critical' | 'high' | 'moderate' | 'healthy';
  }
}

// ============================================
// COMPONENT
// ============================================

export default function SkillGalaxyPage() {
  const t = useTranslations('admin.workforceIntelligence.skillGalaxy');
  const tCommon = useTranslations('common');
  // --- State ---
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [similarSkills, setSimilarSkills] = useState<SimilarSkill[]>([]);
  const [similarOccupations, setSimilarOccupations] = useState<
    SimilarOccupationsResponse['similarOccupations']
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [skillTypeFilters, setSkillTypeFilters] = useState<Record<string, boolean>>({
    skill: true,
    knowledge: true,
    competence: true,
  });
  const [riskFilters, setRiskFilters] = useState<Record<string, boolean>>({
    critical: true,
    high: true,
    moderate: true,
    healthy: true,
  });

  // D3 refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // --- Data loading ---
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await careerApi.getSkillIntelligence();
      const skills = (response.skills ?? []).slice(0, MAX_INITIAL_NODES);

      if (skills.length === 0) {
        setNodes([]);
        setLinks([]);
        setLoading(false);
        return;
      }

      const graphNodes: GraphNode[] = skills.map((s) => ({
        id: s.skillLabel,
        label: s.skillLabel,
        type: 'skill' as const,
        skillType: s.skillType ?? 'skill',
        riskLevel: s.riskLevel,
        employeeCount: s.employeesWithSkill,
      }));

      // Create links between skills that share the same risk level for clustering
      const graphLinks: GraphLink[] = [];
      const riskGroups: Record<string, GraphNode[]> = {};
      for (const node of graphNodes) {
        const key = node.riskLevel ?? 'unknown';
        if (!riskGroups[key]) riskGroups[key] = [];
        riskGroups[key].push(node);
      }

      for (const group of Object.values(riskGroups)) {
        for (let i = 0; i < group.length - 1; i++) {
          // Connect each node to the next in the group for a chain
          if (i < group.length - 1) {
            graphLinks.push({
              source: group[i].id,
              target: group[i + 1].id,
              type: 'has_skill',
              strength: 0.3,
            });
          }
        }
      }

      setNodes(graphNodes);
      setLinks(graphLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Filtered nodes/links ---
  const filteredNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of nodes) {
      if (node.type === 'occupation') {
        ids.add(node.id);
        continue;
      }
      const st = node.skillType ?? 'skill';
      if (!skillTypeFilters[st]) continue;
      const rl = mapRiskLevel(node.riskLevel ?? 'healthy');
      if (!riskFilters[rl]) continue;
      ids.add(node.id);
    }
    return ids;
  }, [nodes, skillTypeFilters, riskFilters]);

  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const ids = new Set<string>();
    for (const node of nodes) {
      if (node.label.toLowerCase().includes(q)) ids.add(node.id);
    }
    return ids;
  }, [nodes, searchQuery]);

  // --- D3 Force Simulation ---
  useEffect(() => {
    if (loading || !svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous
    svg.selectAll('*').remove();

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    const g = svg.append('g');

    // Deep copy nodes/links for D3 mutation
    const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: GraphLink[] = links.map((l) => ({
      ...l,
      source: typeof l.source === 'string' ? l.source : (l.source as GraphNode).id,
      target: typeof l.target === 'string' ? l.target : (l.target as GraphNode).id,
    }));

    // Filter to only visible nodes/links
    const visibleNodes = simNodes.filter((n) => filteredNodeIds.has(n.id));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = simLinks.filter((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId);
    });

    // Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(visibleNodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(visibleLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    // Links
    const linkSel = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(visibleLinks)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', (d) => Math.max(0.1, d.strength * 0.5))
      .attr('stroke-width', 1);

    // Node groups
    const nodeSel = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(visibleNodes, (d) => d.id)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Risk border circle (slightly larger)
    nodeSel
      .append('circle')
      .attr('r', (d) => nodeRadius(d) + 3)
      .attr('fill', 'none')
      .attr('stroke', (d) => riskBorderColor(d.riskLevel))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', (d) =>
        d.riskLevel === 'CRITICAL_GAP' || d.riskLevel === 'critical' ? '4 2' : 'none'
      );

    // Main circle
    nodeSel
      .append('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => nodeColor(d))
      .attr('fill-opacity', 0.2)
      .attr('stroke', (d) => nodeColor(d))
      .attr('stroke-width', 1.5);

    // Label
    nodeSel
      .append('text')
      .text((d) => (d.label.length > 18 ? d.label.slice(0, 17) + '\u2026' : d.label))
      .attr('dy', (d) => nodeRadius(d) + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', 'currentColor')
      .attr('class', 'fill-muted-foreground')
      .attr('pointer-events', 'none');

    // Tooltip
    const tooltip = d3
      .select(container)
      .append('div')
      .attr(
        'class',
        'absolute pointer-events-none rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 z-50'
      )
      .style('transition', 'opacity 0.15s ease');

    // Hover handlers
    nodeSel
      .on('mouseenter', (event, d) => {
        // Highlight connected
        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        visibleLinks.forEach((l) => {
          const srcId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const tgtId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          if (srcId === d.id) connectedIds.add(tgtId as string);
          if (tgtId === d.id) connectedIds.add(srcId as string);
        });

        nodeSel.attr('opacity', (n) => (connectedIds.has(n.id) ? 1 : 0.2));
        linkSel.attr('stroke-opacity', (l) => {
          const srcId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
          const tgtId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
          return srcId === d.id || tgtId === d.id ? 0.6 : 0.05;
        });

        // Tooltip
        const details = [d.label];
        if (d.skillType) details.push(`Type: ${d.skillType}`);
        if (d.riskLevel) details.push(`Risk: ${d.riskLevel}`);
        if (d.employeeCount != null) details.push(`Employees: ${d.employeeCount}`);

        tooltip
          .html(details.join('<br/>'))
          .style('opacity', '1')
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`);
      })
      .on('mousemove', (event) => {
        tooltip.style('left', `${event.offsetX + 12}px`).style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', () => {
        nodeSel.attr('opacity', 1);
        linkSel.attr('stroke-opacity', (d) => Math.max(0.1, d.strength * 0.5));
        tooltip.style('opacity', '0');
      })
      .on('click', (_event, d) => {
        handleNodeClick(d);
      });

    // Search highlighting
    if (searchMatchIds) {
      nodeSel.attr('opacity', (d) => (searchMatchIds.has(d.id) ? 1 : 0.15));
    }

    // Tick
    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount++;
      if (tickCount > MAX_SIMULATION_TICKS) {
        simulation.stop();
        return;
      }

      linkSel
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);

      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- D3 simulation refs stable, deps listed are the actual triggers
  }, [nodes, links, loading, filteredNodeIds, searchMatchIds]);

  // --- Resize handler ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (simulationRef.current && svgRef.current) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        simulationRef.current
          .force('center', d3.forceCenter(w / 2, h / 2))
          .alpha(0.3)
          .restart();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // --- Node click handler ---
  const handleNodeClick = useCallback(
    async (node: GraphNode) => {
      setSelectedNode(node);
      setSheetOpen(true);
      setSimilarSkills([]);
      setSimilarOccupations([]);

      if (node.type === 'skill' && node.uri && !node.expanded) {
        setDetailLoading(true);
        try {
          const similar = await careerApi.getSimilarSkills(node.uri, {
            maxResults: MAX_EXPANSION_NODES,
          });
          setSimilarSkills(similar);

          // Add similar skills as new nodes
          const newNodes: GraphNode[] = [];
          const newLinks: GraphLink[] = [];

          for (const s of similar) {
            const existingNode = nodes.find((n) => n.id === s.preferredLabel);
            if (!existingNode) {
              newNodes.push({
                id: s.preferredLabel,
                label: s.preferredLabel,
                type: 'skill',
                skillType: s.skillType ?? 'skill',
                uri: s.uri,
              });
            }
            newLinks.push({
              source: node.id,
              target: s.preferredLabel,
              type: 'similar',
              strength: s.similarity,
            });
          }

          if (newNodes.length > 0 || newLinks.length > 0) {
            setNodes((prev) => {
              const updated = prev.map((n) => (n.id === node.id ? { ...n, expanded: true } : n));
              return [...updated, ...newNodes];
            });
            setLinks((prev) => [...prev, ...newLinks]);
          }
        } catch {
          // Expansion failed silently — detail panel still shows
        } finally {
          setDetailLoading(false);
        }
      } else if (node.type === 'occupation' && node.uri) {
        setDetailLoading(true);
        try {
          const response = await careerApi.getSimilarOccupations(node.uri, {
            maxResults: 10,
          });
          setSimilarOccupations(response.similarOccupations ?? []);
        } catch {
          // Silent failure
        } finally {
          setDetailLoading(false);
        }
      }
    },
    [nodes]
  );

  // --- Zoom controls ---
  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;

    const selection = d3.select(svg);
    if (direction === 'in') {
      selection.transition().duration(300).call(zoom.scaleBy, 1.3);
    } else if (direction === 'out') {
      selection.transition().duration(300).call(zoom.scaleBy, 0.7);
    } else {
      selection.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    }
  }, []);

  // --- Filter toggles ---
  const toggleSkillType = useCallback((type: string) => {
    setSkillTypeFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const toggleRisk = useCallback((level: string) => {
    setRiskFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  }, []);

  // --- Render ---
  if (loading) {
    return (
      <div className="grid grid-cols-[240px_1fr] gap-4 h-[calc(100vh-220px)]">
        <h1 className="sr-only">Skill Galaxy</h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-destructive font-medium mb-2">Failed to load Skill Galaxy</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={loadData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground font-medium mb-2">No skill data available</p>
          <p className="text-sm text-muted-foreground">
            The Skill Galaxy requires skill intelligence data. Ensure your tenant has skills and
            employees configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <motion.div
        className="grid grid-cols-[240px_1fr] gap-4 h-[calc(100vh-220px)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* --- Filters Panel --- */}
        <Card className="overflow-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Skill Type */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Skill Type
              </p>
              {(['skill', 'knowledge', 'competence'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={skillTypeFilters[type]}
                    onCheckedChange={() => toggleSkillType(type)}
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SKILL_TYPE_COLORS[type] }}
                  />
                  <span className="capitalize">{type}</span>
                </label>
              ))}
            </div>

            {/* Risk Level */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Risk Level
              </p>
              {(['critical', 'high', 'moderate', 'healthy'] as const).map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={riskFilters[level]}
                    onCheckedChange={() => toggleRisk(level)}
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: RISK_BORDER_COLORS[level] ?? '#94a3b8',
                    }}
                  />
                  <span className="capitalize">{level}</span>
                </label>
              ))}
            </div>

            {/* Separator */}
            <div className="border-t pt-3" />

            {/* Zoom controls */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Zoom
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleZoom('in')}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleZoom('out')}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleZoom('reset')}
                  aria-label="Reset zoom"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Legend
              </p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border-2"
                    style={{
                      borderColor: OCCUPATION_COLOR,
                      backgroundColor: `${OCCUPATION_COLOR}33`,
                    }}
                  />
                  Occupation
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#3B82F6]" />
                  Skill
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#8B5CF6]" />
                  Knowledge
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#14B8A6]" />
                  Competence
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {nodes.length} nodes &middot; {links.length} links
              </p>
            </div>
          </CardContent>
        </Card>

        {/* --- Graph Canvas --- */}
        <Card className="overflow-hidden">
          <div ref={containerRef} className="relative w-full h-full">
            <svg
              ref={svgRef}
              className="w-full h-full"
              role="img"
              aria-label="Skill Galaxy force-directed graph"
            />
          </div>
        </Card>
      </motion.div>

      {/* --- Detail Sheet --- */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[380px] sm:w-[440px] overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              {selectedNode?.label}
              {selectedNode?.type === 'skill' && selectedNode.skillType && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: SKILL_TYPE_COLORS[selectedNode.skillType] ?? '#3B82F6',
                    color: SKILL_TYPE_COLORS[selectedNode.skillType] ?? '#3B82F6',
                  }}
                >
                  {selectedNode.skillType}
                </Badge>
              )}
              {selectedNode?.type === 'occupation' && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: OCCUPATION_COLOR,
                    color: OCCUPATION_COLOR,
                  }}
                >
                  occupation
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Skill details */}
            {selectedNode?.type === 'skill' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {selectedNode.riskLevel && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                      <RiskBadge level={selectedNode.riskLevel} />
                    </div>
                  )}
                  {selectedNode.employeeCount != null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Employees</p>
                      <p className="text-sm font-medium">{selectedNode.employeeCount}</p>
                    </div>
                  )}
                </div>

                {selectedNode.expanded && (
                  <p className="text-xs text-muted-foreground italic">
                    Node expanded — similar skills shown in graph
                  </p>
                )}
                {!selectedNode.uri && !selectedNode.expanded && (
                  <p className="text-xs text-muted-foreground italic">
                    Click a similar skill with a URI to expand further
                  </p>
                )}

                {detailLoading && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                )}

                {similarSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Similar Skills
                    </p>
                    <div className="space-y-1.5">
                      {similarSkills.map((s) => (
                        <div
                          key={s.skillId}
                          className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50"
                        >
                          <span className="truncate mr-2">{s.preferredLabel}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {(s.similarity * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Occupation details */}
            {selectedNode?.type === 'occupation' && (
              <>
                {selectedNode.iscoCode && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ISCO Code</p>
                    <p className="text-sm font-medium">{selectedNode.iscoCode}</p>
                  </div>
                )}

                {detailLoading && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                )}

                {similarOccupations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Similar Occupations
                    </p>
                    <div className="space-y-1.5">
                      {similarOccupations.map((o) => (
                        <div
                          key={o.occupationId}
                          className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50"
                        >
                          <span className="truncate mr-2">{o.occupationLabel}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {(o.combinedScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
