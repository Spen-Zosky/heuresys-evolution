'use client';

import { useTranslations } from 'next-intl';
import { RecruitingDashboard } from '@/components/governance/recruiting/RecruitingDashboard';

export default function RecruitingPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('recruitingGovernance.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('recruitingGovernance.description')}
        </p>
      </div>
      <RecruitingDashboard />
    </div>
  );
}
