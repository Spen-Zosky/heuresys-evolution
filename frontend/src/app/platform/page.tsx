'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Building2,
  Users,
  Database,
  RefreshCw,
  AlertCircle,
  Target,
  GraduationCap,
  Shield,
  ChevronRight,
  Layers,
  MapPin,
  Wallet,
  GitBranch,
  BookOpen,
  Award,
  Brain,
  ClipboardCheck,
  MessageSquare,
  Activity,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================================================
// Types
// ============================================================================

interface TenantData {
  id: string;
  name: string;
  code: string;
  status: string;
  employees: number;
  departments: number;
  org_units: number;
  cost_centers: number;
  locations: number;
  goals: number;
  courses: number;
  users: number;
}

interface PlatformDashboardData {
  tenants: TenantData[];
  usersByRole: Array<{ role: string; count: number }>;
  structure: {
    total_employees: number;
    total_org_units: number;
    total_cost_centers: number;
    total_locations: number;
    total_tenants: number;
    total_users: number;
  };
  catalogs: {
    total_courses: number;
    total_enrollments: number;
    completed_enrollments: number;
    total_learning_paths: number;
    total_certifications: number;
    total_employee_skills: number;
    esco_skills: number;
    onet_skills: number;
  };
  performance: {
    total_goals: number;
    completed_goals: number;
    in_progress_goals: number;
    total_reviews: number;
    completed_reviews: number;
    total_checkins: number;
  };
  database: {
    db_size: string;
    total_tables: number;
    total_views: number;
    active_connections: number;
    extensions: number;
    rls_policies: number;
  };
  dataCoverage: Array<{
    tenant: string;
    contracts: number;
    documents: number;
    reviews: number;
    checkins: number;
    enrollments: number;
    skills: number;
  }>;
}

// ============================================================================
// Component
// ============================================================================

export default function PlatformDashboardPage() {
  const t = useTranslations('platform');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [health, setHealth] = useState<{
    error_rate_1h: number;
    errors_1h: number;
    total_requests_1h: number;
    db_connections: number;
    db_connections_max: number;
    memory_used_mb: number;
    node_uptime_seconds: number;
  } | null>(null);
  const [operationalAlerts, setOperationalAlerts] = useState<
    Array<{ type: string; code: string; message: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, healthRes, alertsRes] = await Promise.allSettled([
        apiClient.get<{ success: boolean; data: PlatformDashboardData }>(
          '/api/v1/platform/dashboard'
        ),
        apiClient.get<{
          success: boolean;
          data: {
            error_rate_1h: number;
            errors_1h: number;
            total_requests_1h: number;
            db_connections: number;
            db_connections_max: number;
            memory_used_mb: number;
            node_uptime_seconds: number;
          };
        }>('/api/v1/platform/health-status'),
        apiClient.get<{
          success: boolean;
          data: { alerts: Array<{ type: string; code: string; message: string }> };
        }>('/api/v1/platform/operational-alerts'),
      ]);

      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value.data);
      } else {
        setError(
          dashRes.reason instanceof Error ? dashRes.reason.message : 'Errore nel caricamento'
        );
      }

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value.data);
      } else {
        setHealth(null);
      }

      if (alertsRes.status === 'fulfilled') {
        setOperationalAlerts(alertsRes.value.data?.alerts || []);
      } else {
        setOperationalAlerts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {tCommon('refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data?.structure;
  const db = data?.database;
  const cat = data?.catalogs;
  const perf = data?.performance;

  const kpis = [
    { label: 'Tenant Attivi', value: s?.total_tenants ?? '-', icon: Building2 },
    { label: 'Utenti Piattaforma', value: s?.total_users ?? '-', icon: Users },
    { label: 'Dipendenti Totali', value: s?.total_employees ?? '-', icon: Users },
    { label: 'Obiettivi Attivi', value: perf?.in_progress_goals ?? '-', icon: Target },
  ];

  const structureItems = [
    { label: 'Centri di Costo', value: s?.total_cost_centers ?? 0, icon: Wallet },
    { label: 'Sedi', value: s?.total_locations ?? 0, icon: MapPin },
  ];

  // TODO: convert to /api/v1/config/roles when role color API returns className compatible with bg-* usage
  const roleColors: Record<string, string> = {
    SUPERUSER: 'bg-red-500',
    TENANT_OWNER: 'bg-orange-500',
    HR: 'bg-blue-500',
    DEMO: 'bg-gray-400',
    USER: 'bg-green-500',
  };

  // Helper: format uptime seconds to "Xg Yh Zm"
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}g`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
  };

  const connPct = health
    ? Math.round((health.db_connections / health.db_connections_max) * 100)
    : 0;

  const quickLinks = [
    { label: 'Crea Tenant', href: '/platform/tenants', icon: Building2 },
    { label: 'Invita Utente', href: '/platform/users', icon: Users },
    { label: 'Ultimi Errori', href: '/platform/security', icon: Shield },
    { label: 'Stato Database', href: '/platform/database', icon: Database },
    { label: 'Blueprint', href: '/platform/panoramica', icon: Compass },
  ];

  const tenantComparisonHeaders = [
    'Tenant',
    'Dipendenti',
    'Dipartimenti',
    'Org Units',
    'Centri Costo',
    'Sedi',
    'Obiettivi',
    'Corsi',
    'Utenti',
  ];

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} title={tCommon('refresh')}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </motion.div>

      {/* Operational Alerts Banner */}
      {operationalAlerts.length > 0 && (
        <motion.div variants={staggerItem} className="space-y-2">
          {operationalAlerts.map((alert) => (
            <div
              key={alert.code}
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                alert.type === 'critical'
                  ? 'bg-destructive/10 border-destructive/20 text-destructive'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{alert.message}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Section 1: KPI Cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{kpi.label}</div>
                  {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <div className="text-2xl font-bold">{kpi.value}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Section 2: Tenant Comparison Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Confronto Tenant
            </CardTitle>
            <CardDescription>Metriche strutturali per ciascun tenant</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {tenantComparisonHeaders.map((h) => (
                        <th
                          key={h}
                          className="text-left py-2 px-3 font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.tenants.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={t.status === 'active' ? 'default' : 'secondary'}
                              className="text-[10px] px-1.5"
                            >
                              {t.status === 'active' ? 'ON' : 'OFF'}
                            </Badge>
                            <span className="font-medium">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold">{t.employees}</td>
                        <td className="py-2.5 px-3 font-mono">{t.departments}</td>
                        <td className="py-2.5 px-3 font-mono">{t.org_units}</td>
                        <td className="py-2.5 px-3 font-mono">{t.cost_centers}</td>
                        <td className="py-2.5 px-3 font-mono">{t.locations}</td>
                        <td className="py-2.5 px-3 font-mono">{t.goals}</td>
                        <td className="py-2.5 px-3 font-mono">{t.courses}</td>
                        <td className="py-2.5 px-3 font-mono">{t.users}</td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-muted/50 font-semibold">
                      <td className="py-2.5 px-3">Totale</td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.employees, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.departments, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.org_units, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.cost_centers, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.locations, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.goals, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.courses, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {data?.tenants.reduce((s, t) => s + t.users, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 3: Structure + Users by Role */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Structural Entities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Struttura Organizzativa
            </CardTitle>
            <CardDescription>Entita strutturali cross-tenant</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {structureItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="text-lg font-semibold font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users by Role */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Utenti per Ruolo
            </CardTitle>
            <CardDescription>{s?.total_users ?? 0} utenti totali</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {data?.usersByRole.map((r) => {
                  const total = s?.total_users || 1;
                  const pct = Math.round((r.count / total) * 100);
                  return (
                    <div key={r.role} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${roleColors[r.role] || 'bg-gray-300'}`}
                          />
                          <span>{r.role}</span>
                        </div>
                        <span className="font-mono font-semibold">
                          {r.count}{' '}
                          <span className="text-muted-foreground font-normal text-xs">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${roleColors[r.role] || 'bg-gray-300'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 4: Catalogs + Performance */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Catalogs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Cataloghi e Tassonomie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Corsi', value: cat?.total_courses ?? 0, icon: GraduationCap },
                  {
                    label: 'Iscrizioni',
                    value: cat?.total_enrollments ?? 0,
                    sub: `${cat?.completed_enrollments ?? 0} completate`,
                  },
                  { label: 'Learning Paths', value: cat?.total_learning_paths ?? 0 },
                  { label: 'Certificazioni', value: cat?.total_certifications ?? 0, icon: Award },
                  {
                    label: 'Skills Dipendenti',
                    value: cat?.total_employee_skills ?? 0,
                    icon: Brain,
                  },
                  { label: 'ESCO Skills', value: cat?.esco_skills ?? 0 },
                  { label: 'O*NET Skills', value: cat?.onet_skills ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="p-2 rounded-lg border border-border/50">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="text-lg font-semibold font-mono">{item.value}</div>
                    {item.sub && (
                      <div className="text-[10px] text-muted-foreground">{item.sub}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance & Goals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Performance e Obiettivi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  {
                    label: 'Obiettivi',
                    total: perf?.total_goals ?? 0,
                    detail: `${perf?.completed_goals ?? 0} completati, ${perf?.in_progress_goals ?? 0} in corso`,
                    pct:
                      perf && perf.total_goals > 0
                        ? Math.round((perf.completed_goals / perf.total_goals) * 100)
                        : 0,
                    icon: Target,
                  },
                  {
                    label: 'Valutazioni',
                    total: perf?.total_reviews ?? 0,
                    detail: `${perf?.completed_reviews ?? 0} completate`,
                    pct:
                      perf && perf.total_reviews > 0
                        ? Math.round((perf.completed_reviews / perf.total_reviews) * 100)
                        : 0,
                    icon: ClipboardCheck,
                  },
                  {
                    label: 'Check-in',
                    total: perf?.total_checkins ?? 0,
                    detail: 'conversazioni registrate',
                    icon: MessageSquare,
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </div>
                      <span className="font-mono font-semibold">
                        {item.total.toLocaleString('it-IT')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                    {item.pct !== undefined && (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* System Health */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Error Rate */}
                <div className="p-3 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Error Rate (1h)</div>
                  <div
                    className={`text-xl font-semibold font-mono ${
                      health && health.error_rate_1h > 5 ? 'text-destructive' : ''
                    }`}
                  >
                    {health ? `${health.error_rate_1h}%` : 'N/D'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {health
                      ? `${health.errors_1h} err / ${health.total_requests_1h} req`
                      : 'Non disponibile'}
                  </div>
                </div>

                {/* DB Connections */}
                <div className="p-3 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Connessioni DB</div>
                  <div
                    className={`text-xl font-semibold font-mono ${
                      connPct > 80 ? 'text-amber-500' : ''
                    }`}
                  >
                    {health ? `${health.db_connections}/${health.db_connections_max}` : 'N/D'}
                  </div>
                  {health && (
                    <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          connPct > 80 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(connPct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Memory */}
                <div className="p-3 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Memoria (RSS)</div>
                  <div className="text-xl font-semibold font-mono">
                    {health ? `${health.memory_used_mb} MB` : 'N/D'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Node.js process</div>
                </div>

                {/* Uptime */}
                <div className="p-3 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground">Node Uptime</div>
                  <div className="text-xl font-semibold font-mono">
                    {health ? formatUptime(health.node_uptime_seconds) : 'N/D'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">API Gateway</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 5: Database Health + Data Coverage */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Database Health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {[
                  { label: 'Dimensione', value: db?.db_size ?? '-' },
                  { label: 'Tabelle', value: db?.total_tables ?? 0 },
                  { label: 'Viste', value: db?.total_views ?? 0 },
                  { label: 'Policy RLS', value: db?.rls_policies ?? 0 },
                  { label: 'Estensioni', value: db?.extensions ?? 0 },
                  { label: 'Connessioni Attive', value: db?.active_connections ?? 0 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Coverage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Copertura Dati per Tenant
            </CardTitle>
            <CardDescription>Record nelle tabelle operative chiave</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {[
                        'Tenant',
                        'Contratti',
                        'Documenti',
                        'Reviews',
                        'Check-in',
                        'Iscrizioni',
                        'Skills',
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left py-1.5 px-2 font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.dataCoverage.map((dc) => (
                      <tr key={dc.tenant} className="border-b border-border/30">
                        <td className="py-1.5 px-2 font-medium">{dc.tenant}</td>
                        {[
                          dc.contracts,
                          dc.documents,
                          dc.reviews,
                          dc.checkins,
                          dc.enrollments,
                          dc.skills,
                        ].map((v, i) => (
                          <td
                            key={i}
                            className={`py-1.5 px-2 font-mono ${v === 0 ? 'text-destructive' : ''}`}
                          >
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 6: Quick Links */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Azioni Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all group"
                >
                  <link.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm">{link.label}</span>
                  <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground/50" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
