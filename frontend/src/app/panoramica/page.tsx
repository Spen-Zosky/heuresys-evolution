'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Users,
  Sparkles,
  Compass,
  Globe,
  ExternalLink,
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
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, PageSection } from '@/components/ui/page-header';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { apiClient } from '@/lib/api';
import { useAuth, AuthProvider } from '@/lib/hooks/use-auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageStatus = 'active' | 'redirect' | 'legacy' | 'experimental';

interface PageEntry {
  path: string;
  name: string;
  desc: string;
  tags: string[];
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

const sections: SectionDef[] = [
  {
    title: 'Platform Dashboard',
    desc: 'Gestione piattaforma globale — tenant, utenti, database, sicurezza',
    color: 'bg-blue-500/10 text-blue-600',
    icon: LayoutDashboard,
    pages: [
      {
        path: '/platform',
        name: 'Platform Dashboard',
        desc: 'KPI piattaforma, lista tenant, stato DB',
        tags: ['tenants', 'users', 'employees'],
        status: 'active',
      },
      {
        path: '/platform/tenants',
        name: 'Tenants',
        desc: 'Gestione tenant',
        tags: ['tenants'],
        status: 'active',
      },
      {
        path: '/platform/users',
        name: 'Users',
        desc: 'Utenti piattaforma',
        tags: ['users', 'role_permissions', 'permissions'],
        status: 'active',
      },
      {
        path: '/platform/database',
        name: 'Database',
        desc: 'Stato e metriche database',
        tags: ['audit_logs', 'error_logs'],
        status: 'active',
      },
      {
        path: '/platform/security',
        name: 'Security',
        desc: 'Sicurezza piattaforma',
        tags: ['audit_logs', 'login_attempts', 'sso'],
        status: 'active',
      },
      {
        path: '/platform/settings',
        name: 'Settings',
        desc: 'Impostazioni piattaforma',
        tags: ['service_config', 'platform_features', 'feature_modules'],
        status: 'active',
      },
    ],
  },
  {
    title: 'Company PET Analytics',
    desc: 'Hub analitico organizzativo — struttura, costi, workforce, scenari',
    color: 'bg-purple-500/10 text-purple-600',
    icon: Building2,
    pages: [
      {
        path: '/company-pet',
        name: 'Company PET Hub',
        desc: 'Hub centrale (7 sezioni)',
        tags: ['departments', 'org_units', 'employees', 'cost_centers', 'locations'],
        status: 'active',
      },
      {
        path: '/company-pet/breakdowns',
        name: 'Cost Breakdowns',
        desc: 'Analisi costi HR, dipartimenti, centri di costo',
        tags: ['cost_centers', 'departments', 'salary_bands', 'salary_history'],
        status: 'active',
      },
      {
        path: '/company-pet/hierarchy',
        name: 'Organization Hierarchy',
        desc: 'Struttura organizzativa ad albero — unità organizzative (47)',
        tags: ['org_units', 'org_levels', 'org_areas'],
        status: 'active',
      },
      {
        path: '/company-pet/org-chart',
        name: 'Org Chart',
        desc: 'Organigramma interattivo — duplicato di /admin/org-chart',
        tags: ['departments', 'org_units', 'tenant_org_charts', 'org_chart_snapshots'],
        status: 'legacy',
      },
      {
        path: '/company-pet/organization',
        name: 'Organization Overview',
        desc: 'Hub analytics, performance, talent pool',
        tags: ['employees', 'departments', 'goals', 'performance_reviews'],
        status: 'active',
      },
      {
        path: '/company-pet/organization/analytics',
        name: 'Org Analytics',
        desc: 'KPI organizzazione e trend',
        tags: ['analytics_aggregations', 'analytics_events', 'employees'],
        status: 'active',
      },
      {
        path: '/company-pet/organization/performance',
        name: 'Org Performance',
        desc: 'Performance aggregata, obiettivi, valutazioni',
        tags: ['performance_reviews', 'goals', 'check_ins', 'okrs'],
        status: 'active',
      },
      {
        path: '/company-pet/organization/talent',
        name: 'Org Talent',
        desc: 'Pool talenti, gap competenze, piani successione',
        tags: ['talent_pools', 'succession_plans', 'skill_gap_analyses'],
        status: 'active',
      },
      {
        path: '/company-pet/workforce',
        name: 'Workforce Analytics',
        desc: 'Hub analytics forza lavoro',
        tags: ['employees', 'workforce_plans', 'workforce_plan_scenarios'],
        status: 'active',
      },
      {
        path: '/company-pet/workforce/demographics',
        name: 'Demographics',
        desc: 'Età, genere, seniority, contratti',
        tags: ['employees', 'contracts', 'employee_contracts'],
        status: 'active',
      },
      {
        path: '/company-pet/workforce/locations',
        name: 'Locations',
        desc: 'Distribuzione geografica — sedi (32)',
        tags: ['locations', 'employees'],
        status: 'active',
      },
      {
        path: '/company-pet/sessions',
        name: 'Analysis Sessions',
        desc: 'Sessioni di analisi PET e storico',
        tags: ['prototype_generation_sessions', 'org_chart_generation_sessions'],
        status: 'experimental',
      },
      {
        path: '/company-pet/staging-comparison',
        name: 'Staging Comparison',
        desc: 'Confronto side-by-side scenari organizzativi',
        tags: ['employees_staging', 'workforce_plan_scenarios'],
        status: 'experimental',
      },
    ],
  },
  {
    title: 'Dashboards Hub',
    desc: 'Prototipazione dashboard e esplorazione tassonomie ESCO/NACE',
    color: 'bg-cyan-500/10 text-cyan-600',
    icon: Globe,
    pages: [
      {
        path: '/dashboards',
        name: 'Dashboards Hub',
        desc: 'Hub con link alle sotto-dashboard',
        tags: ['dashboards', 'dashboard_widgets'],
        status: 'active',
      },
      {
        path: '/dashboards/taxonomies',
        name: 'Taxonomy Explorer',
        desc: 'Ricerca ESCO (skills, occupazioni) + NACE (attività economiche)',
        tags: [
          'esco_skills',
          'esco_occupations',
          'esco_skill_groups',
          'esco_isco_groups',
          'nace_sections',
          'nace_divisions',
          'nace_groups',
          'ateco_codes',
        ],
        status: 'active',
      },
      {
        path: '/dashboards/prototyping',
        name: 'Dashboard Prototyping',
        desc: 'Prototipazione dashboard con widget configurabili',
        tags: ['dashboards', 'dashboard_widgets', 'widget_templates'],
        status: 'experimental',
      },
    ],
  },
  {
    title: 'HR Core Management',
    desc: 'Gestione CRUD — le sotto-pagine sono redirect alle pagine admin standalone',
    color: 'bg-green-500/10 text-green-600',
    icon: Users,
    pages: [
      {
        path: '/admin/hr-core',
        name: 'HR Core Hub',
        desc: 'Hub navigazione HR core — pagina indice',
        tags: ['employees', 'departments', 'org_units', 'locations', 'cost_centers'],
        status: 'active',
      },
      {
        path: '/admin/hr-core/employees',
        name: 'Employees',
        desc: 'Redirect a /admin/employees',
        tags: ['employees'],
        status: 'redirect',
        redirectTo: '/admin/employees',
      },
      {
        path: '/admin/hr-core/departments',
        name: 'OrgUnits',
        desc: 'Redirect a /admin/org-units',
        tags: ['departments'],
        status: 'redirect',
        redirectTo: '/admin/org-units',
      },
      {
        path: '/admin/hr-core/org-units',
        name: 'Org Units',
        desc: 'Redirect a /admin/org-units',
        tags: ['org_units'],
        status: 'redirect',
        redirectTo: '/admin/org-units',
      },
      {
        path: '/admin/hr-core/locations',
        name: 'Locations',
        desc: 'Redirect a /admin/locations',
        tags: ['locations'],
        status: 'redirect',
        redirectTo: '/admin/locations',
      },
      {
        path: '/admin/hr-core/cost-centers',
        name: 'Cost Centers',
        desc: 'Redirect a /admin/cost-centers',
        tags: ['cost_centers'],
        status: 'redirect',
        redirectTo: '/admin/cost-centers',
      },
    ],
  },
  {
    title: 'Talent Management',
    desc: 'Skills, ESCO explorer, profili competenza, career paths, succession planning',
    color: 'bg-orange-500/10 text-orange-600',
    icon: Sparkles,
    pages: [
      {
        path: '/admin/talent',
        name: 'Talent Hub',
        desc: 'Hub talent management (9 sezioni)',
        tags: ['skill', 'talent', 'career', 'succession', 'esco'],
        status: 'active',
      },
      {
        path: '/admin/talent/skills',
        name: 'Skills',
        desc: 'Redirect a /admin/skills',
        tags: ['esco_skills', 'employee_skills'],
        status: 'redirect',
        redirectTo: '/admin/skills',
      },
      {
        path: '/admin/talent/esco-explorer',
        name: 'ESCO Explorer',
        desc: 'Browser ESCO — skills, competenze, occupazioni',
        tags: [
          'esco_skills',
          'esco_occupations',
          'esco_occupation_skills',
          'esco_skill_groups',
          'esco_skill_relations',
          'esco_isco_groups',
        ],
        status: 'active',
      },
      {
        path: '/admin/talent/skill-profiles',
        name: 'Skill Profiles',
        desc: 'Profili competenza per ruolo',
        tags: [
          'employee_skill_profiles',
          'employee_skill_assessments',
          'employee_skill_mappings',
          'role_skill_requirements',
          'position_skill_requirements',
        ],
        status: 'active',
      },
      {
        path: '/admin/talent/gap-analysis',
        name: 'Gap Analysis',
        desc: 'Gap analysis tra competenze attuali e richieste',
        tags: [
          'skill_gap_analyses',
          'skill_gap_snapshots',
          'skill_demand_metrics',
          'skill_supply_metrics',
        ],
        status: 'active',
      },
      {
        path: '/admin/talent/career-paths',
        name: 'Career Paths',
        desc: 'Percorsi di carriera e progressioni',
        tags: [
          'career_paths',
          'career_path_levels',
          'career_path_level_skills',
          'career_path_templates',
          'career_path_recommendations',
          'employee_career_paths',
          'career_profiles',
        ],
        status: 'active',
      },
      {
        path: '/admin/talent/assessments',
        name: 'Assessments',
        desc: 'Valutazioni competenze',
        tags: [
          'employee_skill_assessments',
          'self_reviews',
          'self_assessment_evidence',
          'feedback_360',
        ],
        status: 'active',
      },
      {
        path: '/admin/talent/succession',
        name: 'Succession',
        desc: 'Piani di successione e leadership pipeline',
        tags: [
          'succession_plans',
          'succession_candidates',
          'critical_roles',
          'talent_pools',
          'talent_pool_members',
        ],
        status: 'active',
      },
      {
        path: '/admin/talent/mobility',
        name: 'Internal Mobility',
        desc: 'Opportunità mobilità interna',
        tags: [
          'internal_mobility_postings',
          'internal_mobility_requests',
          'internal_job_postings',
          'internal_applications',
        ],
        status: 'active',
      },
      {
        path: '/admin/talent/pay-stubs',
        name: 'Pay Stubs',
        desc: 'Cedolini e buste paga',
        tags: ['employee_pay_stubs', 'salary_history', 'salary_bands'],
        status: 'active',
      },
    ],
  },
  {
    title: 'Pagine Admin Standalone',
    desc: 'Pagine CRUD principali — le pagine effettive a cui puntano i redirect di HR Core e Talent',
    color: 'bg-rose-500/10 text-rose-600',
    icon: Compass,
    pages: [
      {
        path: '/admin/skills',
        name: 'Skills',
        desc: 'Tassonomia skills e livelli proficiency — pagina primaria',
        tags: ['esco_skills', 'employee_skills', 'skill_classifications'],
        status: 'active',
      },
      {
        path: '/admin/positions',
        name: 'Positions',
        desc: 'Posizioni lavorative',
        tags: ['position_skill_requirements', 'job_families', 'job_templates', 'tenant_jobs'],
        status: 'active',
      },
      {
        path: '/admin/org-chart',
        name: 'Org Chart',
        desc: 'Organigramma interattivo — pagina primaria',
        tags: ['departments', 'org_units', 'tenant_org_charts'],
        status: 'active',
      },
      {
        path: '/admin/org-units',
        name: 'OrgUnits',
        desc: 'Dipartimenti — CRUD con detail/edit/stats',
        tags: ['departments'],
        status: 'active',
      },
      {
        path: '/admin/org-units',
        name: 'Org Units',
        desc: 'Unità organizzative — CRUD con detail/edit',
        tags: ['org_units', 'tenant_org_units'],
        status: 'active',
      },
      {
        path: '/admin/locations',
        name: 'Locations',
        desc: 'Sedi — CRUD con detail/edit',
        tags: ['locations'],
        status: 'active',
      },
      {
        path: '/admin/cost-centers',
        name: 'Cost Centers',
        desc: 'Centri di costo — CRUD con detail/edit',
        tags: ['cost_centers'],
        status: 'active',
      },
      {
        path: '/admin/employees',
        name: 'Employees',
        desc: 'Dipendenti — CRUD con profilo multi-tab (10 tab)',
        tags: ['employees', 'employee_contracts', 'employee_documents', 'employee_skills'],
        status: 'active',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper: check if a page matches a table name
// ---------------------------------------------------------------------------

function pageMatchesTable(page: PageEntry, tableName: string): boolean {
  if (page.tags.includes(tableName)) return true;
  const tableWords = tableName.split('_');
  return page.tags.some((tag) => {
    const tagWords = tag.split('_');
    return tableWords.some(
      (tw) =>
        tw.length > 3 &&
        tagWords.some((tgw) => tgw.length > 3 && (tw.startsWith(tgw) || tgw.startsWith(tw)))
    );
  });
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
// Access is gated by useAuth().hasRole('TENANT_OWNER'): any role whose level
// is <= TENANT_OWNER passes (i.e. SUPERUSER and TENANT_OWNER). This delegates
// to the RBP role hierarchy instead of a hardcoded allow-list (P9).

function PanoramicaContent() {
  const t = useTranslations('dashboards');
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, hasRole } = useAuth();
  const isAllowed = hasRole('TENANT_OWNER');

  const [tables, setTables] = useState<DbTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [statusFilter, setStatusFilter] = useState<PageStatus | 'all'>('all');

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user && !isAllowed) {
        router.replace('/admin');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: DbTable[]; total: number }>(
        '/api/v1/platform/tables'
      );
      setTables(
        (res?.data ?? []).map((t) => ({ name: t.name, row_count: safeRowCount(t.row_count) }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento tabelle');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user && isAllowed) {
      fetchTables();
    }
  }, [fetchTables, isAuthenticated, user]);

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
    if (!tableSearch) return filteredByMode;
    const q = tableSearch.toLowerCase();
    return filteredByMode.filter((t) => t.name.includes(q));
  }, [filteredByMode, tableSearch]);

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
    setSelectedGroup((prev) => (prev === group.prefix ? null : group.prefix));
  }, []);

  // Handle table selection (clears group selection)
  const handleTableSelect = useCallback((tableName: string) => {
    setSelectedGroup(null);
    setSelectedTable((prev) => (prev === tableName ? null : tableName));
  }, []);

  // Clear all filters
  const clearFilter = useCallback(() => {
    setSelectedTable(null);
    setSelectedGroup(null);
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
  }, [selectedTable, selectedGroup, groupedTables, statusFilter]);

  const totalFilteredPages = filteredSections.reduce((sum, s) => sum + s.pages.length, 0);
  const activeFilter = selectedTable || (selectedGroup ? `${selectedGroup}_*` : null);
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

  if (authLoading || !isAuthenticated || !user || !isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
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
          title="Panoramica"
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

        {/* Summary cards — only when no filter */}
        {!activeFilter && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
          >
            {sections.map((s) => (
              <motion.div key={s.title} variants={staggerItem}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`h-8 w-8 rounded-lg ${s.color} flex items-center justify-center`}
                      >
                        <s.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">{s.pages.length}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.title}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
                    <Link href={p.redirectTo ?? p.path}>
                      <Card
                        className={`hover:shadow-md transition-all cursor-pointer group h-full ${
                          p.status === 'legacy'
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
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {p.path}
                            </Badge>
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
                    </Link>
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
  return (
    <AuthProvider>
      <PanoramicaContent />
    </AuthProvider>
  );
}
