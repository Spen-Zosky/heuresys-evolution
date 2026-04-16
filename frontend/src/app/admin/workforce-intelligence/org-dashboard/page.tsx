'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Users, BarChart3, AlertTriangle, Shield, ChevronRight, ArrowUpDown } from 'lucide-react';
import { BaseBarChart } from '@/components/charts';
import { BasePieChart } from '@/components/charts';
import { RiskBadge } from '@/components/workforce-intelligence/risk-badge';
import * as careerApi from '@/lib/api/endpoints/career-intelligence';
import type {
  SkillIntelligenceResponse,
  ConcentrationRiskResponse,
} from '@/lib/api/endpoints/career-intelligence';

// ============================================
// TYPES
// ============================================

type SortField = 'skillLabel' | 'employeeCount' | 'penetrationRate' | 'riskLevel';
type SortDir = 'asc' | 'desc';

const RISK_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  healthy: 3,
};

// ============================================
// KPI STAT CARD
// ============================================

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, loading }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color ?? ''}`}>
              {typeof value === 'number' ? value.toLocaleString('it-IT') : value}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <Icon className={`h-5 w-5 ${color ?? 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function OrgDashboardPage() {
  const t = useTranslations('admin.workforceIntelligence.orgDashboard');
  const tCommon = useTranslations('common');
  const [intel, setIntel] = useState<SkillIntelligenceResponse | null>(null);
  const [risk, setRisk] = useState<ConcentrationRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('riskLevel');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [intelRes, riskRes] = await Promise.all([
        careerApi.getSkillIntelligence(),
        careerApi.getConcentrationRisk(),
      ]);
      setIntel(intelRes);
      setRisk(riskRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dati');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data
  const criticalHighCount = risk ? risk.summary.critical + risk.summary.high : 0;

  const avgCoverage = useMemo(() => {
    if (!intel?.skills.length) return 0;
    const sum = intel.skills.reduce((acc, s) => acc + s.penetrationRate, 0);
    return Math.round((sum / intel.skills.length) * 100) / 100;
  }, [intel]);

  // Risk donut data
  const riskDonutData = useMemo(() => {
    if (!risk) return [];
    return [
      { name: 'Critico', value: risk.summary.critical, color: '#e03131' },
      { name: 'Alto', value: risk.summary.high, color: '#f76707' },
      { name: 'Moderato', value: risk.summary.moderate, color: '#f59f00' },
      { name: 'Sano', value: risk.summary.healthy, color: '#37b24d' },
    ].filter((d) => d.value > 0);
  }, [risk]);

  // Alert items (critical + high risks)
  const alertItems = useMemo(() => {
    if (!risk) return [];
    return risk.risks.filter((r) => r.riskLevel === 'critical' || r.riskLevel === 'high');
  }, [risk]);

  // Skill distribution chart data (top 15 by employeesWithSkill)
  const skillDistData = useMemo(() => {
    if (!intel?.skills.length) return [];
    return [...intel.skills]
      .sort((a, b) => b.employeesWithSkill - a.employeesWithSkill)
      .slice(0, 15)
      .map((s) => ({
        name: s.skillLabel.length > 30 ? s.skillLabel.slice(0, 28) + '...' : s.skillLabel,
        fullName: s.skillLabel,
        count: s.employeesWithSkill,
        riskLevel: s.riskLevel,
      }));
  }, [intel]);

  // Risk color mapping for bar chart
  const riskBarColor = useCallback((entry: Record<string, unknown>) => {
    const level = entry.riskLevel as string;
    switch (level) {
      case 'CRITICAL_GAP':
        return '#e03131';
      case 'SCARCE':
        return '#f76707';
      case 'HEALTHY':
        return '#37b24d';
      case 'WIDESPREAD':
        return '#2b8a3e';
      default:
        return '#868e96';
    }
  }, []);

  // Sortable risk table data
  const sortedRisks = useMemo(() => {
    if (!risk) return [];
    const filtered = risk.risks.filter((r) => r.riskLevel !== 'healthy');
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'skillLabel':
          cmp = a.skillLabel.localeCompare(b.skillLabel);
          break;
        case 'employeeCount':
          cmp = a.employeeCount - b.employeeCount;
          break;
        case 'penetrationRate':
          cmp = a.penetrationRate - b.penetrationRate;
          break;
        case 'riskLevel':
          cmp = (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [risk, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Error state
  if (error && !loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 text-sm text-primary underline hover:no-underline"
          >
            Riprova
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      <h1 className="sr-only">Org Dashboard</h1>
      {/* Section 1: KPI Stat Cards */}
      <motion.div
        variants={staggerItem}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Dipendenti"
          value={risk?.summary.totalEmployees ?? 0}
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Skill Uniche"
          value={intel?.summary.totalSkills ?? 0}
          icon={BarChart3}
          loading={loading}
        />
        <StatCard
          title="Rischi Critici"
          value={criticalHighCount}
          icon={AlertTriangle}
          color={criticalHighCount > 0 ? 'text-destructive' : undefined}
          loading={loading}
        />
        <StatCard
          title="Copertura Media"
          value={`${avgCoverage}%`}
          icon={Shield}
          loading={loading}
        />
      </motion.div>

      {/* Section 2: Risk Radar */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuzione Rischio</CardTitle>
            <CardDescription>Concentrazione rischio per livello di criticita</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : riskDonutData.length > 0 ? (
              <BasePieChart
                data={riskDonutData}
                height={300}
                innerRadius={60}
                outerRadius={100}
                showLegend
                showTooltip
                centerLabel={{
                  title: 'Totale Skill',
                  value: risk?.summary.totalSkills ?? 0,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                Nessun dato di rischio disponibile
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Alert Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Rischio</CardTitle>
            <CardDescription>Skill con concentrazione critica o alta</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : alertItems.length > 0 ? (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {alertItems.map((item) => (
                  <div
                    key={item.skillLabel}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{item.skillLabel}</p>
                        <RiskBadge level={item.riskLevel} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.employeeCount} dipendent{item.employeeCount === 1 ? 'e' : 'i'}{' '}
                        &middot; {item.holders.slice(0, 3).join(', ')}
                        {item.holders.length > 3 && ` +${item.holders.length - 3}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                Nessun rischio critico o alto rilevato
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 3: Skill Distribution */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>Distribuzione Skill</CardTitle>
            <CardDescription>Top 15 skill per numero di dipendenti</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : skillDistData.length > 0 ? (
              <BaseBarChart
                data={skillDistData}
                bars={[{ dataKey: 'count', name: 'Dipendenti' }]}
                xAxisKey="name"
                layout="vertical"
                height={Math.max(400, skillDistData.length * 32)}
                showLegend={false}
                barSize={18}
                colorByValue={riskBarColor}
                formatTooltip={(value, _name) => `${value.toLocaleString('it-IT')} dipendenti`}
              />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                Nessun dato skill disponibile
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 4: Concentration Risk Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>Tabella Rischio Concentrazione</CardTitle>
            <CardDescription>
              Skill con rischio di concentrazione (critico, alto, moderato)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sortedRisks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortableHeader
                        label="Skill"
                        field="skillLabel"
                        current={sortField}
                        dir={sortDir}
                        onToggle={toggleSort}
                      />
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                        Tipo
                      </th>
                      <SortableHeader
                        label="Dipendenti"
                        field="employeeCount"
                        current={sortField}
                        dir={sortDir}
                        onToggle={toggleSort}
                      />
                      <SortableHeader
                        label="Penetrazione %"
                        field="penetrationRate"
                        current={sortField}
                        dir={sortDir}
                        onToggle={toggleSort}
                      />
                      <SortableHeader
                        label="Rischio"
                        field="riskLevel"
                        current={sortField}
                        dir={sortDir}
                        onToggle={toggleSort}
                      />
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                        Detentori
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRisks.map((item) => (
                      <tr
                        key={item.skillLabel}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-2 font-medium max-w-[200px] truncate">
                          {item.skillLabel}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {item.skillType}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 tabular-nums">{item.employeeCount}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(item.penetrationRate * 100, 100)}
                              className="h-2 w-16"
                            />
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {(item.penetrationRate * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <RiskBadge level={item.riskLevel} />
                        </td>
                        <td className="py-3 px-2 text-xs text-muted-foreground max-w-[200px] truncate">
                          {item.holders.slice(0, 3).join(', ')}
                          {item.holders.length > 3 && ` +${item.holders.length - 3}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[120px] text-sm text-muted-foreground">
                Nessun rischio di concentrazione rilevato
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// SORTABLE HEADER
// ============================================

function SortableHeader({
  label,
  field,
  current,
  dir: _dir,
  onToggle,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onToggle: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <th className="text-left py-3 px-2">
      <button
        onClick={() => onToggle(field)}
        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${active ? 'text-foreground' : 'text-muted-foreground/50'}`}
        />
      </button>
    </th>
  );
}
