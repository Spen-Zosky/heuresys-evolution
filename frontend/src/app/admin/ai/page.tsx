'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, FileSearch, History } from 'lucide-react';

export default function AiPage() {
  const t = useTranslations('admin.ai');

  const sections = [
    {
      key: 'chat',
      href: '/admin/ai/chat',
      icon: Brain,
    },
    {
      key: 'documents',
      href: '/admin/ai/documents',
      icon: FileSearch,
    },
    {
      key: 'sessions',
      href: '/admin/ai/sessions',
      icon: History,
    },
  ];

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
                  <h3 className="font-semibold text-lg">{t(`items.${section.key}.name`)}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(`items.${section.key}.description`)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
