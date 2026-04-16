'use client';

import { useTranslations } from 'next-intl';
import { PerformanceDashboard } from '@/components/governance/performance/PerformanceDashboard';

export default function PerformancePage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('performanceGovernance.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('performanceGovernance.description')}
        </p>
      </div>
      <PerformanceDashboard />
    </div>
  );
}
