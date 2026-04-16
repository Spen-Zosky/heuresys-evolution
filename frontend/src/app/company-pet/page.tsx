'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  BarChart3,
  Network,
  Users,
  GitCompare,
  Building2,
  PieChart,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformSummary {
  total_employees?: number;
  total_org_units?: number;
  total_cost_centers?: number;
}

const sections = [
  {
    title: 'Cost Breakdowns',
    description: 'Analisi costi HR, dipartimenti e centri di costo',
    href: '/company-pet/breakdowns',
    icon: PieChart,
    metricLabel: 'Centri di costo',
    summaryKey: 'total_cost_centers' as keyof PlatformSummary,
  },
  {
    title: 'Organization Hierarchy',
    description: 'Visualizzazione ad albero della struttura organizzativa',
    href: '/company-pet/hierarchy',
    icon: Network,
    metricLabel: 'Unità organizzative',
  },
  {
    title: 'Org Chart',
    description: 'Organigramma interattivo con ruoli e relazioni',
    href: '/company-pet/org-chart',
    icon: Building2,
    metricLabel: 'Dipartimenti',
  },
  {
    title: 'Organization Overview',
    description: 'Analytics, performance e talent pool organizzativi',
    href: '/company-pet/organization',
    icon: BarChart3,
    metricLabel: 'Dipendenti',
    summaryKey: 'total_employees' as keyof PlatformSummary,
  },
  {
    title: 'Analysis Sessions',
    description: 'Sessioni di analisi PET e storico risultati',
    href: '/company-pet/sessions',
    icon: Clock,
    metricLabel: 'Sessioni',
    summaryKey: null,
    staticMetric: '-',
  },
  {
    title: 'Staging Comparison',
    description: 'Confronto side-by-side tra scenari organizzativi',
    href: '/company-pet/staging-comparison',
    icon: GitCompare,
    metricLabel: 'Scenari attivi',
    summaryKey: null,
    staticMetric: '-',
  },
  {
    title: 'Workforce Analytics',
    description: 'Demografia, distribuzione e analytics della forza lavoro',
    href: '/company-pet/workforce',
    icon: Users,
    metricLabel: 'Dipendenti',
    summaryKey: 'total_employees' as keyof PlatformSummary,
  },
];

export default function CompanyPETPage() {
  const t = useTranslations('companyPet');
  const [summary, setSummary] = useState<PlatformSummary>({});
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const resp = await apiClient.get<{ data: { summary?: PlatformSummary } }>(
        '/api/v1/analytics/dashboard'
      );
      setSummary(resp?.data?.summary ?? {});
    } catch {
      // silently fail — page still renders with '-' placeholders
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const kpis = [
    { label: 'Dipendenti Totali', value: summary.total_employees, icon: Users },
    { label: 'Centri di Costo', value: summary.total_cost_centers, icon: PieChart },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('petAnalysis.title')} description={t('petAnalysis.description')} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="h-7 w-12" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {kpi.value != null ? kpi.value.toLocaleString() : 'N/A'}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => {
          const metricVal = section.summaryKey ? summary[section.summaryKey] : null;
          const displayMetric = loading
            ? '...'
            : (section.staticMetric ?? (metricVal != null ? metricVal.toLocaleString() : 'N/A'));

          return (
            <Link key={section.href} href={section.href} className="group">
              <Card className="h-full hover:shadow-md transition-all hover:border-primary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <section.icon className="h-5 w-5 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="text-lg mt-3">{section.title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-foreground">{displayMetric}</span>
                    <span className="text-sm text-muted-foreground">{section.metricLabel}</span>
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
