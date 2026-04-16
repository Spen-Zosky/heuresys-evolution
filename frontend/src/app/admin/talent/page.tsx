'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  UserCog,
  TrendingUp,
  ClipboardList,
  Crown,
  Compass,
  SearchCheck,
  ArrowLeftRight,
  Receipt,
} from 'lucide-react';

const sectionDefs = [
  { key: 'skills', href: '/admin/talent/skills', icon: Sparkles },
  { key: 'skillProfiles', href: '/admin/talent/skill-profiles', icon: UserCog },
  { key: 'careerPaths', href: '/admin/talent/career-paths', icon: TrendingUp },
  { key: 'assessments', href: '/admin/talent/assessments', icon: ClipboardList },
  { key: 'succession', href: '/admin/talent/succession', icon: Crown },
  { key: 'escoExplorer', href: '/admin/talent/esco-explorer', icon: Compass },
  { key: 'gapAnalysis', href: '/admin/talent/gap-analysis', icon: SearchCheck },
  { key: 'internalMobility', href: '/admin/talent/mobility', icon: ArrowLeftRight },
  { key: 'payStubs', href: '/admin/talent/pay-stubs', icon: Receipt },
];

export default function TalentPage() {
  const t = useTranslations('admin.talent');

  const sections = sectionDefs.map((s) => ({
    ...s,
    name: t(`sections.${s.key}.name`),
    description: t(`sections.${s.key}.description`),
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <section.icon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">{section.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
