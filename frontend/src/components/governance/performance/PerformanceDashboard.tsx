'use client';

import { Target, RotateCcw, Star, Clock, TrendingUp, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGovernanceDashboardStats } from '@/lib/hooks/use-governance-queries';
import Link from 'next/link';

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="rounded-md bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceDashboard() {
  const { data: stats, isLoading } = useGovernanceDashboardStats();
  const t = useTranslations('performance');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const completionPct = stats?.completion_rate
    ? `${Math.round(parseFloat(String(stats.completion_rate)) * 100)}%`
    : '—';

  const avgRating = stats?.avg_rating ? parseFloat(String(stats.avg_rating)).toFixed(1) : '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title={t('activeReviews')} value={stats?.active_cycles ?? 0} icon={RotateCcw} />
        <StatCard title={t('completedReviews')} value={completionPct} icon={TrendingUp} />
        <StatCard title={t('averageScore')} value={avgRating} icon={Star} />
        <StatCard title={t('pendingReviews')} value={stats?.pending_reviews ?? 0} icon={Clock} />
        <StatCard title={t('activeGoals')} value={stats?.active_goals ?? 0} icon={Target} />
        <StatCard
          title={t('recentFeedback')}
          value={stats?.recent_feedback_count ?? 0}
          icon={MessageSquare}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/performance/cycles">{t('reviewCycles')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/performance/goals">{t('goals')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/performance/feedback">{t('feedback')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
