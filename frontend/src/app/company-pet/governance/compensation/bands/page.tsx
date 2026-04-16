'use client';

import { useTranslations } from 'next-intl';
import { SalaryBandEditor } from '@/components/governance/compensation/SalaryBandEditor';

export default function SalaryBandsPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('salaryBands.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('salaryBands.description')}</p>
      </div>
      <SalaryBandEditor />
    </div>
  );
}
