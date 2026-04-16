'use client';

import { useTranslations } from 'next-intl';
import { PortalPageShell } from '@/components/portal/portal-page-shell';
import { TabPerformance } from '@/app/admin/employees/[id]/_components/tab-performance';

export default function PortalReviewsPage() {
  const t = useTranslations('portal.reviews');
  return (
    <PortalPageShell title={t('title')} description={t('description')}>
      {(employeeId) => <TabPerformance employeeId={employeeId} />}
    </PortalPageShell>
  );
}
