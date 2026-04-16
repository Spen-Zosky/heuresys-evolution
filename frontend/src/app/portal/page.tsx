'use client';

import { useTranslations } from 'next-intl';
import HeroSection from '@/components/widgets/hero-section';
import WorkspaceRenderer from '@/components/widgets/workspace-renderer';
import { useWorkspace } from '@/lib/hooks/use-workspace';

export default function PortalHomePage() {
  const t = useTranslations('portal');
  const { widgets, layout, loading } = useWorkspace();

  return (
    <div className="space-y-6">
      <HeroSection />
      <WorkspaceRenderer widgets={widgets} layout={layout} loading={loading} />
    </div>
  );
}
