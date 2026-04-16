'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { BreadcrumbNav } from '@/components/navigation/BreadcrumbNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkillClusterView } from '@/components/ontology/SkillClusterView';
import { CareerPathwayView } from '@/components/ontology/CareerPathwayView';
import { ProcessSkillImpactView } from '@/components/ontology/ProcessSkillImpactView';
import { Layers, GitMerge, Zap } from 'lucide-react';

export default function OntologyExplorerPage() {
  const t = useTranslations('companyPet');
  const [tab, setTab] = useState('clusters');

  return (
    <>
      <BreadcrumbNav
        items={[{ label: 'Company PET', href: '/company-pet' }, { label: t('ontology.title') }]}
      />
      <PageHeader title={t('ontology.title')} description={t('ontology.description')} />

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="clusters" className="gap-2">
            <Layers className="h-4 w-4" />
            {t('ontology.skillClusters')}
          </TabsTrigger>
          <TabsTrigger value="pathways" className="gap-2">
            <GitMerge className="h-4 w-4" />
            {t('ontology.careerPathways')}
          </TabsTrigger>
          <TabsTrigger value="impact" className="gap-2">
            <Zap className="h-4 w-4" />
            {t('ontology.processSkillImpact')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clusters">
          <SkillClusterView />
        </TabsContent>

        <TabsContent value="pathways">
          <CareerPathwayView />
        </TabsContent>

        <TabsContent value="impact">
          <ProcessSkillImpactView />
        </TabsContent>
      </Tabs>
    </>
  );
}
