'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ProcessDetail } from '@/components/processes/ProcessDetail';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';

export default function ProcessDetailPage() {
  const t = useTranslations('companyPet');
  const params = useParams();
  const processId = params.processId as string;

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: t('breadcrumb.companyPet'), href: '/company-pet' },
          { label: t('processes.breadcrumb'), href: '/company-pet/processes' },
          { label: t('processDetail.breadcrumb') },
        ]}
      />
      <PageHeader title={t('processDetail.title')} />
      <ProcessDetail processId={processId} />
    </>
  );
}
