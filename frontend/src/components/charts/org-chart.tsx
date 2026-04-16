'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Users, Building2, User, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { OrgUnit } from '@/lib/api/types';

// ============================================
// TYPES
// ============================================

interface OrgChartProps {
  orgUnits: OrgUnit[];
  onNodeClick?: (orgUnit: OrgUnit) => void;
  height?: number | string;
}

interface NodeData extends Record<string, unknown> {
  orgUnit: OrgUnit;
  label: string;
}

// ============================================
// CUSTOM NODE COMPONENT
// ============================================

function OrgUnitNode({ data }: { data: NodeData }) {
  const { orgUnit } = data;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="min-w-[200px] max-w-[280px] rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-3 border-b bg-muted/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm truncate">{orgUnit.name}</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{orgUnit.code}</span>
        </div>
        <div className="p-3 space-y-2">
          {orgUnit.manager_name && (
            <div className="flex items-center gap-2 text-xs">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{orgUnit.manager_name}</span>
            </div>
          )}
          {orgUnit.department_name && (
            <div className="flex items-center gap-2 text-xs">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="truncate text-muted-foreground">{orgUnit.department_name}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{orgUnit.employee_count || 0}</span>
            </div>
            <Badge
              variant={orgUnit.is_active ? 'default' : 'secondary'}
              className="text-xs px-1.5 py-0"
            >
              {orgUnit.is_active ? 'Attivo' : 'Inattivo'}
            </Badge>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </>
  );
}

// ============================================
// LAYOUT CALCULATION
// ============================================

function calculateLayout(orgUnits: OrgUnit[]): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  // Build parent-child relationship map
  const childrenMap = new Map<string | null, OrgUnit[]>();
  orgUnits.forEach((unit) => {
    const parentId = unit.parent_id || null;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(unit);
  });

  // Sort children by sort_order
  childrenMap.forEach((children) => {
    children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  });

  // Calculate positions using BFS with level-based layout
  const nodeWidth = 240;
  const nodeHeight = 120;
  const horizontalGap = 40;
  const verticalGap = 80;

  // Track positions per level for centering
  const levelWidths: number[] = [];
  const levelNodes: Map<number, OrgUnit[]> = new Map();

  // First pass: assign levels
  const unitLevels = new Map<string, number>();
  const queue: { unit: OrgUnit; level: number }[] = [];

  // Start with root nodes (no parent)
  const rootUnits = childrenMap.get(null) || [];
  rootUnits.forEach((unit) => {
    queue.push({ unit, level: 0 });
    unitLevels.set(unit.id, 0);
  });

  while (queue.length > 0) {
    const { unit, level } = queue.shift()!;

    if (!levelNodes.has(level)) {
      levelNodes.set(level, []);
    }
    levelNodes.get(level)!.push(unit);

    const children = childrenMap.get(unit.id) || [];
    children.forEach((child) => {
      queue.push({ unit: child, level: level + 1 });
      unitLevels.set(child.id, level + 1);
    });
  }

  // Calculate level widths
  levelNodes.forEach((units, level) => {
    levelWidths[level] = units.length * nodeWidth + (units.length - 1) * horizontalGap;
  });

  const maxWidth = Math.max(...levelWidths, 0);

  // Second pass: create nodes with centered positions
  levelNodes.forEach((units, level) => {
    const levelWidth = levelWidths[level];
    const startX = (maxWidth - levelWidth) / 2;

    units.forEach((unit, index) => {
      const x = startX + index * (nodeWidth + horizontalGap);
      const y = level * (nodeHeight + verticalGap);

      nodes.push({
        id: unit.id,
        type: 'orgUnit',
        position: { x, y },
        data: { orgUnit: unit, label: unit.name },
      });

      // Create edge to parent
      if (unit.parent_id) {
        edges.push({
          id: `${unit.parent_id}-${unit.id}`,
          source: unit.parent_id,
          target: unit.id,
          type: 'smoothstep',
          style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
          animated: false,
        });
      }
    });
  });

  return { nodes, edges };
}

// ============================================
// ORG CHART COMPONENT
// ============================================

const nodeTypes = {
  orgUnit: OrgUnitNode,
};

export function OrgChart({ orgUnits, onNodeClick, height = 600 }: OrgChartProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => calculateLayout(orgUnits),
    [orgUnits]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<NodeData>) => {
      if (onNodeClick && node.data?.orgUnit) {
        onNodeClick(node.data.orgUnit);
      }
    },
    [onNodeClick]
  );

  if (orgUnits.length === 0) {
    return (
      <div
        className="flex items-center justify-center border rounded-lg bg-muted/20"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nessuna unità organizzativa trovata</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ height }}
      className="border rounded-lg overflow-hidden"
      role="img"
      aria-label={`Organigramma con ${orgUnits.length} unita organizzative`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as NodeData;
            return data?.orgUnit?.is_active ? 'hsl(var(--primary))' : 'hsl(var(--muted))';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
