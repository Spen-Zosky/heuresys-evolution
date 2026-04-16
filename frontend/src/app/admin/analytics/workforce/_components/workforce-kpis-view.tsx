'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BaseLineChart, BaseBarChart } from '@/components/charts';
import { api, apiClient } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';

// ============================================
// TYPES
// ============================================

interface WorkforceDataPoint {
  month: string;
  monthLabel: string;
  headcount: number;
  hires: number;
  terminations: number;
  netChange: number;
  attritionRate: number;
  isForecast?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

interface DepartmentMetric {
  id: string;
  name: string;
  headcount: number;
  change: number;
  attritionRate: number;
  utilization: number;
  openPositions: number;
  [key: string]: string | number | undefined;
}

// ============================================
// ANIMATION VARIANTS
// ============================================

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ============================================
// API RESPONSE TYPE
// ============================================

interface WorkforceApiResponse {
  workforceData: WorkforceDataPoint[];
  orgUnitMetrics: DepartmentMetric[];
}

interface WorkforceFlatApiResponse {
  total_headcount?: string | number;
  active_employees?: string | number;
  new_hires_30d?: string | number;
  terminations_30d?: string | number;
  turnover_rate_annual?: string | number;
  avg_tenure_years?: string | number;
  top_talent_count?: string | number;
  solid_performers_count?: string | number;
  [key: string]: unknown;
}

// ============================================
// PROPS
// ============================================

interface WorkforceKpisViewProps {
  readOnly?: boolean;
  headerActions?: React.ReactNode;
}

// ============================================
// WORKFORCE KPIS VIEW
// ============================================

export function WorkforceKpisView({ readOnly = false, headerActions }: WorkforceKpisViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('12');
  const [workforceData, setWorkforceData] = useState<WorkforceDataPoint[]>([]);
  const [orgUnitMetrics, setDepartmentMetrics] = useState<DepartmentMetric[]>([]);

  // Load data
  useEffect(() => {
    async function fetchData() {
      try {
        const [workforceResp, depts] = await Promise.all([
          apiClient
            .get<{
              success: boolean;
              data: WorkforceApiResponse | WorkforceFlatApiResponse;
            }>(`/api/v1/analytics/workforce?months=${timeRange}`)
            .catch(() => ({ data: null })),
          api.orgUnits.getOrgUnits(),
        ]);
        setDepartments(depts);
        if (workforceResp?.data) {
          const d = workforceResp.data as WorkforceApiResponse & WorkforceFlatApiResponse;
          if (Array.isArray(d.workforceData)) {
            // Already in expected shape
            setWorkforceData(d.workforceData || []);
            setDepartmentMetrics(d.orgUnitMetrics || []);
          } else {
            // API returns flat object — build a single synthetic data point so charts render
            const headcount = Number(d.total_headcount ?? d.active_employees ?? 0);
            const now = new Date();
            const monthLabel = now.toLocaleString('it-IT', { month: 'short', year: '2-digit' });
            setWorkforceData([
              {
                month: now.toISOString().slice(0, 7),
                monthLabel,
                headcount,
                hires: Number(d.new_hires_30d ?? 0),
                terminations: Number(d.terminations_30d ?? 0),
                netChange: Number(d.new_hires_30d ?? 0) - Number(d.terminations_30d ?? 0),
                attritionRate: Number(d.turnover_rate_annual ?? 0),
              },
            ]);
            setDepartmentMetrics([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch workforce data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [timeRange]);

  // Calculate summary stats
  const historicalData = workforceData.filter((d) => !d.isForecast);
  const currentData = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
  const previousData = historicalData.length > 1 ? historicalData[historicalData.length - 2] : null;
  const forecastEnd = workforceData.length > 0 ? workforceData[workforceData.length - 1] : null;

  const totalHeadcount = currentData?.headcount || 0;
  const headcountChange =
    currentData && previousData && previousData.headcount > 0
      ? Number(
          (
            ((currentData.headcount - previousData.headcount) / previousData.headcount) *
            100
          ).toFixed(1)
        )
      : 0;
  const avgAttrition =
    historicalData.length > 0
      ? historicalData.reduce((sum, d) => sum + d.attritionRate, 0) / historicalData.length
      : 0;

  // Chart data for hires vs terminations
  const flowChartData = workforceData.slice(-12).map((d) => ({
    month: d.monthLabel,
    Assunzioni: d.hires,
    Cessazioni: d.terminations,
  }));

  // OrgUnit attrition chart data
  const attritionChartData = orgUnitMetrics
    .sort((a, b) => b.attritionRate - a.attritionRate)
    .slice(0, 8)
    .map((d) => ({
      name: d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name,
      Attrition: d.attritionRate,
      fullName: d.name,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workforce Planning</h1>
            <p className="text-muted-foreground">Trend headcount, previsioni e analisi attrition</p>
          </div>
          {headerActions}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Ultimi 6 mesi</SelectItem>
                <SelectItem value="12">Ultimi 12 mesi</SelectItem>
                <SelectItem value="24">Ultimi 24 mesi</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" aria-label="Aggiorna dati organico">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Esporta
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">Headcount Attuale</span>
                    </div>
                    <Badge
                      variant={headcountChange >= 0 ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {headcountChange >= 0 ? '+' : ''}
                      {headcountChange}%
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {totalHeadcount.toLocaleString('it-IT')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Previsione 6 Mesi</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Forecast
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {forecastEnd ? forecastEnd.headcount.toLocaleString('it-IT') : '-'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm">Attrition Media</span>
                    </div>
                    {avgAttrition > 5 ? (
                      <Badge variant="destructive" className="text-xs">
                        Alto
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Normale
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold mt-1">{avgAttrition.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span className="text-sm">Posizioni Aperte</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {orgUnitMetrics.reduce((sum, d) => sum + d.openPositions, 0)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Headcount Trend Chart */}
      <motion.div variants={staggerItem} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trend Headcount</CardTitle>
            <CardDescription>
              Storico 12 mesi + previsione 6 mesi (area tratteggiata)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <BaseLineChart
                data={workforceData}
                xAxisKey="monthLabel"
                height={300}
                lines={[
                  {
                    dataKey: 'headcount',
                    name: 'Headcount',
                    color: undefined,
                    areaFill: true,
                  },
                ]}
                formatYAxis={(v) => v.toLocaleString('it-IT')}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Two Column Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hires vs Terminations */}
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Assunzioni vs Cessazioni</CardTitle>
              <CardDescription>Flusso mensile delle risorse</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseBarChart
                  data={flowChartData}
                  xAxisKey="month"
                  height={280}
                  bars={[
                    { dataKey: 'Assunzioni', name: 'Assunzioni', color: '#22C55E' },
                    { dataKey: 'Cessazioni', name: 'Cessazioni', color: '#EF4444' },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Attrition by OrgUnit */}
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Attrition per Dipartimento</CardTitle>
              <CardDescription>Top 8 dipartimenti per tasso di attrition</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseBarChart
                  data={attritionChartData}
                  xAxisKey="name"
                  height={280}
                  layout="vertical"
                  bars={[{ dataKey: 'Attrition', name: 'Attrition %' }]}
                  formatYAxis={(v) => `${v}%`}
                  referenceLines={[{ value: avgAttrition, label: 'Media', color: '#F59E0B' }]}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* OrgUnit Details Table */}
      <motion.div variants={staggerItem} initial="hidden" animate="show">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Dettaglio Dipartimenti</CardTitle>
              <CardDescription>Metriche workforce per dipartimento</CardDescription>
            </div>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i dipartimenti</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Dipartimento</th>
                      <th className="text-right py-3 px-2 font-medium">Headcount</th>
                      <th className="text-right py-3 px-2 font-medium">Variazione</th>
                      <th className="text-right py-3 px-2 font-medium">Attrition</th>
                      <th className="text-right py-3 px-2 font-medium">Utilization</th>
                      <th className="text-right py-3 px-2 font-medium">Posizioni Aperte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUnitMetrics
                      .filter((d) => selectedDepartment === 'all' || d.id === selectedDepartment)
                      .map((dept) => (
                        <tr key={dept.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{dept.name}</td>
                          <td className="text-right py-3 px-2">{dept.headcount}</td>
                          <td className="text-right py-3 px-2">
                            <span className={dept.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {dept.change >= 0 ? '+' : ''}
                              {dept.change}
                            </span>
                          </td>
                          <td className="text-right py-3 px-2">
                            <Badge
                              variant={dept.attritionRate > 5 ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {dept.attritionRate}%
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${dept.utilization}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10">
                                {dept.utilization}%
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-2">
                            {dept.openPositions > 0 ? (
                              <Badge variant="outline">{dept.openPositions}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
