'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { BenchmarkDashboard } from '@/components/benchmarking/BenchmarkDashboard';
import { IndustryComparison } from '@/components/benchmarking/IndustryComparison';

export default function BenchmarkingPage() {
  const t = useTranslations('companyPet');
  return (
    <>
      <PageHeader title={t('benchmarking.title')} description={t('benchmarking.description')} />
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">{t('benchmarking.overview')}</TabsTrigger>
          <TabsTrigger value="table">{t('benchmarking.comparisonTable')}</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <BenchmarkDashboard />
        </TabsContent>
        <TabsContent value="table">
          <IndustryComparison />
        </TabsContent>
      </Tabs>
    </>
  );
}
