'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LearningCatalogView } from './_components/learning-catalog-view';
import { useTranslations } from 'next-intl';

export default function LearningRecommendationsPage() {
  const t = useTranslations('admin.career.learning');
  return (
    <LearningCatalogView
      headerActions={
        <Button asChild>
          <Link href="/admin/courses">
            <BookOpen className="h-4 w-4 mr-2" />
            Catalogo Completo
          </Link>
        </Button>
      }
    />
  );
}
