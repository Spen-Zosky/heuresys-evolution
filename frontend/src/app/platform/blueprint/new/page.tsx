'use client';

import { useTranslations } from 'next-intl';
import { BlueprintWizard } from '@/components/blueprint/blueprint-wizard';

export default function BlueprintNewPage() {
  const t = useTranslations('platform');
  return (
    <>
      <h1 className="sr-only">{t('blueprint.new')}</h1>
      <BlueprintWizard />
    </>
  );
}
