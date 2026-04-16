'use client';

import { useTranslations } from 'next-intl';
import { PipelineView } from '@/components/governance/recruiting/PipelineView';

export default function PipelinePage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('pipeline.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('pipeline.description')}</p>
      </div>
      <PipelineView />
    </div>
  );
}
