'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import {
  Target,
  ClipboardCheck,
  MessageSquare,
  ThumbsUp,
  Flag,
  Scale,
  RotateCw,
} from 'lucide-react';

const sectionDefs = [
  { key: 'goals', href: '/admin/performance/goals', icon: Target },
  { key: 'reviews', href: '/admin/performance/reviews', icon: ClipboardCheck },
  { key: 'checkIns', href: '/admin/performance/check-ins', icon: MessageSquare },
  { key: 'feedback', href: '/admin/performance/feedback', icon: ThumbsUp },
  { key: 'okrs', href: '/admin/performance/okrs', icon: Flag },
  { key: 'calibration', href: '/admin/performance/calibration', icon: Scale },
  { key: 'reviewCycles', href: '/admin/performance/review-cycles', icon: RotateCw },
];

export default function PerformancePage() {
  const t = useTranslations('admin.performance');

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
