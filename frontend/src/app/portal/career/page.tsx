'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { CareerDashboardView } from '@/app/admin/career/_components/career-dashboard-view';

/**
 * Portal career page — read-only reuse of the shared CareerDashboardView
 * (P11: no duplication with /admin/career).
 */
export default function PortalCareerPage() {
  const t = useTranslations('portal');
  return (
    <CareerDashboardView
      readOnly
      linkPrefix="/portal/career"
      headerActions={<Badge variant="secondary">{t('personalView')}</Badge>}
    />
  );
}
