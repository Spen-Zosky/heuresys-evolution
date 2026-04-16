'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { BarChart3, TrendingUp, Users, ArrowRight, Target, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

const subPages = [
  {
    title: 'Organization Analytics',
    description:
      "Dashboard KPI con metriche chiave sull'organizzazione, trend e indicatori di salute",
    href: '/company-pet/organization/analytics',
    icon: BarChart3,
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    title: 'Organization Performance',
    description:
      'Metriche di performance aggregata, obiettivi raggiunti, valutazioni e produttivita',
    href: '/company-pet/organization/performance',
    icon: TrendingUp,
    color: 'bg-green-500/10 text-green-600',
  },
  {
    title: 'Organization Talent',
    description:
      'Panoramica del pool di talenti, gap competenze, piani di successione e potenziale',
    href: '/company-pet/organization/talent',
    icon: Users,
    color: 'bg-purple-500/10 text-purple-600',
  },
];

interface Summary {
  total_employees?: number;
  total_goals?: number;
  performance_reviews?: number;
  retention_rate?: number;
  [key: string]: unknown;
}

export default function OrganizationPage() {
  const t = useTranslations('companyPet');
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const resp = await apiClient.get<{ data: { summary?: Summary } }>(
        '/api/v1/analytics/dashboard'
      );
      setSummary(resp?.data?.summary ?? {});
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const stats = [
    {
      label: 'Dipendenti Attivi',
      value: summary.total_employees,
      icon: Users,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Obiettivi Attivi',
      value: summary.total_goals,
      icon: Target,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Valutazioni',
      value: summary.performance_reviews,
      icon: Award,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Tasso Retention',
      value: summary.retention_rate,
      icon: TrendingUp,
      format: (v: number) => `${v.toFixed(1)}%`,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('orgOverview.title')} description={t('orgOverview.description')} />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  {loading ? (
                    <Skeleton className="h-7 w-14" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value != null ? stat.format(Number(stat.value)) : 'N/A'}
                    </p>
                  )}
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub-page Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {subPages.map((page) => (
          <Link key={page.href} href={page.href} className="group">
            <Card className="h-full hover:shadow-md transition-all hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${page.color}`}
                  >
                    <page.icon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-lg mt-3">{page.title}</CardTitle>
                <CardDescription className="leading-relaxed">{page.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
