'use client';

import { useTranslations } from 'next-intl';
import { CompAnalytics } from '@/components/governance/compensation/CompAnalytics';

export default function CompAnalyticsPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('compensationAnalytics.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('compensationAnalytics.description')}
        </p>
      </div>
      <CompAnalytics />
    </div>
  );
}
