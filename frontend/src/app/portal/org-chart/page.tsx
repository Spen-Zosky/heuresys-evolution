'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { OrgUnitsView } from '@/app/admin/org-units/_components/org-units-view';

/**
 * Portal org-chart page — read-only reuse of the shared OrgUnitsView component
 * (P11: no duplication with /admin/org-units).
 */
export default function PortalOrgChartPage() {
  const t = useTranslations('portal');
  return (
    <div className="space-y-6">
      <OrgUnitsView
        readOnly
        headerActions={<Badge variant="secondary">{t('personalView')}</Badge>}
      />
    </div>
  );
}
