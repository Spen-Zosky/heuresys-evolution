'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { LearningCatalogView } from '@/app/admin/career/learning/_components/learning-catalog-view';

export default function PortalLearningCatalogPage() {
  const t = useTranslations('portal');
  return (
    <LearningCatalogView
      readOnly
      headerActions={<Badge variant="secondary">{t('learningCatalog.personalView')}</Badge>}
    />
  );
}
