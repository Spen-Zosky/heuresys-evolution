'use client';

import { useTranslations } from 'next-intl';
import { ReviewCycleList } from '@/components/governance/performance/ReviewCycleList';

export default function ReviewCyclesPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('reviewCycles.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('reviewCycles.description')}</p>
      </div>
      <ReviewCycleList />
    </div>
  );
}
