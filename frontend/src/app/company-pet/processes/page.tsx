'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { ProcessList } from '@/components/processes/ProcessList';

export default function ProcessesPage() {
  const t = useTranslations('companyPet');
  return (
    <>
      <PageHeader title={t('processes.title')} description={t('processes.description')} />
      <ProcessList />
    </>
  );
}
