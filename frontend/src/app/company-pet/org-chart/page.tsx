'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Building2, Users, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface OrgUnit {
  id: string;
  name: string;
  code?: string;
  manager_name?: string;
  employee_count?: number;
}

export default function OrgChartPage() {
  const t = useTranslations('companyPet');
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: OrgUnit[] | { departments?: OrgUnit[] } }>(
        '/api/v1/org-units'
      );
      const raw = res?.data;
      setDepartments(Array.isArray(raw) ? raw : raw?.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('orgChart.title')} description={t('orgChart.description')} />
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('orgChart.title')} description={t('orgChart.description')}>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/org-chart">
            <ExternalLink className="h-4 w-4 mr-2" /> {t('orgChart.fullAdminView')}
          </Link>
        </Button>
      </PageHeader>

      {/* OrgUnit Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t('orgChart.departments')}
          </CardTitle>
          <CardDescription>
            {loading
              ? t('common.loading')
              : t('orgChart.departmentCount', { count: departments.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{t('orgChart.noDepartmentsFound')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="p-4 border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    {dept.employee_count !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {dept.employee_count}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-foreground">{dept.name}</h3>
                  {dept.code && <p className="text-xs text-muted-foreground mt-0.5">{dept.code}</p>}
                  {dept.manager_name && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Manager: <span className="text-foreground">{dept.manager_name}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
