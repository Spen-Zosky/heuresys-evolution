'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import TabOverview from './_components/tab-overview';
import TabOrganization from './_components/tab-organization';
import { TabContracts } from './_components/tab-contracts';
import { TabSkills } from './_components/tab-skills';
import { TabTraining } from './_components/tab-training';
import { TabGoals } from './_components/tab-goals';
import { TabPerformance } from './_components/tab-performance';
import { TabAttendance } from './_components/tab-attendance';
import { TabDocuments } from './_components/tab-documents';
import { TabCareerRisk } from './_components/tab-career-risk';
import { useTranslations } from 'next-intl';

const TAB_CONFIG = [
  { value: 'panoramica', label: 'Panoramica' },
  { value: 'organizzazione', label: 'Organizzazione' },
  { value: 'contratti', label: 'Contratti' },
  { value: 'competenze', label: 'Competenze' },
  { value: 'formazione', label: 'Formazione' },
  { value: 'obiettivi', label: 'Obiettivi' },
  { value: 'performance', label: 'Performance' },
  { value: 'presenze', label: 'Presenze' },
  { value: 'documenti', label: 'Documenti' },
  { value: 'carriera', label: 'Carriera & Risk' },
] as const;

type TabValue = (typeof TAB_CONFIG)[number]['value'];

function getStatusBadge(status: string, isActive: boolean) {
  if (!isActive) {
    return <Badge variant="destructive">Inattivo</Badge>;
  }
  switch (status) {
    case 'active':
      return (
        <Badge variant="default" className="bg-green-500">
          Attivo
        </Badge>
      );
    case 'on_leave':
      return <Badge variant="secondary">In congedo</Badge>;
    case 'terminated':
      return <Badge variant="destructive">Terminato</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function EmployeeDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = params.id as string;

  const initialTab = (searchParams.get('tab') as TabValue) || 'panoramica';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<TabValue>>(new Set([initialTab]));
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.employees.getEmployeeById(employeeId);
      setEmployee(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dipendente');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    setLoadedTabs((prev) => new Set(prev).add(tab));
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <ApiError
        message={error || 'Dipendente non trovato'}
        onRetry={fetchEmployee}
        variant="notFound"
      />
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
          {employee.first_name?.[0]}
          {employee.last_name?.[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {employee.first_name} {employee.last_name}
            </h1>
            {getStatusBadge(employee.employment_status, employee.is_active)}
          </div>
          <p className="text-muted-foreground">{employee.job_title}</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={staggerItem}>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full overflow-x-auto whitespace-nowrap h-auto gap-1">
            {TAB_CONFIG.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="panoramica">
            {loadedTabs.has('panoramica') && <TabOverview employee={employee} />}
          </TabsContent>

          <TabsContent value="organizzazione">
            {loadedTabs.has('organizzazione') && <TabOrganization employee={employee} />}
          </TabsContent>

          <TabsContent value="contratti">
            {loadedTabs.has('contratti') && <TabContracts employeeId={employeeId} />}
          </TabsContent>

          <TabsContent value="competenze">
            {loadedTabs.has('competenze') && <TabSkills employeeId={employeeId} />}
          </TabsContent>

          <TabsContent value="formazione">
            {loadedTabs.has('formazione') && <TabTraining employeeId={employeeId} />}
          </TabsContent>

          <TabsContent value="obiettivi">
            {loadedTabs.has('obiettivi') && <TabGoals employeeId={employeeId} />}
          </TabsContent>

          <TabsContent value="performance">
            {loadedTabs.has('performance') && <TabPerformance employeeId={employeeId} />}
          </TabsContent>

          <TabsContent value="presenze">
            {loadedTabs.has('presenze') && <TabAttendance employeeId={employeeId} />}
          </TabsContent>

          <TabsContent value="documenti">
            {loadedTabs.has('documenti') && <TabDocuments employeeId={employeeId} />}
          </TabsContent>

          <TabsContent value="carriera">
            {loadedTabs.has('carriera') && <TabCareerRisk employeeId={employeeId} />}
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

export default function EmployeeDetailPage() {
  const t = useTranslations('admin.employees.detail');
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EmployeeDetailContent />
    </Suspense>
  );
}
