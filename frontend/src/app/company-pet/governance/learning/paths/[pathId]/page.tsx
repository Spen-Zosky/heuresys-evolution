import { getTranslations } from 'next-intl/server';
import { LearningPathDetail } from '@/components/governance/learning/LearningPathDetail';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ pathId: string }>;
}

export default async function LearningPathDetailPage({ params }: Props) {
  const { pathId } = await params;
  const t = await getTranslations('companyPet');

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t('learningPathDetail.title')}</h1>
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/company-pet/governance/learning/paths">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('learningPathDetail.backToCatalog')}
          </Link>
        </Button>
      </div>
      <LearningPathDetail pathId={pathId} />
    </div>
  );
}
