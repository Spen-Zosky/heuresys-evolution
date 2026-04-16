'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Palette, Layout, Layers } from 'lucide-react';

export default function DesignHubPage() {
  const t = useTranslations('admin.design');

  const designResources = [
    {
      key: 'wireframes',
      href: '/admin/design/wireframes',
      icon: Layout,
    },
    {
      key: 'designSystem',
      href: '/admin/design/wireframes',
      icon: Palette,
    },
    {
      key: 'uiComponents',
      href: '/admin/design/wireframes',
      icon: Layers,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {designResources.map((resource) => (
          <Link key={resource.key} href={resource.href}>
            <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <resource.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{t(`items.${resource.key}.title`)}</CardTitle>
                <CardDescription>{t(`items.${resource.key}.description`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
