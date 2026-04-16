'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  ArrowLeft,
  Download,
  RefreshCw,
  Lightbulb,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GaugeChart, BaseBarChart, BasePieChart } from '@/components/charts';
import { api, apiClient } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface FlightRiskEmployee {
  id: string;
  name: string;
  department: string;
  jobTitle: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: { name: string; impact: number }[];
  recommendation: string;
  [key: string]: string | number | { name: string; impact: number }[] | undefined;
}

interface PerformancePrediction {
  id: string;
  name: string;
  currentRating: number;
  predictedRating: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
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
// API RESPONSE TYPES
// ============================================

interface _AiInsightsResponse {
  flightRisk: FlightRiskEmployee[];
  performancePredictions: PerformancePrediction[];
  modelAccuracy: number;
  modelVersion: string;
}

// ============================================
// AI PREDICTIVE ANALYTICS PAGE
// ============================================

export default function AIPredictiveAnalyticsPage() {
  const t = useTranslations('admin.analytics.ai');
  const [isLoading, setIsLoading] = useState(true);
  const [flightRiskData, setFlightRiskData] = useState<FlightRiskEmployee[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformancePrediction[]>([]);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const [modelAccuracy, setModelAccuracy] = useState(0);
  const [modelVersion, setModelVersion] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [highRiskResp, summaryResp, modelsResp, depts] = await Promise.all([
          apiClient
            .get<{
              success: boolean;
              data: Record<string, unknown>[];
            }>('/api/v1/predictions/turnover/high-risk')
            .catch(() => ({ data: [] as Record<string, unknown>[] })),
          apiClient
            .get<{
              success: boolean;
              data: {
                turnover_risk: { risk_level: string; count: string }[];
                performance_predictions: { performance_level: string; count: string }[];
              };
            }>('/api/v1/predictions/summary')
            .catch(() => ({ data: null })),
          apiClient
            .get<{
              success: boolean;
              data: Record<string, unknown>[];
            }>('/api/v1/predictions/models')
            .catch(() => ({ data: [] as Record<string, unknown>[] })),
          api.orgUnits.getOrgUnits(),
        ]);

        // Map high-risk employees to flight risk data
        const riskData = (Array.isArray(highRiskResp.data)
          ? highRiskResp.data
          : []) as unknown as FlightRiskEmployee[];
        setFlightRiskData(riskData);

        // Map summary to performance predictions
        if (summaryResp?.data?.performance_predictions) {
          setPerformanceData(
            summaryResp.data.performance_predictions.map((p) => ({
              department: p.performance_level,
              predicted: Number(p.count),
              actual: 0,
            })) as unknown as PerformancePrediction[]
          );
        }

        // Model info
        const models = Array.isArray(modelsResp.data) ? modelsResp.data : [];
        if (models.length > 0) {
          const m = models[0] as Record<string, unknown>;
          setModelAccuracy(Number(m.accuracy || m.precision || 0) * 100);
          setModelVersion(String(m.algorithm || m.name || ''));
        }
        setDepartments(depts);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Filter data
  const filteredRiskData = useMemo(() => {
    return flightRiskData
      .filter((emp) => {
        if (selectedDepartment !== 'all' && emp.department !== selectedDepartment) return false;
        if (riskFilter !== 'all' && emp.riskLevel !== riskFilter) return false;
        return true;
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [flightRiskData, selectedDepartment, riskFilter]);

  // Calculate summary stats
  const riskDistribution = useMemo(() => {
    const dist = { low: 0, medium: 0, high: 0, critical: 0 };
    flightRiskData.forEach((emp) => {
      dist[emp.riskLevel]++;
    });
    return dist;
  }, [flightRiskData]);

  const avgRiskScore = useMemo(() => {
    return flightRiskData.length > 0
      ? Math.round(
          flightRiskData.reduce((sum, emp) => sum + emp.riskScore, 0) / flightRiskData.length
        )
      : 0;
  }, [flightRiskData]);

  // Chart data
  const riskPieData = [
    { name: 'Basso', value: riskDistribution.low, color: '#22C55E' },
    { name: 'Medio', value: riskDistribution.medium, color: '#F59E0B' },
    { name: 'Alto', value: riskDistribution.high, color: '#EF4444' },
    { name: 'Critico', value: riskDistribution.critical, color: '#7C3AED' },
  ];

  const performanceChartData = performanceData.slice(0, 10).map((p) => ({
    name: p.name.split(' ')[1] || p.name.substring(0, 10),
    Attuale: p.currentRating,
    Predetto: p.predictedRating,
  }));

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-purple-500';
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-green-500';
    }
  };

  const getRiskBadgeVariant = (
    level: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

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
              <Brain className="h-6 w-6 text-purple-500" />
              AI Predictive Analytics
            </h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {modelVersion && (
            <Badge variant="secondary" className="text-xs">
              Modello {modelVersion} | Accuratezza {modelAccuracy}%
            </Badge>
          )}
          <Button variant="outline" size="icon" aria-label="Aggiorna AI Insights">
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
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-sm">Risk Score Medio</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{avgRiskScore}</p>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Alto Rischio</span>
                  </div>
                  <p className="text-2xl font-bold text-red-500">
                    {riskDistribution.high + riskDistribution.critical}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Performance Miglioramento</span>
                  </div>
                  <p className="text-2xl font-bold text-green-500">
                    {performanceData.filter((p) => p.trend === 'improving').length}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Brain className="h-4 w-4" />
                    <span className="text-sm">Accuratezza Modello</span>
                  </div>
                  <p className="text-2xl font-bold">{modelAccuracy}%</p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Risk Score Gauge */}
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Risk Score Medio</CardTitle>
              <CardDescription>Indicatore aggregato</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {isLoading ? (
                <Skeleton className="h-[180px] w-[180px] rounded-full" />
              ) : (
                <GaugeChart
                  value={avgRiskScore}
                  max={100}
                  title="Punteggio di Rischio"
                  height={180}
                  thresholds={{ low: 40, medium: 70, high: 100 }}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Distribution Pie */}
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Distribuzione Rischio</CardTitle>
              <CardDescription>Dipendenti per livello di rischio</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <BasePieChart
                  data={riskPieData}
                  height={200}
                  innerRadius={50}
                  outerRadius={80}
                  showLegend={true}
                  centerLabel={{ title: 'Totale', value: flightRiskData.length }}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Performance Predictions */}
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Predizioni Performance</CardTitle>
              <CardDescription>Rating attuale vs predetto</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <BaseBarChart
                  data={performanceChartData}
                  xAxisKey="name"
                  height={200}
                  bars={[
                    { dataKey: 'Attuale', name: 'Attuale', color: '#94A3B8' },
                    { dataKey: 'Predetto', name: 'Predetto', color: '#8B5CF6' },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Flight Risk List */}
      <motion.div variants={staggerItem} initial="hidden" animate="show">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Flight Risk Analysis</CardTitle>
              <CardDescription>Dipendenti ordinati per rischio di abbandono</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tutti i rischi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="critical">Critico</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="low">Basso</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Dipartimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i dipartimenti</SelectItem>
                  {departments.slice(0, 10).map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRiskData.slice(0, 10).map((emp) => (
                  <div
                    key={emp.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{emp.name}</span>
                          <Badge variant={getRiskBadgeVariant(emp.riskLevel)} className="text-xs">
                            {emp.riskLevel.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {emp.jobTitle} • {emp.department}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {emp.factors.slice(0, 3).map((factor, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {factor.name}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          <span className="text-muted-foreground">{emp.recommendation}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getRiskColor(emp.riskLevel)}`}>
                          {emp.riskScore}
                        </div>
                        <div className="text-xs text-muted-foreground">Risk Score</div>
                        <Progress value={emp.riskScore} className="w-20 h-2 mt-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
