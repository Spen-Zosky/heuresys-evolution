'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  Target,
  Users,
  BookOpen,
  RefreshCw,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { BaseBarChart } from '@/components/charts/base-bar-chart';
import { BaseLineChart } from '@/components/charts/base-line-chart';
import { useTranslations } from 'next-intl';

interface KPIData {
  headcount?: number;
  turnover_rate?: number;
  avg_tenure?: number;
  org_units_count?: number;
  [key: string]: unknown;
}

interface DeptAnalytics {
  department_name?: string;
  name?: string;
  headcount?: number;
  avg_age?: number;
  turnover_rate?: number;
  [key: string]: unknown;
}

interface TrendPoint {
  date?: string;
  month?: string;
  headcount?: number;
  hires?: number;
  terminations?: number;
  [key: string]: unknown;
}

export default function CareerReportsPage() {
  const t = useTranslations('admin.career.reports');
  const [kpis, setKpis] = useState<KPIData>({});
  const [departments, setDepartments] = useState<DeptAnalytics[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendResult, deptResult] = await Promise.allSettled([
        api.analytics.getWorkforceTrend(),
        api.analytics.getDepartmentAnalytics(),
      ]);

      if (trendResult.status === 'fulfilled') {
        const trendData = trendResult.value;
        const items = Array.isArray(trendData) ? trendData : (trendData.data ?? []);
        setTrend(items as unknown as TrendPoint[]);

        // Derive KPIs from trend data
        if (items.length > 0) {
          const latest = items[items.length - 1] as TrendPoint;
          setKpis((prev) => ({
            ...prev,
            headcount: latest.headcount,
          }));
        }
      }

      if (deptResult.status === 'fulfilled') {
        const deptData = deptResult.value;
        const items = Array.isArray(deptData) ? deptData : [];
        setDepartments(items as unknown as DeptAnalytics[]);

        // Derive KPIs from department data
        if (items.length > 0) {
          const depts = items as unknown as DeptAnalytics[];
          const totalHeadcount = depts.reduce((sum, d) => sum + (d.headcount || 0), 0);
          const avgTurnover =
            depts.reduce((sum, d) => sum + (d.turnover_rate || 0), 0) / depts.length;
          setKpis((prev) => ({
            ...prev,
            headcount: prev.headcount || totalHeadcount,
            turnover_rate: avgTurnover,
            org_units_count: items.length,
          }));
        }
      }

      if (trendResult.status === 'rejected' && deptResult.status === 'rejected') {
        throw new Error('Impossibile caricare i dati analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartTrendData = trend.map((t) => ({
    month: t.month || t.date || '',
    headcount: t.headcount || 0,
    hires: t.hires || 0,
    terminations: t.terminations || 0,
  }));

  const chartDeptData = departments.slice(0, 10).map((d) => ({
    department: d.department_name || d.name || '',
    headcount: d.headcount || 0,
    turnover: Math.round((d.turnover_rate || 0) * 100) / 100,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Caricamento report...
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Report Carriera
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </motion.div>

      {error && (
        <motion.div variants={staggerItem}>
          <Card className="border-destructive">
            <CardContent className="p-4 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* KPI Cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Organico</p>
                <p className="text-2xl font-bold">{kpis.headcount ?? '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Turnover</p>
                <p className="text-2xl font-bold">
                  {kpis.turnover_rate != null ? `${kpis.turnover_rate.toFixed(1)}%` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dipartimenti</p>
                <p className="text-2xl font-bold">{kpis.org_units_count ?? '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Anzianita Media</p>
                <p className="text-2xl font-bold">
                  {kpis.avg_tenure != null ? `${kpis.avg_tenure.toFixed(1)} anni` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {chartTrendData.length > 0 && (
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  Trend Organico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BaseLineChart
                  data={chartTrendData}
                  xAxisKey="month"
                  lines={[
                    { dataKey: 'headcount', name: 'Organico', color: '#6366f1' },
                    { dataKey: 'hires', name: 'Assunzioni', color: '#10b981' },
                    { dataKey: 'terminations', name: 'Cessazioni', color: '#ef4444' },
                  ]}
                  height={280}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {chartDeptData.length > 0 && (
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Organico per Dipartimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BaseBarChart
                  data={chartDeptData}
                  xAxisKey="department"
                  bars={[{ dataKey: 'headcount', name: 'Organico', color: '#3b82f6' }]}
                  height={280}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
