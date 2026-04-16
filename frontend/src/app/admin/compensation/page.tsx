'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Gift, TrendingUp } from 'lucide-react';

const sections = [
  {
    name: 'Salary Bands',
    href: '/admin/compensation/salary-bands',
    description: 'Salary ranges, pay grades and compensation benchmarks',
    icon: Wallet,
  },
  {
    name: 'Bonus Plans',
    href: '/admin/compensation/bonus-plans',
    description: 'Bonus structures, incentive plans and variable pay',
    icon: Gift,
  },
  {
    name: 'Merit Cycles',
    href: '/admin/compensation/merit-cycles',
    description: 'Merit increase cycles and salary review processes',
    icon: TrendingUp,
  },
];

export default function CompensationPage() {
  const t = useTranslations('admin.compensation');
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
