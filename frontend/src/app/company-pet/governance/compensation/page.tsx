'use client';

import { useTranslations } from 'next-intl';
import { CompensationDashboard } from '@/components/governance/compensation/CompensationDashboard';

export default function CompensationPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('compensationDesign.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('compensationDesign.description')}</p>
      </div>
      <CompensationDashboard />
    </div>
  );
}
