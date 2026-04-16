'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  LayoutDashboard,
  Building2,
  Users,
  Sparkles,
  Compass,
  Globe,
  ExternalLink,
  GraduationCap,
  Database,
  Search,
  X,
  Table2,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  FolderOpen,
  Folder,
  ArrowUpDown,
  Filter,
  Layers,
  HardDrive,
  Circle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, PageSection } from '@/components/ui/page-header';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageStatus = 'active' | 'redirect' | 'legacy' | 'experimental';

interface TableRelation {
  table_name: string;
  relation_type: 'primary' | 'secondary' | 'read' | 'write' | 'indirect';
  source: string;
  confidence: number;
}

interface PageEntry {
  path: string;
  name: string;
  desc: string;
  tags: string[];
  relations: TableRelation[];
  status?: PageStatus;
  /** Where the redirect points, if status is 'redirect' */
  redirectTo?: string;
}

interface SectionDef {
  title: string;
  desc: string;
  color: string;
  icon: React.ElementType;
  pages: PageEntry[];
}

interface DbTable {
  name: string;
  row_count: number;
}

interface TableGroup {
  prefix: string;
  tables: DbTable[];
  totalRows: number;
  populatedCount: number;
}

type SortMode = 'alpha' | 'rows' | 'populated';
type FilterMode = 'all' | 'populated' | 'empty';

function groupTablesByPrefix(tables: DbTable[]): TableGroup[] {
  const map = new Map<string, DbTable[]>();

  for (const t of tables) {
    const idx = t.name.indexOf('_');
    const prefix = idx > 0 ? t.name.substring(0, idx) : t.name;
    const existing = map.get(prefix);
    if (existing) {
      existing.push(t);
    } else {
      map.set(prefix, [t]);
    }
  }

  return Array.from(map.entries())
    .map(([prefix, groupTables]) => ({
      prefix,
      tables: groupTables,
      totalRows: groupTables.reduce((sum, t) => sum + t.row_count, 0),
      populatedCount: groupTables.filter((t) => t.row_count > 0).length,
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

function safeRowCount(v: unknown): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) return 0;
  return Math.round(n);
}

function formatRowCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Sections data
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PageStatus, { label: string; color: string; badgeClass: string }> = {
  active: {
    label: 'Attiva',
    color: 'text-emerald-600',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  redirect: {
    label: 'Redirect',
    color: 'text-amber-600',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  legacy: {
    label: 'Superata',
    color: 'text-red-500',
    badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  experimental: {
    label: 'Sperimentale',
    color: 'text-blue-500',
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
};

// Icon name → component mapping for DB-driven sections
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  Users,
  Sparkles,
  Compass,
  Globe,
  GraduationCap,
  Database,
};

// ---------------------------------------------------------------------------
// Helper: check if a page matches a table name
// ---------------------------------------------------------------------------

function pageMatchesTable(page: PageEntry, tableName: string): boolean {
  // Primary: use relations from page_table_relations (DB-driven, symmetric)
  if (page.relations && page.relations.length > 0) {
    return page.relations.some((r) => r.table_name === tableName);
  }
  // Fallback: exact tag match (backward compat while tags still exist)
  return page.tags.includes(tableName);
}

// ---------------------------------------------------------------------------
// Density bar component
// ---------------------------------------------------------------------------

function DensityBar({
  value,
  max,
  className = '',
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  if (value === 0) return null;
  return (
    <div className={`h-1 rounded-full bg-muted/50 w-12 ${className}`}>
      <div
        className="h-full rounded-full bg-primary/60 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PanoramicaContent() {
  const router = useRouter();
  const [tables, setTables] = useState<DbTable[]>([]);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageEntry | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [statusFilter, setStatusFilter] = useState<PageStatus | 'all'>('all');

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tablesRes, pagesRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: DbTable[]; total: number }>(
          '/api/v1/platform/tables'
        ),
        apiClient.get<{
          success: boolean;
          data: Array<{
            key: string;
            title: string;
            desc: string | null;
            color: string;
            icon: string;
            pages: PageEntry[];
          }>;
        }>('/api/v1/platform/pages'),
      ]);
      setTables(
        (tablesRes?.data ?? []).map((t) => ({ name: t.name, row_count: safeRowCount(t.row_count) }))
      );
      if (pagesRes?.data) {
        setSections(
          pagesRes.data.map((s) => ({
            title: s.title,
            desc: s.desc || '',
            color: s.color,
            icon: ICON_MAP[s.icon] || Compass,
            pages: s.pages.map((p) => ({
              ...p,
              relations: (p as unknown as Record<string, TableRelation[]>).relations || [],
              status: (p.status as PageStatus) || 'active',
              redirectTo: (p as unknown as Record<string, string>).redirectTo || undefined,
            })),
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento tabelle');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Global stats
  const stats = useMemo(() => {
    const totalRows = tables.reduce((s, t) => s + t.row_count, 0);
    const populated = tables.filter((t) => t.row_count > 0).length;
    const maxRows = Math.max(...tables.map((t) => t.row_count), 1);
    return { totalRows, populated, empty: tables.length - populated, maxRows };
  }, [tables]);

  // Apply filter mode
  const filteredByMode = useMemo(() => {
    if (filterMode === 'populated') return tables.filter((t) => t.row_count > 0);
    if (filterMode === 'empty') return tables.filter((t) => t.row_count === 0);
    return tables;
  }, [tables, filterMode]);

  // Apply search
  const filteredTables = useMemo(() => {
    let result = filteredByMode;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      result = result.filter((t) => t.name.includes(q));
    }
    if (selectedPage) {
      // Use relations for symmetric matching (same data source as table→page)
      const relatedTables =
        selectedPage.relations && selectedPage.relations.length > 0
          ? new Set(selectedPage.relations.map((r) => r.table_name))
          : new Set(selectedPage.tags);
      result = result.filter((t) => relatedTables.has(t.name));
    }
    return result;
  }, [filteredByMode, tableSearch, selectedPage]);

  // Group and sort
  const groupedTables = useMemo(() => {
    const groups = groupTablesByPrefix(filteredTables);

    // Sort within groups
    for (const g of groups) {
      if (sortMode === 'rows') {
        g.tables.sort((a, b) => b.row_count - a.row_count);
      } else if (sortMode === 'populated') {
        g.tables.sort(
          (a, b) =>
            (b.row_count > 0 ? 1 : 0) - (a.row_count > 0 ? 1 : 0) || b.row_count - a.row_count
        );
      }
    }

    // Sort groups
    if (sortMode === 'rows') {
      groups.sort((a, b) => b.totalRows - a.totalRows);
    } else if (sortMode === 'populated') {
      groups.sort((a, b) => b.populatedCount - a.populatedCount || b.totalRows - a.totalRows);
    }

    return groups;
  }, [filteredTables, sortMode]);

  // Auto-expand matching groups when searching
  useEffect(() => {
    if (tableSearch) {
      setExpandedGroups(new Set(groupedTables.map((g) => g.prefix)));
    }
  }, [tableSearch, groupedTables]);

  const toggleGroup = useCallback((prefix: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }, []);

  // Handle group-level selection (filter by all tables in the group)
  const handleGroupSelect = useCallback((group: TableGroup) => {
    setSelectedTable(null);
    setSelectedPage(null);
    setSelectedGroup((prev) => (prev === group.prefix ? null : group.prefix));
  }, []);

  // Handle table selection (clears group and page selection)
  const handleTableSelect = useCallback((tableName: string) => {
    setSelectedGroup(null);
    setSelectedPage(null);
    setSelectedTable((prev) => (prev === tableName ? null : tableName));
  }, []);

  // Handle page selection (filters tables by page tags)
  const handlePageSelect = useCallback((page: PageEntry, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedTable(null);
    setSelectedGroup(null);
    setSelectedPage((prev) => (prev?.path === page.path ? null : page));
  }, []);

  // Clear all filters
  const clearFilter = useCallback(() => {
    setSelectedTable(null);
    setSelectedGroup(null);
    setSelectedPage(null);
  }, []);

  // Filtered sections based on selected table, group, and status
  const filteredSections = useMemo(() => {
    const applyStatusFilter = (pages: PageEntry[]) =>
      statusFilter === 'all' ? pages : pages.filter((p) => (p.status ?? 'active') === statusFilter);

    if (!selectedTable && !selectedGroup) {
      return sections
        .map((s) => ({ ...s, pages: applyStatusFilter(s.pages) }))
        .filter((s) => s.pages.length > 0);
    }

    if (selectedTable) {
      return sections
        .map((s) => ({
          ...s,
          pages: applyStatusFilter(s.pages.filter((p) => pageMatchesTable(p, selectedTable))),
        }))
        .filter((s) => s.pages.length > 0);
    }

    const group = groupedTables.find((g) => g.prefix === selectedGroup);
    if (!group)
      return sections
        .map((s) => ({ ...s, pages: applyStatusFilter(s.pages) }))
        .filter((s) => s.pages.length > 0);

    return sections
      .map((s) => ({
        ...s,
        pages: applyStatusFilter(
          s.pages.filter((p) => group.tables.some((t) => pageMatchesTable(p, t.name)))
        ),
      }))
      .filter((s) => s.pages.length > 0);
  }, [sections, selectedTable, selectedGroup, groupedTables, statusFilter]);

  const totalFilteredPages = filteredSections.reduce((sum, s) => sum + s.pages.length, 0);
  const activeFilter =
    selectedTable ||
    (selectedGroup ? `${selectedGroup}_*` : null) ||
    (selectedPage ? selectedPage.name : null);
  const maxGroupRows = useMemo(
    () => Math.max(...groupedTables.map((g) => g.totalRows), 1),
    [groupedTables]
  );

  const cycleSortMode = useCallback(() => {
    setSortMode((prev) => {
      if (prev === 'alpha') return 'rows';
      if (prev === 'rows') return 'populated';
      return 'alpha';
    });
  }, []);

  const cycleFilterMode = useCallback(() => {
    setFilterMode((prev) => {
      if (prev === 'all') return 'populated';
      if (prev === 'populated') return 'empty';
      return 'all';
    });
  }, []);

  const sortLabel = sortMode === 'alpha' ? 'A-Z' : sortMode === 'rows' ? 'Righe' : 'Popolate';
  const filterLabel =
    filterMode === 'all' ? 'Tutte' : filterMode === 'populated' ? 'Popolate' : 'Vuote';

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="w-80 shrink-0 border-r border-border bg-card overflow-hidden flex flex-col">
        {/* Header with stats */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Tabelle Database</h2>
          </div>

          {/* Stats summary */}
          {!loading && !error && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-lg font-bold text-foreground">{tables.length}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">Tabelle</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                <div className="text-lg font-bold text-emerald-600">{stats.populated}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">Popolate</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-lg font-bold text-foreground">
                  {formatRowCount(stats.totalRows)}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">Righe tot.</div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca tabella..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
            {tableSearch && (
              <button
                onClick={() => setTableSearch('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort + Filter toolbar */}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[11px] gap-1"
              onClick={cycleSortMode}
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortLabel}
            </Button>
            <Button
              variant={filterMode !== 'all' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 h-7 text-[11px] gap-1"
              onClick={cycleFilterMode}
            >
              <Filter className="h-3 w-3" />
              {filterLabel}
            </Button>
          </div>

          {/* Active filter chip */}
          {activeFilter && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 border-primary/30 text-primary"
              onClick={clearFilter}
            >
              <X className="h-3 w-3 mr-1" />
              Filtro: {activeFilter}
            </Button>
          )}
        </div>

        {/* Table tree */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchTables}>
                <RefreshCw className="h-3 w-3 mr-1" /> Riprova
              </Button>
            </div>
          ) : (
            <div className="py-1">
              {groupedTables.map((group) => {
                const isExpanded = expandedGroups.has(group.prefix);
                const isSingle = group.tables.length === 1 && group.tables[0].name === group.prefix;
                const isGroupSelected = selectedGroup === group.prefix;
                const hasSelectedChild = group.tables.some((t) => t.name === selectedTable);
                const hasData = group.totalRows > 0;

                if (isSingle) {
                  const t = group.tables[0];
                  const isPopulated = t.row_count > 0;
                  return (
                    <button
                      key={t.name}
                      onClick={() => handleTableSelect(t.name)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-accent/50 ${
                        selectedTable === t.name
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground/80'
                      }`}
                    >
                      <Circle
                        className={`h-1.5 w-1.5 shrink-0 ${isPopulated ? 'fill-emerald-500 text-emerald-500' : 'fill-muted text-muted'}`}
                      />
                      <span className="truncate font-mono flex-1">{t.name}</span>
                      <DensityBar value={t.row_count} max={stats.maxRows} />
                      <span
                        className={`text-[10px] shrink-0 tabular-nums ${isPopulated ? 'text-foreground/60' : 'text-muted-foreground/40'}`}
                      >
                        {formatRowCount(t.row_count)}
                      </span>
                    </button>
                  );
                }

                return (
                  <div key={group.prefix}>
                    {/* Group header */}
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleGroup(group.prefix)}
                        className={`flex-1 text-left px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors hover:bg-accent/50 ${
                          isGroupSelected
                            ? 'bg-primary/10 text-primary font-medium'
                            : hasSelectedChild
                              ? 'text-primary'
                              : 'text-foreground'
                        }`}
                      >
                        <ChevronRight
                          className={`h-3 w-3 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        {isExpanded ? (
                          <FolderOpen
                            className={`h-3.5 w-3.5 shrink-0 ${hasData ? 'text-emerald-500' : 'text-muted-foreground'}`}
                          />
                        ) : (
                          <Folder
                            className={`h-3.5 w-3.5 shrink-0 ${hasData ? 'text-emerald-500' : 'text-muted-foreground'}`}
                          />
                        )}
                        <span className="font-mono font-medium truncate">{group.prefix}_*</span>
                      </button>

                      {/* Group stats chips */}
                      <button
                        onClick={() => handleGroupSelect(group)}
                        className={`shrink-0 mr-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] transition-colors hover:bg-primary/10 ${
                          isGroupSelected ? 'bg-primary/10 text-primary' : ''
                        }`}
                        title={`Filtra per tutte le ${group.tables.length} tabelle ${group.prefix}_*`}
                      >
                        <span className="flex items-center gap-0.5">
                          <Layers className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="tabular-nums text-muted-foreground">
                            {group.tables.length}
                          </span>
                        </span>
                        {group.totalRows > 0 && (
                          <span className="flex items-center gap-0.5">
                            <HardDrive className="h-2.5 w-2.5 text-emerald-500/70" />
                            <span className="tabular-nums text-emerald-600">
                              {formatRowCount(group.totalRows)}
                            </span>
                          </span>
                        )}
                        <DensityBar value={group.totalRows} max={maxGroupRows} className="w-8" />
                      </button>
                    </div>

                    {/* Expanded children */}
                    {isExpanded && (
                      <div className="border-l border-border/50 ml-[18px]">
                        {group.tables.map((t) => {
                          const isPopulated = t.row_count > 0;
                          return (
                            <button
                              key={t.name}
                              onClick={() => handleTableSelect(t.name)}
                              className={`w-full text-left pl-4 pr-3 py-1 text-xs flex items-center gap-2 transition-colors hover:bg-accent/50 ${
                                selectedTable === t.name
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-foreground/70'
                              }`}
                            >
                              <Circle
                                className={`h-1.5 w-1.5 shrink-0 ${isPopulated ? 'fill-emerald-500 text-emerald-500' : 'fill-muted text-muted'}`}
                              />
                              <span className="truncate font-mono flex-1">
                                {t.name.substring(group.prefix.length + 1) || t.name}
                              </span>
                              <DensityBar value={t.row_count} max={stats.maxRows} />
                              <span
                                className={`text-[10px] shrink-0 tabular-nums ${isPopulated ? 'text-foreground/60' : 'text-muted-foreground/40'}`}
                              >
                                {formatRowCount(t.row_count)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {groupedTables.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Nessuna tabella trovata
                </p>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        <PageHeader
          title="Blueprint"
          description={
            activeFilter
              ? `Pagine correlate a "${activeFilter}" — ${totalFilteredPages} risultati`
              : `Mappa completa delle dashboard e pagine di gestione piattaforma — ${sections.length} sezioni, ${sections.reduce((s, sec) => s + sec.pages.length, 0)} pagine`
          }
        >
          {activeFilter && (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Table2 className="h-3 w-3 mr-1" />
              {activeFilter}
            </Badge>
          )}
        </PageHeader>

        {/* Status filter toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Stato:</span>
          {(['all', 'active', 'redirect', 'legacy', 'experimental'] as const).map((s) => {
            const isActive = statusFilter === s;
            const label = s === 'all' ? 'Tutte' : STATUS_CONFIG[s].label;
            const count =
              s === 'all'
                ? sections.reduce((sum, sec) => sum + sec.pages.length, 0)
                : sections.reduce(
                    (sum, sec) =>
                      sum + sec.pages.filter((p) => (p.status ?? 'active') === s).length,
                    0
                  );
            return (
              <Button
                key={s}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={`h-7 text-[11px] gap-1 ${!isActive && s !== 'all' ? STATUS_CONFIG[s as PageStatus].color : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s !== 'all' && <Circle className={`h-1.5 w-1.5 fill-current`} />}
                {label}
                <span className="text-[10px] opacity-70">({count})</span>
              </Button>
            );
          })}
        </div>

        {/* Status legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" /> <strong>Attiva</strong>{' '}
            = in produzione, funzionante
          </span>
          <span className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-amber-500 text-amber-500" /> <strong>Redirect</strong> =
            rimanda ad altra URL
          </span>
          <span className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-blue-500 text-blue-500" /> <strong>Sperimentale</strong>{' '}
            = dietro feature flag
          </span>
          <span className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-red-500 text-red-500" /> <strong>Superata</strong> =
            deprecata
          </span>
        </div>

        {/* Section distribution chart — reflects active filters */}
        {filteredSections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-xl border bg-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Distribuzione Pagine per Sezione
                </h3>
                <p className="text-xs text-muted-foreground">
                  {filteredSections.length} sezioni,{' '}
                  {filteredSections.reduce((s, sec) => s + sec.pages.length, 0)} pagine
                  {statusFilter !== 'all' ? ` (filtro: ${statusFilter})` : ''}
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320} minWidth={200}>
              <BarChart
                data={filteredSections.map((s) => ({
                  name: s.title,
                  pages: s.pages.length,
                  color: s.color,
                }))}
                margin={{ top: 12, right: 20, left: 4, bottom: 60 }}
                barSize={Math.max(18, Math.min(40, 600 / filteredSections.length))}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-40}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <RechartsTooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.2, radius: 4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const d = payload[0].payload as { name: string; pages: number };
                    return (
                      <div
                        style={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          fontSize: '13px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                          padding: '10px 16px',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
                        <div style={{ color: 'var(--primary)' }}>{d.pages} pagine</div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="pages"
                  radius={[6, 6, 0, 0]}
                  animationDuration={800}
                  animationBegin={200}
                >
                  {filteredSections.map((s) => {
                    const c = s.color;
                    const fill = c.includes('blue')
                      ? '#3b82f6'
                      : c.includes('purple')
                        ? '#8b5cf6'
                        : c.includes('teal')
                          ? '#14b8a6'
                          : c.includes('indigo')
                            ? '#6366f1'
                            : c.includes('cyan')
                              ? '#06b6d4'
                              : c.includes('violet')
                                ? '#7c3aed'
                                : c.includes('amber')
                                  ? '#f59e0b'
                                  : c.includes('rose')
                                    ? '#f43f5e'
                                    : c.includes('emerald')
                                      ? '#10b981'
                                      : c.includes('pink')
                                        ? '#ec4899'
                                        : c.includes('red')
                                          ? '#ef4444'
                                          : c.includes('sky')
                                            ? '#0ea5e9'
                                            : c.includes('orange')
                                              ? '#f97316'
                                              : c.includes('green')
                                                ? '#22c55e'
                                                : c.includes('gray') || c.includes('slate')
                                                  ? '#64748b'
                                                  : '#6366f1';
                    return (
                      <Cell
                        key={s.title}
                        fill={fill}
                        fillOpacity={0.9}
                        className="cursor-pointer"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Sections */}
        {filteredSections.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-foreground mb-1">Nessuna pagina correlata</h3>
              <p className="text-sm text-muted-foreground">
                Nessuna pagina frontend corrisponde a &quot;{activeFilter}&quot;.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilter}>
                Mostra tutte le pagine
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredSections.map((s) => (
            <PageSection key={s.title} title={s.title} description={s.desc}>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {s.pages.map((p) => (
                  <motion.div key={p.path} variants={staggerItem}>
                    <div
                      onClick={(e) => handlePageSelect(p, e)}
                      onDoubleClick={() => router.push(p.redirectTo ?? p.path)}
                    >
                      <Card
                        className={`hover:shadow-md transition-all cursor-pointer group h-full ${
                          selectedPage?.path === p.path
                            ? 'ring-2 ring-primary border-primary shadow-md'
                            : p.status === 'legacy'
                              ? 'opacity-60 border-red-500/20 hover:border-red-500/40'
                              : p.status === 'redirect'
                                ? 'opacity-75 border-amber-500/20 hover:border-amber-500/40'
                                : p.status === 'experimental'
                                  ? 'border-blue-500/20 hover:border-blue-500/40'
                                  : 'hover:border-primary/20'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3
                                  className={`font-medium text-sm transition-colors ${
                                    p.status === 'legacy'
                                      ? 'text-muted-foreground line-through group-hover:text-red-500'
                                      : 'text-foreground group-hover:text-primary'
                                  }`}
                                >
                                  {p.name}
                                </h3>
                                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {p.desc}
                              </p>
                            </div>
                            {p.status && p.status !== 'active' && (
                              <Badge
                                className={`text-[10px] shrink-0 ${STATUS_CONFIG[p.status].badgeClass}`}
                              >
                                {STATUS_CONFIG[p.status].label}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1 items-center">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {p.path}
                            </Badge>
                            <Link
                              href={p.redirectTo ?? p.path}
                              className="text-[10px] text-primary hover:underline ml-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Apri →
                            </Link>
                            {p.redirectTo && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono text-amber-600 border-amber-500/30"
                              >
                                &rarr; {p.redirectTo}
                              </Badge>
                            )}
                            {activeFilter &&
                              p.tags
                                .filter(
                                  (tag) =>
                                    tag === (selectedTable || '') ||
                                    tag.includes((selectedTable || '').replace(/s$/, '')) ||
                                    (selectedTable || '').includes(tag.replace(/s$/, '')) ||
                                    (selectedGroup && tag.startsWith(selectedGroup + '_'))
                                )
                                .slice(0, 3)
                                .map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-[10px] font-mono"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </PageSection>
          ))
        )}
      </main>
    </div>
  );
}

export default function PanoramicaPage() {
  const t = useTranslations('platform');
  const router = useRouter();
  return <PanoramicaContent />;
}
