'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Users, MapPin, PieChart, ArrowRight, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

const subPages = [
  {
    title: 'Workforce Demographics',
    description:
      'Analisi demografica della forza lavoro: eta, genere, seniority, tipologie contrattuali',
    href: '/company-pet/workforce/demographics',
    icon: PieChart,
    metricLabel: 'dipendenti totali',
    summaryKey: 'total_employees' as const,
  },
  {
    title: 'Workforce by Location',
    description: 'Distribuzione geografica della forza lavoro per sede, regione e paese',
    href: '/company-pet/workforce/locations',
    icon: MapPin,
    metricLabel: 'sedi operative',
    summaryKey: 'total_locations' as const,
  },
];

interface Summary {
  total_employees?: number;
  total_locations?: number;
  avg_age?: number;
  turnover_rate?: number;
  [key: string]: unknown;
}

export default function WorkforcePage() {
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
    { label: 'Dipendenti Totali', value: summary.total_employees, icon: Users },
    { label: 'Sedi', value: summary.total_locations, icon: MapPin },
    {
      label: 'Eta Media',
      value: summary.avg_age ? `${Number(summary.avg_age).toFixed(1)}` : null,
      icon: PieChart,
    },
    {
      label: 'Turnover Rate',
      value: summary.turnover_rate ? `${Number(summary.turnover_rate).toFixed(1)}%` : null,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('workforce.title')} description={t('workforce.description')} />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="h-7 w-14" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value != null ? stat.value.toLocaleString() : 'N/A'}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub-page Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subPages.map((page) => {
          const val = summary[page.summaryKey];
          const displayMetric = loading
            ? '...'
            : val != null
              ? Number(val).toLocaleString()
              : 'N/A';

          return (
            <Link key={page.href} href={page.href} className="group">
              <Card className="h-full hover:shadow-md transition-all hover:border-primary/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <page.icon className="h-6 w-6 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="text-lg mt-3">{page.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{page.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-foreground">{displayMetric}</span>
                    <span className="text-sm text-muted-foreground">{page.metricLabel}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
