'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { OrgUnitBadge } from './OrgUnitBadge';
import { useOrgUnits } from '@/lib/hooks/use-org-queries';
import type { OrgUnit } from '@/lib/api/types';
import { AlertCircle, Building2, ChevronDown, ChevronRight, Search, Users } from 'lucide-react';

const ORG_TYPE_OPTIONS = [
  { value: 'all', label: 'Tutti i tipi' },
  { value: 'company', label: 'Azienda' },
  { value: 'division', label: 'Divisione' },
  { value: 'direction', label: 'Direzione' },
  { value: 'department', label: 'Dipartimento' },
  { value: 'office', label: 'Ufficio' },
  { value: 'unit', label: 'Unità' },
  { value: 'team', label: 'Team' },
  { value: 'group', label: 'Gruppo' },
];

interface TreeNode extends OrgUnit {
  children: TreeNode[];
}

function buildTree(units: OrgUnit[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const unit of units) {
    map.set(unit.id, { ...unit, children: [] });
  }

  for (const unit of units) {
    const node = map.get(unit.id)!;
    const parentId = unit.parent_id || (unit as unknown as { org_unit_id?: string }).org_unit_id;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((n) => ({ ...n, children: sortNodes(n.children) }));
  };

  return sortNodes(roots);
}

function matchesSearch(node: TreeNode, search: string): boolean {
  const lower = search.toLowerCase();
  if (node.name.toLowerCase().includes(lower)) return true;
  if (node.code?.toLowerCase().includes(lower)) return true;
  return node.children.some((child) => matchesSearch(child, lower));
}

function filterTree(nodes: TreeNode[], search: string, orgType: string | null): TreeNode[] {
  return nodes
    .filter((node) => {
      const typeMatch = !orgType || node.org_type === orgType;
      const searchMatch = !search || matchesSearch(node, search);
      return typeMatch && searchMatch;
    })
    .map((node) => ({
      ...node,
      children: filterTree(node.children, search, orgType),
    }));
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

function TreeNodeRow({ node, depth, expanded, onToggle, onSelect }: TreeNodeRowProps) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const headcount = node.employee_count ?? 0;

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors group"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          className="flex items-center justify-center w-5 h-5 shrink-0"
          aria-label={isExpanded ? 'Comprimi' : 'Espandi'}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => onSelect(node.id)}>
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{node.name}</span>
          <OrgUnitBadge orgType={node.org_type || ''} />
          <div className="flex items-center gap-1 text-sm text-muted-foreground ml-auto shrink-0">
            <Users className="h-3.5 w-3.5" />
            <span>{headcount}</span>
          </div>
        </div>
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

export function OrgTree() {
  const router = useRouter();
  const { data: orgUnits, isLoading, isError, refetch } = useOrgUnits({ limit: 500 });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [orgType, setOrgType] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const tree = useMemo(() => {
    if (!orgUnits) return [];
    const full = buildTree(orgUnits);
    if (!search && !orgType) return full;
    return filterTree(full, search, orgType);
  }, [orgUnits, search, orgType]);

  // Auto-expand first level on load
  useEffect(() => {
    if (tree.length > 0 && expanded.size === 0) {
      setExpanded(new Set(tree.map((n) => n.id)));
    }
  }, [tree, expanded.size]);

  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/company-pet/structure/${id}`);
    },
    [router]
  );

  const handleTypeChange = useCallback((value: string) => {
    setOrgType(value === 'all' ? null : value);
  }, []);

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-semibold">Errore nel caricamento delle unita organizzative</p>
              <p className="text-sm text-muted-foreground">Si e' verificato un errore. Riprova.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca unita organizzative..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={orgType || 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {ORG_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tree */}
      <Card>
        <CardContent className="py-2">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{ paddingLeft: `${(i % 3) * 24 + 12}px` }}
                >
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : tree.length > 0 ? (
            <div className="py-1">
              {tree.map((node) => (
                <TreeNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              type="search"
              title="Nessuna unita organizzativa trovata"
              description={
                search || orgType
                  ? 'Prova a modificare i filtri di ricerca.'
                  : 'Non ci sono unita organizzative configurate per questo tenant.'
              }
              action={
                search || orgType
                  ? {
                      label: 'Resetta filtri',
                      onClick: () => {
                        setSearchInput('');
                        setSearch('');
                        setOrgType(null);
                      },
                      variant: 'outline' as const,
                    }
                  : undefined
              }
              size="sm"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
