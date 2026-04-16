'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { OrgTree } from '@/components/structure/OrgTree';

export default function StructurePage() {
  const t = useTranslations('companyPet');
  return (
    <>
      <PageHeader title={t('structure.title')} description={t('structure.description')} />
      <OrgTree />
    </>
  );
}
