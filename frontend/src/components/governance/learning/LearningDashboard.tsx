'use client';

import { BookOpen, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLearningDashboardStats, useLearningPaths } from '@/lib/hooks/use-governance-queries';
import Link from 'next/link';

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  alert,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${alert ? 'text-amber-600' : ''}`}>{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={`rounded-md p-2 ${alert ? 'bg-amber-100' : 'bg-primary/10'}`}>
            <Icon className={`h-5 w-5 ${alert ? 'text-amber-600' : 'text-primary'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LearningDashboard() {
  const t = useTranslations('learning');
  const { data: stats, isLoading: statsLoading } = useLearningDashboardStats();
  const { data: topPaths, isLoading: pathsLoading } = useLearningPaths({
    status: 'published',
    limit: 5,
  });

  const isLoading = statsLoading || pathsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title={t('paths')} value={stats?.active_paths ?? 0} icon={BookOpen} />
        <StatCard title={t('enrolledCourses')} value={stats?.total_enrollments ?? 0} icon={Users} />
        <StatCard
          title={t('completedCourses')}
          value={`${stats?.completion_rate ?? 0}%`}
          icon={TrendingUp}
        />
        <StatCard
          title={t('upcomingDeadlines')}
          value={stats?.expiring_certifications ?? 0}
          icon={AlertTriangle}
          alert={(stats?.expiring_certifications ?? 0) > 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('paths')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!topPaths?.items?.length ? (
            <p className="text-sm text-muted-foreground">{t('catalog')}</p>
          ) : (
            <div className="space-y-2">
              {topPaths.items.map((path) => (
                <Link
                  key={path.id}
                  href={`/company-pet/governance/learning/paths/${path.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{path.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {path.provider_name ?? 'Provider n.d.'} · {path.courses_count ?? 0} corsi
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-xs text-muted-foreground">
                      {path.enrollment_count ?? 0} iscritti
                    </p>
                    {path.avg_rating != null && (
                      <p className="text-xs font-medium">
                        ★ {parseFloat(String(path.avg_rating)).toFixed(1)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/learning/paths">{t('catalog')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/learning/certifications">
              {t('certifications')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
