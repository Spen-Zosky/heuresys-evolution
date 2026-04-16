'use client';

import { useTranslations } from 'next-intl';
import { PortalPageShell } from '@/components/portal/portal-page-shell';
import { TabTraining } from '@/app/admin/employees/[id]/_components/tab-training';

export default function PortalLearningPage() {
  const t = useTranslations('portal.learning');
  return (
    <PortalPageShell title={t('title')} description={t('description')}>
      {(employeeId) => <TabTraining employeeId={employeeId} />}
    </PortalPageShell>
  );
}
