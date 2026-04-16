'use client';

import { useTranslations } from 'next-intl';
import { RequisitionList } from '@/components/governance/recruiting/RequisitionList';

export default function RequisitionsPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('requisitions.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('requisitions.description')}</p>
      </div>
      <RequisitionList />
    </div>
  );
}
