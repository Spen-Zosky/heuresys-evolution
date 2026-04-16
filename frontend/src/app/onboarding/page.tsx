import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export const metadata: Metadata = {
  title: 'Configurazione organizzazione — Heuresys',
  description: 'Wizard guidato per configurare la tua organizzazione su Heuresys.',
};

export default async function OnboardingPage() {
  const t = await getTranslations('dashboards');
  return (
    <>
      <h1 className="sr-only">{t('onboarding.title')}</h1>
      <OnboardingWizard />
    </>
  );
}
