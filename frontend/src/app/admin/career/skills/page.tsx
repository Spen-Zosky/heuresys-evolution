'use client';

import { SkillAssessmentView } from './_components/skill-assessment-view';
import { useTranslations } from 'next-intl';

export default function SkillGapAnalysisPage() {
  const t = useTranslations('admin.career.skills');
  return <SkillAssessmentView />;
}
