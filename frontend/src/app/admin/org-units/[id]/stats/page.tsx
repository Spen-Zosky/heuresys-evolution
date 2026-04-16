'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ArrowLeft,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Download,
  Calendar,
  Briefcase,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, apiClient } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { BaseLineChart, BaseBarChart, BasePieChart } from '@/components/charts';

// ============================================
// TYPES
// ============================================

interface HeadcountTrend {
  month: string;
  headcount: number;
  hires: number;
  terminations: number;
  [key: string]: string | number;
}

interface RoleDistribution {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface TenureDistribution {
  range: string;
  count: number;
  [key: string]: string | number;
}

// ============================================
// API RESPONSE TYPE
// ============================================

interface DepartmentStatsResponse {
  headcountTrend: HeadcountTrend[];
  roleDistribution: RoleDistribution[];
  tenureDistribution: TenureDistribution[];
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function DepartmentStatsPage() {
  const t = useTranslations('admin.orgUnits.stats');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const orgUnitId = params.id as string;

  const [department, setDepartment] = useState<OrgUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('12');
  const [headcountTrend, setHeadcountTrend] = useState<HeadcountTrend[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<RoleDistribution[]>([]);
  const [tenureDistribution, setTenureDistribution] = useState<TenureDistribution[]>([]);

  const fetchOrgUnit = useCallback(async () => {
    if (!orgUnitId) return;
    setLoading(true);
    setError(null);
    try {
      const [deptData, statsResp] = await Promise.all([
        api.orgUnits.getOrgUnitById(orgUnitId),
        apiClient
          .get<{
            success: boolean;
            data: DepartmentStatsResponse;
          }>(`/api/v1/org-units/${orgUnitId}/stats`)
          .catch(() => ({ data: null })),
      ]);
      setDepartment(deptData);
      if (statsResp?.data) {
        setHeadcountTrend(statsResp.data.headcountTrend || []);
        setRoleDistribution(statsResp.data.roleDistribution || []);
        setTenureDistribution(statsResp.data.tenureDistribution || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dipartimento');
    } finally {
      setLoading(false);
    }
  }, [orgUnitId]);

  useEffect(() => {
    fetchOrgUnit();
  }, [fetchOrgUnit]);

  // Calculate stats
  const stats = useMemo(() => {
    if (headcountTrend.length === 0) {
      return { headcount: 0, growthRate: 0, hires: 0, terminations: 0, turnover: 0, avgTenure: 0 };
    }
    const currentHeadcount = headcountTrend[headcountTrend.length - 1]?.headcount || 0;
    const previousHeadcount =
      headcountTrend.length > 1
        ? headcountTrend[headcountTrend.length - 2]?.headcount || currentHeadcount
        : currentHeadcount;
    const growthRate =
      previousHeadcount > 0
        ? (((currentHeadcount - previousHeadcount) / previousHeadcount) * 100).toFixed(1)
        : '0';

    const totalHires = headcountTrend.reduce((sum, m) => sum + m.hires, 0);
    const totalTerminations = headcountTrend.reduce((sum, m) => sum + m.terminations, 0);
    const avgTurnover =
      currentHeadcount > 0 ? ((totalTerminations / currentHeadcount) * 100).toFixed(1) : '0';

    return {
      headcount: currentHeadcount,
      growthRate: parseFloat(growthRate),
      hires: totalHires,
      terminations: totalTerminations,
      turnover: parseFloat(avgTurnover),
      avgTenure: 0,
    };
  }, [headcountTrend]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error || !department) {
    return <ApiError message={error || 'Dipartimento non trovato'} onRetry={fetchOrgUnit} />;
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            onClick={() => router.push(`/admin/org-units/${orgUnitId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground">{department.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 mesi</SelectItem>
              <SelectItem value="6">6 mesi</SelectItem>
              <SelectItem value="12">12 mesi</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Aggiorna statistiche">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerItem}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Headcount</span>
            </div>
            <p className="text-2xl font-bold">{stats.headcount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {stats.growthRate >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Crescita</span>
            </div>
            <p
              className={`text-2xl font-bold ${stats.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {stats.growthRate >= 0 ? '+' : ''}
              {stats.growthRate}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Assunzioni</span>
            </div>
            <p className="text-2xl font-bold">{stats.hires}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Cessazioni</span>
            </div>
            <p className="text-2xl font-bold">{stats.terminations}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Turnover</span>
            </div>
            <p className="text-2xl font-bold">{stats.turnover}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Anzianita Media</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgTenure} anni</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trend Headcount</CardTitle>
              <CardDescription>Evoluzione organico negli ultimi 12 mesi</CardDescription>
            </CardHeader>
            <CardContent>
              <BaseLineChart
                data={headcountTrend}
                xAxisKey="month"
                height={280}
                lines={[{ dataKey: 'headcount', name: 'Headcount', areaFill: true }]}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assunzioni vs Cessazioni</CardTitle>
              <CardDescription>Flusso mensile del personale</CardDescription>
            </CardHeader>
            <CardContent>
              <BaseBarChart
                data={headcountTrend}
                xAxisKey="month"
                height={280}
                bars={[
                  { dataKey: 'hires', name: 'Assunzioni' },
                  { dataKey: 'terminations', name: 'Cessazioni' },
                ]}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuzione Ruoli</CardTitle>
              <CardDescription>Composizione del dipartimento per ruolo</CardDescription>
            </CardHeader>
            <CardContent>
              <BasePieChart
                data={roleDistribution}
                height={280}
                innerRadius={50}
                outerRadius={90}
                showLegend={true}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Anzianita Dipendenti</CardTitle>
              <CardDescription>Distribuzione per anni di servizio</CardDescription>
            </CardHeader>
            <CardContent>
              <BaseBarChart
                data={tenureDistribution}
                xAxisKey="range"
                height={280}
                bars={[{ dataKey: 'count', name: 'Dipendenti' }]}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Links */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Azioni Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href={`/admin/org-units/${orgUnitId}`}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Dettagli Dipartimento
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/admin/employees?org_unit_id=${orgUnitId}`}>
                  <Users className="h-4 w-4 mr-2" />
                  Lista Dipendenti
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/analytics/workforce">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics Globali
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
