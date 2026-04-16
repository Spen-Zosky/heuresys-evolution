'use client';

import { useTranslations } from 'next-intl';
import { PortalPageShell } from '@/components/portal/portal-page-shell';
import { TabGoals } from '@/app/admin/employees/[id]/_components/tab-goals';

export default function PortalGoalsPage() {
  const t = useTranslations('portal.goals');
  return (
    <PortalPageShell title={t('title')} description={t('description')}>
      {(employeeId) => <TabGoals employeeId={employeeId} />}
    </PortalPageShell>
  );
}
