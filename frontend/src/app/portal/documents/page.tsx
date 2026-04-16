'use client';

import { useTranslations } from 'next-intl';
import { PortalPageShell } from '@/components/portal/portal-page-shell';
import { TabDocuments } from '@/app/admin/employees/[id]/_components/tab-documents';

export default function PortalDocumentsPage() {
  const t = useTranslations('portal.documents');
  return (
    <PortalPageShell title={t('title')} description={t('description')}>
      {(employeeId) => <TabDocuments employeeId={employeeId} />}
    </PortalPageShell>
  );
}
