'use client';

import { useTranslations } from 'next-intl';
import { BlueprintDashboard } from '@/components/blueprint/blueprint-dashboard';

export default function BlueprintPage() {
  const t = useTranslations('platform');
  return (
    <>
      <h1 className="sr-only">{t('blueprint.title')}</h1>
      <BlueprintDashboard />
    </>
  );
}
