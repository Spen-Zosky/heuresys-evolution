'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { OrgUnitDetail } from '@/components/structure/OrgUnitDetail';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';

export default function OrgUnitDetailPage() {
  const t = useTranslations('companyPet');
  const params = useParams();
  const orgUnitId = params.orgUnitId as string;

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: t('breadcrumb.companyPet'), href: '/company-pet' },
          { label: t('structure.breadcrumb'), href: '/company-pet/structure' },
          { label: t('orgUnitDetail.breadcrumb') },
        ]}
      />
      <PageHeader title={t('orgUnitDetail.title')} />
      <OrgUnitDetail orgUnitId={orgUnitId} />
    </>
  );
}
