'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { WorkforceKpisView } from '@/app/admin/analytics/workforce/_components/workforce-kpis-view';

export default function PortalAnalyticsPage() {
  const t = useTranslations('portal');
  return (
    <WorkforceKpisView
      readOnly
      headerActions={<Badge variant="secondary">{t('organizationView')}</Badge>}
    />
  );
}
