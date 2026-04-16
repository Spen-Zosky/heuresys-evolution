'use client';

import Link from 'next/link';
import { MessageSquare, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CareerDashboardView } from './_components/career-dashboard-view';
import { useTranslations } from 'next-intl';

export default function CareerDashboardPage() {
  const t = useTranslations('admin.career');
  return (
    <CareerDashboardView
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/career/chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('aiCoach')}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/career/paths">
              <Target className="h-4 w-4 mr-2" />
              {t('explorePaths')}
            </Link>
          </Button>
        </div>
      }
    />
  );
}
