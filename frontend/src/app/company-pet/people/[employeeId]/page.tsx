'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { EmployeeProfile } from '@/components/people/EmployeeProfile';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';

export default function EmployeeDetailPage() {
  const t = useTranslations('companyPet');
  const params = useParams();
  const employeeId = params.employeeId as string;

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: t('breadcrumb.companyPet'), href: '/company-pet' },
          { label: t('people.breadcrumb'), href: '/company-pet/people' },
          { label: t('employeeProfile.breadcrumb') },
        ]}
      />
      <PageHeader title={t('employeeProfile.title')} />
      <EmployeeProfile employeeId={employeeId} />
    </>
  );
}
