'use client';

import { useTranslations } from 'next-intl';
import { CertificationTracker } from '@/components/governance/learning/CertificationTracker';

export default function CertificationsPage() {
  const t = useTranslations('companyPet');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('certifications.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('certifications.description')}</p>
      </div>
      <CertificationTracker />
    </div>
  );
}
