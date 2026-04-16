'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { SkillAssessmentView } from '@/app/admin/career/skills/_components/skill-assessment-view';

export default function PortalSkillsPage() {
  const t = useTranslations('portal');
  return (
    <SkillAssessmentView
      readOnly
      headerActions={<Badge variant="secondary">{t('personalView')}</Badge>}
    />
  );
}
