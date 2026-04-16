'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Brain,
  FileText,
  ArrowRight,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface QuickStats {
  totalEmployees: number;
  employeeChange: number;
  attritionRate: number;
  attritionTrend: 'up' | 'down' | 'stable';
  avgSalary: number;
  salaryChange: number;
  absenceRate: number;
  absenceTrend: 'up' | 'down' | 'stable';
}

interface AnalyticsModule {
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
  color: string;
  stats?: { label: string; value: string | number }[];
  isNew?: boolean;
  isPremium?: boolean;
}

// ============================================
// ANIMATION VARIANTS
// ============================================

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ============================================
// ANALYTICS HUB PAGE
// ============================================

export default function AnalyticsPage() {
  const t = useTranslations('admin.analytics');
  const tCommon = useTranslations('common');
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch quick stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const dashboardStats = await api.dashboard.getDashboardStats();

        const totalEmployees = dashboardStats.employees?.total_employees || 0;
        const activeEmployees = dashboardStats.employees?.active_employees || 0;

        // Calculate attrition rate from active vs total if data available
        const attritionRate =
          totalEmployees > 0
            ? parseFloat(((1 - activeEmployees / totalEmployees) * 100).toFixed(1))
            : 0;

        // Fetch compensation overview for avg salary
        let avgSalary = 0;
        try {
          const compData = await api.analytics.getCompensationOverview();
          avgSalary = compData?.avg_salary || 0;
        } catch {
          // Compensation data may not be available for all roles
        }

        setStats({
          totalEmployees,
          employeeChange: 0, // Requires historical data — not available yet
          attritionRate,
          attritionTrend: attritionRate > 5 ? 'up' : attritionRate > 0 ? 'stable' : 'down',
          avgSalary,
          salaryChange: 0,
          absenceRate: 0, // Requires attendance data — not exposed via current API
          absenceTrend: 'stable',
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setStats({
          totalEmployees: 0,
          employeeChange: 0,
          attritionRate: 0,
          attritionTrend: 'stable',
          avgSalary: 0,
          salaryChange: 0,
          absenceRate: 0,
          absenceTrend: 'stable',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  const analyticsModules: AnalyticsModule[] = [
    {
      title: 'Workforce Planning',
      description: 'Trend headcount, previsioni, analisi attrition per dipartimento',
      href: '/admin/analytics/workforce',
      icon: Users,
      color: 'text-blue-500',
      stats: [
        { label: 'Dipendenti', value: stats?.totalEmployees || '-' },
        { label: 'Attrition', value: `${stats?.attritionRate || 0}%` },
      ],
    },
    {
      title: 'AI Predictive Analytics',
      description: 'Flight risk, performance prediction, raccomandazioni AI',
      href: '/admin/analytics/ai',
      icon: Brain,
      color: 'text-purple-500',
      isNew: true,
      stats: [
        { label: 'Modello', value: 'N/D' },
        { label: 'Accuratezza', value: 'N/D' },
      ],
    },
    {
      title: 'Compensation Analytics',
      description: 'Pay equity, salary bands, compa-ratio, total rewards',
      href: '/admin/analytics/compensation',
      icon: DollarSign,
      color: 'text-green-500',
      stats: [
        { label: 'Avg Salary', value: `€${(stats?.avgSalary || 0).toLocaleString('it-IT')}` },
        { label: 'YoY', value: 'N/D' },
      ],
    },
    {
      title: 'Time & Attendance',
      description: 'Assenze, straordinari, ferie, heatmap presenze',
      href: '/admin/analytics/attendance',
      icon: Clock,
      color: 'text-orange-500',
      stats: [
        { label: 'Tasso Assenza', value: 'N/D' },
        { label: 'Trend', value: 'N/D' },
      ],
    },
    {
      title: 'Export & Report',
      description: 'Esporta report PDF/Excel, template personalizzati',
      href: '/admin/analytics/export',
      icon: FileText,
      color: 'text-slate-500',
      stats: [
        { label: 'Template', value: 'N/D' },
        { label: 'Formati', value: 'PDF, XLSX' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Quick Stats */}
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
                      <span className="text-sm">Dipendenti</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      N/D
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {stats!.totalEmployees.toLocaleString('it-IT')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      <span className="text-sm">Attrition Rate</span>
                    </div>
                    {stats!.attritionTrend === 'down' ? (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    ) : stats!.attritionTrend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats!.attritionRate}%</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Avg Salary</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      N/D
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    €{stats!.avgSalary.toLocaleString('it-IT')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Tasso Assenza</span>
                    </div>
                    <span className="text-sm text-muted-foreground">N/D</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">N/D</p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Analytics Modules Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {analyticsModules.map((module) => {
          const Icon = module.icon;

          return (
            <motion.div key={module.href} variants={staggerItem}>
              <Link href={module.href} className="block h-full">
                <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${module.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {module.title}
                            {module.isNew && (
                              <Badge variant="default" className="text-xs">
                                New
                              </Badge>
                            )}
                            {module.isPremium && (
                              <Badge variant="secondary" className="text-xs">
                                Premium
                              </Badge>
                            )}
                          </CardTitle>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <CardDescription className="mt-2">{module.description}</CardDescription>
                  </CardHeader>
                  {module.stats && (
                    <CardContent className="pt-0">
                      <div className="flex gap-4 text-sm">
                        {module.stats.map((stat, idx) => (
                          <div key={idx}>
                            <span className="text-muted-foreground">{stat.label}:</span>{' '}
                            <span className="font-medium">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Azioni Rapide</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/analytics/export">
              <FileText className="h-4 w-4 mr-2" />
              Esporta Report Mensile
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/analytics/workforce">
              <BarChart3 className="h-4 w-4 mr-2" />
              Trend Headcount
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/analytics/ai">
              <Brain className="h-4 w-4 mr-2" />
              Flight Risk Report
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/analytics/compensation">
              <PieChart className="h-4 w-4 mr-2" />
              Pay Equity Analysis
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
