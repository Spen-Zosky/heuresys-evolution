'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import TabOverview from '@/app/admin/employees/[id]/_components/tab-overview';
import TabOrganization from '@/app/admin/employees/[id]/_components/tab-organization';
import { TabContracts } from '@/app/admin/employees/[id]/_components/tab-contracts';
import { TabSkills } from '@/app/admin/employees/[id]/_components/tab-skills';
import { TabTraining } from '@/app/admin/employees/[id]/_components/tab-training';
import { TabGoals } from '@/app/admin/employees/[id]/_components/tab-goals';
import { TabPerformance } from '@/app/admin/employees/[id]/_components/tab-performance';
import { TabAttendance } from '@/app/admin/employees/[id]/_components/tab-attendance';
import { TabDocuments } from '@/app/admin/employees/[id]/_components/tab-documents';
import { TabCareerRisk } from '@/app/admin/employees/[id]/_components/tab-career-risk';

const TAB_VALUES = [
  'panoramica',
  'organizzazione',
  'contratti',
  'competenze',
  'formazione',
  'obiettivi',
  'performance',
  'presenze',
  'documenti',
  'carriera',
] as const;

type TabValue = (typeof TAB_VALUES)[number];

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tTabs = useTranslations('admin.employees.tabs');
  const tStatus = useTranslations('admin.employees.status');
  const initialTab = (searchParams.get('tab') as TabValue) || 'panoramica';

  const TAB_CONFIG: { value: TabValue; label: string }[] = [
    { value: 'panoramica', label: tTabs('overview') },
    { value: 'organizzazione', label: tTabs('organization') },
    { value: 'contratti', label: tTabs('contracts') },
    { value: 'competenze', label: tTabs('skills') },
    { value: 'formazione', label: tTabs('training') },
    { value: 'obiettivi', label: tTabs('goals') },
    { value: 'performance', label: tTabs('performance') },
    { value: 'presenze', label: tTabs('attendance') },
    { value: 'documenti', label: tTabs('documents') },
    { value: 'carriera', label: tTabs('careerRisk') },
  ];

  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<TabValue>>(new Set([initialTab]));
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployee = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>('/api/v1/employees/me');
      const profile = res?.data?.profile || res?.data;
      if (!profile?.id) throw new Error('Profilo non disponibile');
      setEmployee(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento profilo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, []);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    setLoadedTabs((prev) => new Set(prev).add(tab));
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  function getStatusBadge(status: string, isActive: boolean) {
    if (!isActive) return <Badge variant="destructive">{tStatus('inactive')}</Badge>;
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-500">
            {tStatus('active')}
          </Badge>
        );
      case 'on_leave':
        return <Badge variant="secondary">{tStatus('on_leave')}</Badge>;
      case 'terminated':
        return <Badge variant="destructive">{tStatus('terminated')}</Badge>;
      default:
        return <Badge variant="outline">{status || '-'}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
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
        message={error || 'Profilo non disponibile'}
        onRetry={fetchEmployee}
        variant="notFound"
      />
    );
  }

  const employeeId = employee.id as string;

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem} className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
          {employee.first_name?.[0]}
          {employee.last_name?.[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}
            >
              {employee.first_name} {employee.last_name}
            </h1>
            {getStatusBadge(employee.employment_status, employee.is_active)}
          </div>
          <p className="text-muted-foreground">{employee.job_title || '-'}</p>
        </div>
      </motion.div>

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

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProfileContent />
    </Suspense>
  );
}
