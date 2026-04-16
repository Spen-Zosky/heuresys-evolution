'use client';

import { useTranslations } from 'next-intl';
import { GoalTracker } from '@/components/governance/performance/GoalTracker';

export default function GoalsPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('goalTracker.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('goalTracker.description')}</p>
      </div>
      <GoalTracker />
    </div>
  );
}
