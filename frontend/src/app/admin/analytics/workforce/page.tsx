'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { WorkforceKpisView } from './_components/workforce-kpis-view';
import { useTranslations } from 'next-intl';

export default function WorkforcePlanningPage() {
  const t = useTranslations('admin.analytics.workforce');
  return (
    <WorkforceKpisView
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Go back" asChild>
            <Link href="/admin/analytics">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      }
    />
  );
}
