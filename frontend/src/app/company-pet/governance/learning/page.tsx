'use client';

import { useTranslations } from 'next-intl';
import { LearningDashboard } from '@/components/governance/learning/LearningDashboard';

export default function LearningPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('learningDevelopment.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('learningDevelopment.description')}</p>
      </div>
      <LearningDashboard />
    </div>
  );
}
