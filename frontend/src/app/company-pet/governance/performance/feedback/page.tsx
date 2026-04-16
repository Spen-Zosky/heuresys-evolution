'use client';

import { useTranslations } from 'next-intl';
import { FeedbackHub } from '@/components/governance/performance/FeedbackHub';

export default function FeedbackPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('feedbackHub.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('feedbackHub.description')}</p>
      </div>
      <FeedbackHub />
    </div>
  );
}
