'use client';

import { useTranslations } from 'next-intl';
import { LearningPathCatalog } from '@/components/governance/learning/LearningPathCatalog';

export default function LearningPathsPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('learningPathCatalog.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('learningPathCatalog.description')}</p>
      </div>
      <LearningPathCatalog />
    </div>
  );
}
