'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, ArrowLeft, Download, RefreshCw, Scale, Users } from 'lucide-react';
import Link from 'next/link';
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
import { BaseBarChart, BaseLineChart } from '@/components/charts';
import { api, apiClient } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface CompensationData {
  avgSalary: number;
  medianSalary: number;
  minSalary: number;
  maxSalary: number;
  totalCompensation: number;
  compaRatioAvg: number;
  payEquityScore: number;
}

interface PayEquityItem {
  category: string;
  avgSalary: number;
  headcount: number;
  gap: number;
  [key: string]: string | number;
}

interface BandComplianceItem {
  band: string;
  min: number;
  max: number;
  below: number;
  within: number;
  above: number;
  complianceRate: number;
  [key: string]: string | number;
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

interface CompensationApiResponse {
  summary: CompensationData;
  payEquityByGender: PayEquityItem[];
  payEquityByDepartment: PayEquityItem[];
  bandCompliance: BandComplianceItem[];
  compaRatioDistribution: { range: string; count: number; [key: string]: string | number }[];
  yoyTrend: { year: string; avgSalary: number; [key: string]: string | number }[];
}

// ============================================
// COMPENSATION ANALYTICS PAGE
// ============================================

export default function CompensationAnalyticsPage() {
  const t = useTranslations('admin.analytics.compensation');
  const [isLoading, setIsLoading] = useState(true);
  const [_departments, setDepartments] = useState<OrgUnit[]>([]);
  const [selectedView, setSelectedView] = useState<string>('gender');
  const [compensationData, setCompensationData] = useState<CompensationData>({
    avgSalary: 0,
    medianSalary: 0,
    minSalary: 0,
    maxSalary: 0,
    totalCompensation: 0,
    compaRatioAvg: 0,
    payEquityScore: 0,
  });
  const [payEquityGender, setPayEquityGender] = useState<PayEquityItem[]>([]);
  const [payEquityDept, setPayEquityDept] = useState<PayEquityItem[]>([]);
  const [bandCompliance, setBandCompliance] = useState<BandComplianceItem[]>([]);
  const [compaRatioData, setCompaRatioData] = useState<
    { range: string; count: number; [key: string]: string | number }[]
  >([]);
  const [yoyTrend, setYoyTrend] = useState<
    { year: string; avgSalary: number; [key: string]: string | number }[]
  >([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [compResp, depts] = await Promise.all([
          apiClient
            .get<{
              success: boolean;
              data: CompensationApiResponse;
            }>('/api/v1/analytics/compensation/overview')
            .catch(() => ({ data: null })),
          api.orgUnits.getOrgUnits(),
        ]);
        setDepartments(depts);
        if (compResp?.data) {
          setCompensationData(
            compResp.data.summary || {
              avgSalary: 0,
              medianSalary: 0,
              minSalary: 0,
              maxSalary: 0,
              totalCompensation: 0,
              compaRatioAvg: 0,
              payEquityScore: 0,
            }
          );
          setPayEquityGender(compResp.data.payEquityByGender || []);
          setPayEquityDept(compResp.data.payEquityByDepartment || []);
          setBandCompliance(compResp.data.bandCompliance || []);
          setCompaRatioData(compResp.data.compaRatioDistribution || []);
          setYoyTrend(compResp.data.yoyTrend || []);
        }
      } catch (error) {
        console.error('Failed to fetch compensation data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const currentPayEquity = selectedView === 'gender' ? payEquityGender : payEquityDept;

  // Chart data for band compliance
  const bandChartData = bandCompliance.map((b) => ({
    name: b.band,
    'Sotto banda': b.below,
    'In banda': b.within,
    'Sopra banda': b.above,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" aria-label="Go back" asChild>
            <Link href="/admin/analytics">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-500" />
              Compensation Analytics
            </h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Aggiorna dati retribuzioni">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </div>
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
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Salario Medio</span>
                  </div>
                  <p className="text-2xl font-bold">
                    €{compensationData.avgSalary.toLocaleString('it-IT')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Scale className="h-4 w-4" />
                    <span className="text-sm">Compa-Ratio Medio</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {(compensationData.compaRatioAvg * 100).toFixed(0)}%
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Pay Equity Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{compensationData.payEquityScore}</p>
                    <Badge variant="secondary" className="text-xs">
                      Buono
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Total Compensation</span>
                  </div>
                  <p className="text-2xl font-bold">
                    €{(compensationData.totalCompensation / 1000000).toFixed(1)}M
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Pay Equity Analysis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Pay Equity Analysis</CardTitle>
                <CardDescription>Analisi gap salariale</CardDescription>
              </div>
              <Select value={selectedView} onValueChange={setSelectedView}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gender">Per Genere</SelectItem>
                  <SelectItem value="department">Per Dipartimento</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseBarChart
                  data={currentPayEquity}
                  xAxisKey="category"
                  height={280}
                  bars={[{ dataKey: 'avgSalary', name: 'Salario Medio' }]}
                  formatYAxis={(v) => `€${(v / 1000).toFixed(0)}k`}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Compa-Ratio Distribution</CardTitle>
              <CardDescription>Distribuzione rispetto ai salary band</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseBarChart
                  data={compaRatioData}
                  xAxisKey="range"
                  height={280}
                  bars={[{ dataKey: 'count', name: 'Dipendenti' }]}
                  referenceLines={[{ value: 0, label: '', color: 'transparent' }]}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Band Compliance & YoY Trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Salary Band Compliance</CardTitle>
              <CardDescription>Conformità ai livelli retributivi</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseBarChart
                  data={bandChartData}
                  xAxisKey="name"
                  height={280}
                  bars={[
                    { dataKey: 'Sotto banda', name: 'Sotto banda', color: '#EF4444', stackId: 'a' },
                    { dataKey: 'In banda', name: 'In banda', color: '#22C55E', stackId: 'a' },
                    { dataKey: 'Sopra banda', name: 'Sopra banda', color: '#F59E0B', stackId: 'a' },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Year-over-Year Comparison</CardTitle>
              <CardDescription>Evoluzione salario medio</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseLineChart
                  data={yoyTrend}
                  xAxisKey="year"
                  height={280}
                  lines={[{ dataKey: 'avgSalary', name: 'Salario Medio', areaFill: true }]}
                  formatYAxis={(v) => `€${(v / 1000).toFixed(0)}k`}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Band Compliance Table */}
      <motion.div variants={staggerItem} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dettaglio Salary Bands</CardTitle>
            <CardDescription>Compliance rate per livello</CardDescription>
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
                      <th className="text-left py-3 px-2 font-medium">Livello</th>
                      <th className="text-right py-3 px-2 font-medium">Range</th>
                      <th className="text-right py-3 px-2 font-medium">Sotto</th>
                      <th className="text-right py-3 px-2 font-medium">In banda</th>
                      <th className="text-right py-3 px-2 font-medium">Sopra</th>
                      <th className="text-right py-3 px-2 font-medium">Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandCompliance.map((band) => (
                      <tr key={band.band} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{band.band}</td>
                        <td className="text-right py-3 px-2">
                          €{(band.min / 1000).toFixed(0)}k - €{(band.max / 1000).toFixed(0)}k
                        </td>
                        <td className="text-right py-3 px-2">
                          {band.below > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {band.below}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-2">
                          <Badge variant="secondary" className="text-xs">
                            {band.within}
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-2">
                          {band.above > 0 ? (
                            <Badge variant="outline" className="text-xs">
                              {band.above}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-2">
                          <Badge
                            variant={band.complianceRate >= 90 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {band.complianceRate}%
                          </Badge>
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
