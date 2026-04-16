'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { BlueprintResults } from '@/components/blueprint/blueprint-results';

export default function BlueprintRunPage() {
  const t = useTranslations('platform');
  const params = useParams<{ runId: string }>();
  return (
    <>
      <h1 className="sr-only">{t('blueprint.runDetail')}</h1>
      <BlueprintResults runId={params.runId} />
    </>
  );
}
