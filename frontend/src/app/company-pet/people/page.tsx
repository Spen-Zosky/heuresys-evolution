'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { EmployeeList } from '@/components/people/EmployeeList';

export default function PeoplePage() {
  const t = useTranslations('companyPet');
  return (
    <>
      <PageHeader title={t('people.title')} description={t('people.description')} />
      <EmployeeList />
    </>
  );
}
