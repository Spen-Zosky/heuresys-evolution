import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ReviewCycleDetail } from '@/components/governance/performance/ReviewCycleDetail';

interface Props {
  params: Promise<{ cycleId: string }>;
}

export default async function ReviewCycleDetailPage({ params }: Props) {
  const { cycleId } = await params;
  const t = await getTranslations('companyPet');

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t('reviewCycleDetail.title')}</h1>
      <div>
        <Link
          href="/company-pet/governance/performance/cycles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('reviewCycles.title')}
        </Link>
      </div>
      <ReviewCycleDetail cycleId={cycleId} />
    </div>
  );
}
