'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import {
  Network,
  ChevronRight,
  ChevronDown,
  Users,
  Building2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrgUnit {
  id: string;
  name: string;
  code?: string;
  parent_id?: string | null;
  org_level?: number;
  employee_count?: number;
  children?: OrgUnit[];
}

function TreeNode({ node, depth = 0 }: { node: OrgUnit; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {hasChildren ? (
            <Building2 className="h-4 w-4 text-primary" />
          ) : (
            <Users className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm text-foreground truncate block">{node.name}</span>
          {node.code && <span className="text-xs text-muted-foreground">{node.code}</span>}
        </div>
        {node.employee_count !== undefined && node.employee_count > 0 && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {node.employee_count} dip.
          </Badge>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildTree(units: OrgUnit[]): OrgUnit[] {
  const map = new Map<string, OrgUnit>();
  const roots: OrgUnit[] = [];

  units.forEach((u) => map.set(u.id, { ...u, children: [] }));

  units.forEach((u) => {
    const node = map.get(u.id)!;
    if (u.parent_id && map.has(u.parent_id)) {
      map.get(u.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default function HierarchyPage() {
  const t = useTranslations('companyPet');
  const [tree, setTree] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalEmployees, setTotalEmployees] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitsRes, dashRes] = await Promise.allSettled([
        apiClient.get<{ data: OrgUnit[] | { org_units?: OrgUnit[] } }>('/api/v1/org-units'),
        apiClient.get<{ data: { summary?: { total_employees?: number } } }>(
          '/api/v1/analytics/dashboard'
        ),
      ]);
      const unitsRaw = unitsRes.status === 'fulfilled' ? unitsRes.value?.data : null;
      const units = Array.isArray(unitsRaw)
        ? unitsRaw
        : ((unitsRaw as { org_units?: OrgUnit[] } | null)?.org_units ?? []);
      setTotalUnits(units.length);
      setTree(buildTree(units));
      if (dashRes.status === 'fulfilled') {
        setTotalEmployees(dashRes.value?.data?.summary?.total_employees ?? null);
      }
      if (unitsRes.status === 'rejected') {
        throw unitsRes.reason;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('hierarchy.title')} description={t('hierarchy.description')} />
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Gerarchia Organizzativa"
        description="Struttura ad albero dell'organizzazione"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Network className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{loading ? '-' : totalUnits}</p>
                <p className="text-xs text-muted-foreground">{t('hierarchy.orgUnits')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{loading ? '-' : tree.length}</p>
                <p className="text-xs text-muted-foreground">{t('hierarchy.rootNodes')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '-' : totalEmployees != null ? totalEmployees.toLocaleString() : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('hierarchy.distributedEmployees')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            {t('hierarchy.title')}
          </CardTitle>
          <CardDescription>{t('hierarchy.expandCollapseHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{ paddingLeft: `${(i % 3) * 24 + 12}px` }}
                >
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Network className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{t('hierarchy.noOrgUnitsFound')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
