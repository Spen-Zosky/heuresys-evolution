'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { GapSummaryCard } from '@/components/analytics/GapSummaryCard';
import { SkillGapChart } from '@/components/analytics/SkillGapChart';
import { useOrgUnitSkillGaps, useOrgUnit } from '@/lib/hooks/use-org-queries';

export default function OrgUnitGapsPage() {
  const t = useTranslations('companyPet');
  const params = useParams();
  const orgUnitId = params.orgUnitId as string;

  const { data: orgUnit } = useOrgUnit(orgUnitId);
  const { data: gaps, isLoading, isError, refetch } = useOrgUnitSkillGaps(orgUnitId);

  return (
    <>
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
        <Link href="/company-pet/structure" className="hover:text-foreground transition-colors">
          {t('structure.breadcrumb')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          href={`/company-pet/structure/${orgUnitId}`}
          className="hover:text-foreground transition-colors"
        >
          {orgUnit?.name ?? t('orgUnitDetail.breadcrumb')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{t('gapAnalysis.breadcrumb')}</span>
      </nav>

      <PageHeader
        title={t('gapAnalysis.title')}
        description={
          orgUnit
            ? t('gapAnalysis.descriptionWithUnit', { unitName: orgUnit.name })
            : t('gapAnalysis.description')
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="font-semibold">{t('gapAnalysis.loadingError')}</p>
              <Button variant="outline" onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : gaps ? (
        <div className="space-y-6">
          <GapSummaryCard gaps={gaps} />
          <SkillGapChart gaps={gaps} />
        </div>
      ) : null}
    </>
  );
}
