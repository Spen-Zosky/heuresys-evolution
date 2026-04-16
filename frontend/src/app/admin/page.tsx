'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Users,
  TrendingDown,
  UserPlus,
  Heart,
  RefreshCw,
  AlertCircle,
  X,
  Filter,
  Target,
  GraduationCap,
  Star,
  Building2,
  ChevronRight,
  Clock,
  CheckCircle2,
  TrendingUp as TrendUp,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/ui/kpi-card';
import { EmptyState, SuccessEmptyState } from '@/components/ui/empty-state';
import {
  useDashboard,
  getSparklineValues,
  calculateTrendFromSparkline,
  TrendPoint,
} from '@/lib/hooks/use-dashboard';
import { TimeRangeSelector, useTimeRange } from '@/components/dashboard/time-range-selector';
import { ChartTooltip } from '@/components/dashboard/chart-tooltip';
import { HeadcountTrendChart } from '@/components/dashboard/headcount-trend-chart';
import { TurnoverDepartmentChart } from '@/components/dashboard/turnover-org-unit-chart';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { BaseRadarChart } from '@/components/charts/base-radar-chart';
import { GaugeChart } from '@/components/charts';

// ============================================================================
// Types for Chart Filters
// ============================================================================
interface ChartFilter {
  type: 'department' | 'date';
  value: string;
  label: string;
}

/**
 * Admin HR Dashboard
 * Displays key HR metrics with real API data
 */
export default function AdminDashboardPage() {
  const tCommon = useTranslations('common');
  const { range, setRange, currentOption } = useTimeRange('30d');
  const { data, loading, error, refetch } = useDashboard(range);

  // Chart filter state
  const [activeFilters, setActiveFilters] = useState<ChartFilter[]>([]);

  // Add a filter
  const addFilter = useCallback((filter: ChartFilter) => {
    setActiveFilters((prev) => {
      // Replace existing filter of same type
      const filtered = prev.filter((f) => f.type !== filter.type);
      return [...filtered, filter];
    });
  }, []);

  // Remove a filter
  const removeFilter = useCallback((filterType: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.type !== filterType));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  // Get active department filter
  const selectedDepartment = activeFilters.find((f) => f.type === 'department')?.value;

  // Handle department click from turnover chart
  const handleDepartmentClick = useCallback(
    (dept: { department: string; turnover_rate: number; headcount: number }) => {
      addFilter({
        type: 'department',
        value: dept.department,
        label: `${dept.department} (${dept.headcount} dip.)`,
      });
    },
    [addFilter]
  );

  // Handle date click from trend chart
  const handleDateClick = useCallback(
    (point: TrendPoint) => {
      const date = new Date(point.date);
      const label = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      addFilter({
        type: 'date',
        value: point.date,
        label: `${label} (${point.value} dip.)`,
      });
    },
    [addFilter]
  );

  // Format percentage
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  // Format with suffix
  const formatWithSuffix = (v: number, suffix: string) => `${v.toLocaleString()}${suffix}`;

  // Generate greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buongiorno';
    if (hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };

  // Loading state - polished skeleton with staggered animations
  if (loading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error || !data.overview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {error || 'Impossibile caricare la dashboard'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifica la connessione e riprova.
                </p>
              </div>
              <Button onClick={refetch} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                {tCommon('refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { overview, hrMetrics, performance } = data;

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Page Header */}
      <motion.div variants={staggerItem} className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{getGreeting()}</h1>
          <p className="text-muted-foreground">
            Ecco la panoramica HR del tuo tenant.{' '}
            <Link href="/platform" className="text-primary hover:underline text-xs">
              Vista piattaforma
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSelector value={range} onChange={setRange} />
          <Button variant="outline" size="icon" onClick={refetch} title="Aggiorna dati">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Active Filters Bar */}
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filtri attivi:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeFilters.map((filter) => (
                <Badge
                  key={filter.type}
                  variant="secondary"
                  className="gap-1.5 pr-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => removeFilter(filter.type)}
                >
                  <span className="text-xs font-medium">
                    {filter.type === 'department' ? 'Dipartimento' : 'Periodo'}:
                  </span>
                  {filter.label}
                  <button
                    className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFilter(filter.type);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-xs">
              Cancella tutti
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Row */}
      <motion.div variants={staggerItem}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 lg:grid-rows-2 gap-4">
          {/* Hero: Headcount */}
          <div className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
            {/* Headcount - with real trend data */}
            {(() => {
              const headcountTrend = data.trends?.trends?.headcount;
              const trendData = headcountTrend
                ? calculateTrendFromSparkline(headcountTrend)
                : { trend: 'flat' as const, change: 0 };
              return (
                <KPICard
                  title="Organico"
                  value={overview.employees.active_employees}
                  icon={Users}
                  periodLabel={`${currentOption.label.toLowerCase()}`}
                  sparklineData={getSparklineValues(headcountTrend, 12)}
                  trend={trendData.trend}
                  change={trendData.change}
                  upIsGood={true}
                  size="lg"
                  className="h-full"
                />
              );
            })()}
          </div>

          {/* Turnover - with real trend data */}
          <div className="lg:col-span-2">
            {(() => {
              const turnoverTrend = data.trends?.trends?.turnover_rate;
              const trendData = turnoverTrend
                ? calculateTrendFromSparkline(turnoverTrend)
                : { trend: 'flat' as const, change: 0 };
              const lastValue = turnoverTrend?.[turnoverTrend.length - 1]?.value || 0;
              return (
                <KPICard
                  title="Tasso di Turnover"
                  value={lastValue}
                  formatValue={formatPercent}
                  icon={TrendingDown}
                  periodLabel="annualizzato"
                  sparklineData={getSparklineValues(turnoverTrend, 12)}
                  trend={trendData.trend}
                  change={trendData.change}
                  upIsGood={false}
                />
              );
            })()}
          </div>

          {/* New Hires - with real trend data */}
          <div className="lg:col-span-2">
            {(() => {
              const hiresTrend = data.trends?.trends?.new_hires;
              const trendData = hiresTrend
                ? calculateTrendFromSparkline(hiresTrend)
                : { trend: 'flat' as const, change: 0 };
              const periodTotal = data.trends?.summary?.new_hires_period || 0;
              return (
                <KPICard
                  title="Nuove Assunzioni"
                  value={periodTotal}
                  icon={UserPlus}
                  periodLabel={`${currentOption.label.toLowerCase()}`}
                  sparklineData={getSparklineValues(hiresTrend, 12)}
                  trend={trendData.trend}
                  change={trendData.change}
                  upIsGood={true}
                />
              );
            })()}
          </div>

          {/* Engagement - with real trend data */}
          <div className="sm:col-span-2 lg:col-span-4">
            {(() => {
              const engagementTrend = data.trends?.trends?.engagement;
              const trendData = engagementTrend
                ? calculateTrendFromSparkline(engagementTrend)
                : { trend: 'flat' as const, change: 0 };
              const lastValue = engagementTrend?.[engagementTrend.length - 1]?.value || 0;
              return (
                <KPICard
                  title="Coinvolgimento"
                  value={lastValue}
                  formatValue={(v) => formatWithSuffix(v, '/5')}
                  icon={Heart}
                  periodLabel="punteggio medio"
                  sparklineData={getSparklineValues(engagementTrend, 12)}
                  trend={trendData.trend}
                  change={trendData.change}
                  upIsGood={true}
                />
              );
            })()}
          </div>
        </div>
      </motion.div>

      {/* Charts Row — asymmetric 3:2 */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Headcount by OrgUnit — primary */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Headcount per Dipartimento</CardTitle>
            <CardDescription>Distribuzione dipendenti attivi</CardDescription>
          </CardHeader>
          <CardContent>
            {hrMetrics?.headcount_by_org_unit && hrMetrics.headcount_by_org_unit.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const departments = hrMetrics.headcount_by_org_unit.slice(0, 8);
                  const totalHeadcount = departments.reduce((sum, d) => sum + Number(d.count), 0);
                  const maxCount = Math.max(...departments.map((d) => Number(d.count)));

                  return departments.map((dept, idx) => {
                    const count = Number(dept.count);
                    const barWidth = (count / maxCount) * 100;
                    const isSelected = selectedDepartment === dept.department;

                    return (
                      <ChartTooltip
                        key={idx}
                        data={{
                          label: dept.department,
                          value: count,
                          total: totalHeadcount,
                        }}
                        side="right"
                      >
                        <div
                          className={`space-y-1 cursor-pointer group transition-all ${
                            isSelected
                              ? 'ring-2 ring-primary ring-offset-2 rounded-lg p-1 -m-1'
                              : ''
                          }`}
                          onClick={() =>
                            addFilter({
                              type: 'department',
                              value: dept.department,
                              label: `${dept.department} (${count} dip.)`,
                            })
                          }
                        >
                          <div className="flex justify-between text-sm">
                            <span
                              className={`truncate max-w-[200px] transition-colors ${
                                isSelected ? 'text-primary font-medium' : 'group-hover:text-primary'
                              }`}
                            >
                              {dept.department}
                            </span>
                            <span className="font-medium tabular-nums">{dept.count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full transition-colors ${
                                isSelected ? 'bg-primary' : 'bg-primary group-hover:bg-primary/80'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.05 }}
                            />
                          </div>
                        </div>
                      </ChartTooltip>
                    );
                  });
                })()}
              </div>
            ) : (
              <EmptyState
                type="users"
                title="Nessun dipartimento"
                description="Configura la struttura organizzativa per visualizzare i dati."
                size="sm"
              />
            )}
          </CardContent>
        </Card>

        {/* Goal Completion */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Completamento Obiettivi</CardTitle>
            <CardDescription>Stato degli obiettivi aziendali</CardDescription>
          </CardHeader>
          <CardContent>
            {performance?.goal_completion ? (
              <div className="space-y-6">
                {/* Main metric */}
                <div className="flex items-center justify-center">
                  <ChartTooltip
                    data={{
                      label: 'Obiettivi Completati',
                      value: performance.goal_completion.completed,
                      total: performance.goal_completion.total,
                    }}
                  >
                    <div className="relative cursor-pointer">
                      <svg className="w-32 h-32 -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          className="text-muted"
                        />
                        <motion.circle
                          cx="64"
                          cy="64"
                          r="56"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          strokeLinecap="round"
                          className="text-primary"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                          animate={{
                            strokeDashoffset:
                              2 *
                              Math.PI *
                              56 *
                              (1 - Number(performance.goal_completion.completion_rate || 0) / 100),
                          }}
                          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {Number(performance.goal_completion.completion_rate || 0).toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted-foreground">completati</div>
                        </div>
                      </div>
                    </div>
                  </ChartTooltip>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-semibold text-success">
                      {performance.goal_completion.completed}
                    </div>
                    <div className="text-xs text-muted-foreground">Completati</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-semibold">
                      {performance.goal_completion.total - performance.goal_completion.completed}
                    </div>
                    <div className="text-xs text-muted-foreground">In corso</div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState type="goals" size="sm" />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Trend Charts Row — asymmetric 3:2 */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Headcount Trend - 12 months Area Chart */}
        <div className="lg:col-span-3">
          <HeadcountTrendChart
            data={data.trends?.trends?.headcount}
            isLoading={loading}
            onPointClick={handleDateClick}
          />
        </div>

        {/* Turnover by OrgUnit - Horizontal Bar Chart */}
        <div className="lg:col-span-2">
          <TurnoverDepartmentChart
            data={data.turnover?.departments}
            isLoading={loading}
            onBarClick={handleDepartmentClick}
          />
        </div>
      </motion.div>

      {/* HR Health — Radar + Gauge */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Radar: Multi-dimensional HR Health */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Salute HR</CardTitle>
            <CardDescription>Indicatori chiave normalizzati (0-100)</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const goalRate = Number(performance?.goal_completion?.completion_rate || 0);
              const reviewRate =
                overview.reviews.total_reviews > 0
                  ? (overview.reviews.completed_reviews / overview.reviews.total_reviews) * 100
                  : 0;
              const learningScore = Math.min(overview.learning.total_courses * 2, 100);
              const engagementTrend = data.trends?.trends?.engagement;
              const engVal = engagementTrend?.[engagementTrend.length - 1]?.value || 0;
              const engagementScore = Math.min(engVal * 20, 100);
              const headcount = Number(overview.employees.active_employees) || 1;
              const recognitionCount = Number(overview.recognition?.total_recognitions || 0);
              const recognitionScore = Math.min(
                Math.round((recognitionCount / headcount) * 50),
                100
              );

              const radarData = [
                { dimension: 'Obiettivi', score: Math.round(goalRate) },
                { dimension: 'Valutazioni', score: Math.round(reviewRate) },
                { dimension: 'Formazione', score: Math.round(learningScore) },
                { dimension: 'Engagement', score: Math.round(engagementScore) },
                { dimension: 'Riconoscimenti', score: Math.round(recognitionScore) },
              ];

              return (
                <BaseRadarChart
                  data={radarData}
                  dataKey="dimension"
                  series={[{ dataKey: 'score', name: 'Score HR', fillOpacity: 0.25 }]}
                  height={280}
                  showLegend={false}
                  formatValue={(v) => `${v}%`}
                />
              );
            })()}
          </CardContent>
        </Card>

        {/* Gauge: Engagement Score */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Engagement Score</CardTitle>
            <CardDescription>Punteggio medio dipendenti</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {(() => {
              const engagementTrend = data.trends?.trends?.engagement;
              const lastValue = engagementTrend?.[engagementTrend.length - 1]?.value || 0;
              const hasData = engagementTrend && engagementTrend.length > 0 && lastValue > 0;

              if (!hasData) {
                return (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nessun dato disponibile
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Il modulo Engagement non è ancora configurato
                    </p>
                  </div>
                );
              }

              const score = Math.round(lastValue * 20);
              return (
                <GaugeChart
                  value={score}
                  max={100}
                  min={0}
                  unit="%"
                  title="Coinvolgimento"
                  height={220}
                  thresholds={{ low: 40, medium: 70, high: 100 }}
                  splitNumber={4}
                />
              );
            })()}
            {(() => {
              const engagementTrend = data.trends?.trends?.engagement;
              const lastValue = engagementTrend?.[engagementTrend.length - 1]?.value || 0;
              if (!engagementTrend || engagementTrend.length === 0 || lastValue === 0) return null;
              return (
                <div className="mt-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{lastValue.toFixed(1)}</span>
                    /5.0 —{' '}
                    {lastValue >= 4
                      ? 'Eccellente'
                      : lastValue >= 3
                        ? 'Buono'
                        : lastValue >= 2
                          ? 'Da migliorare'
                          : 'Critico'}
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </motion.div>

      {/* Bottom Row — asymmetric 2:3 */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Alerts Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Attenzione Richiesta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Pending time off */}
              {hrMetrics?.pending_time_off != null && hrMetrics.pending_time_off > 0 && (
                <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                  <span className="text-sm">Richieste ferie in attesa</span>
                  <span className="font-semibold text-warning">{hrMetrics.pending_time_off}</span>
                </div>
              )}

              {/* Open requisitions */}
              {hrMetrics?.open_requisitions != null && hrMetrics.open_requisitions > 0 && (
                <div className="flex items-center justify-between p-3 bg-info/10 rounded-lg">
                  <span className="text-sm">Posizioni aperte</span>
                  <span className="font-semibold text-info">{hrMetrics.open_requisitions}</span>
                </div>
              )}

              {/* Reviews in progress */}
              {overview.reviews &&
                overview.reviews.total_reviews - overview.reviews.completed_reviews > 0 && (
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                    <span className="text-sm">Valutazioni da completare</span>
                    <span className="font-semibold text-primary">
                      {overview.reviews.total_reviews - overview.reviews.completed_reviews}
                    </span>
                  </div>
                )}

              {/* No alerts */}
              {(!hrMetrics?.pending_time_off || hrMetrics.pending_time_off === 0) &&
                (!hrMetrics?.open_requisitions || hrMetrics.open_requisitions === 0) &&
                (!overview.reviews ||
                  overview.reviews.total_reviews === overview.reviews.completed_reviews) && (
                  <SuccessEmptyState
                    title="Tutto sotto controllo"
                    description="Non ci sono azioni urgenti in attesa."
                  />
                )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions + Stats */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Azioni Rapide</CardTitle>
            <CardDescription>Accesso diretto alle sezioni principali</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Action Links */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  href: '/admin/employees',
                  icon: Users,
                  label: 'Dipendenti',
                  count: overview.employees.active_employees,
                },
                {
                  href: '/admin/career/goals',
                  icon: Target,
                  label: 'Obiettivi',
                  count: overview.goals.total_goals,
                },
                {
                  href: '/admin/learning',
                  icon: GraduationCap,
                  label: 'Formazione',
                  count: overview.learning.total_courses,
                },
                {
                  href: '/admin/org-units',
                  icon: Building2,
                  label: 'Organizzazione',
                  count: overview.employees.departments,
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <action.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{action.label}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {action.count} totali
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-4 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-warning" />
                <span className="text-sm tabular-nums font-medium">
                  {overview.reviews.avg_rating
                    ? Number(overview.reviews.avg_rating).toFixed(1)
                    : '-'}
                </span>
                <span className="text-xs text-muted-foreground">rating medio</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="text-sm">
                <span className="tabular-nums font-medium">
                  {overview.reviews.completed_reviews || 0}
                </span>
                <span className="text-xs text-muted-foreground ml-2"> valutazioni completate</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity Feed — derived from dashboard data */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Attività Recenti
            </CardTitle>
            <CardDescription>Riepilogo eventi HR del periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {/* New hires activity */}
                {(data.trends?.summary?.new_hires_period || 0) > 0 && (
                  <div className="flex items-start gap-3 relative">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/10 flex items-center justify-center z-10">
                      <UserPlus className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm">
                        <span className="font-medium">
                          {data.trends?.summary?.new_hires_period}
                        </span>{' '}
                        nuove assunzioni nel periodo selezionato
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{currentOption.label}</p>
                    </div>
                  </div>
                )}

                {/* Goal completion activity */}
                {performance?.goal_completion && (
                  <div className="flex items-start gap-3 relative">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center z-10">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm">
                        <span className="font-medium">{performance.goal_completion.completed}</span>{' '}
                        obiettivi completati su{' '}
                        <span className="font-medium">{performance.goal_completion.total}</span>{' '}
                        totali (
                        {Number(performance.goal_completion.completion_rate || 0).toFixed(0)}%)
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stato obiettivi corrente
                      </p>
                    </div>
                  </div>
                )}

                {/* Reviews activity */}
                {overview.reviews && overview.reviews.completed_reviews > 0 && (
                  <div className="flex items-start gap-3 relative">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center z-10">
                      <Star className="h-4 w-4 text-warning" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm">
                        <span className="font-medium">{overview.reviews.completed_reviews}</span>{' '}
                        valutazioni completate
                        {overview.reviews.avg_rating && (
                          <>
                            {' '}
                            con rating medio{' '}
                            <span className="font-medium">
                              {Number(overview.reviews.avg_rating).toFixed(1)}
                            </span>
                            /5
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Performance reviews</p>
                    </div>
                  </div>
                )}

                {/* Training activity */}
                {overview.learning && overview.learning.total_courses > 0 && (
                  <div className="flex items-start gap-3 relative">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-info/10 flex items-center justify-center z-10">
                      <GraduationCap className="h-4 w-4 text-info" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm">
                        <span className="font-medium">{overview.learning.total_courses}</span> corsi
                        attivi nel catalogo formativo
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Programma di formazione
                      </p>
                    </div>
                  </div>
                )}

                {/* Turnover insight */}
                {data.turnover?.departments && data.turnover.departments.length > 0 && (
                  <div className="flex items-start gap-3 relative">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10">
                      <TrendUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm">
                        Turnover monitorato su{' '}
                        <span className="font-medium">{data.turnover.departments.length}</span>{' '}
                        dipartimenti
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Analisi retention</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
