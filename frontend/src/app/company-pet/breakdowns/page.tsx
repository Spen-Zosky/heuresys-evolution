'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { DollarSign, Building2, PieChart, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CostData {
  departments: Array<{
    name: string;
    cost: number;
    headcount: number;
    costPerEmployee: number;
  }>;
  totalCost: number;
  avgCostPerEmployee: number;
}

export default function BreakdownsPage() {
  const t = useTranslations('companyPet');
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Prefer compensation analytics API for real cost data
      const [deptRes, empRes, costRes] = await Promise.allSettled([
        apiClient.get<{
          data: {
            departments: Array<{
              id: string;
              name: string;
              employee_count?: number;
              total_cost?: number;
              avg_salary?: number;
            }>;
          };
        }>('/api/v1/org-units'),
        apiClient.get<{ data: { summary?: { total_employees?: number } } }>(
          '/api/v1/analytics/dashboard'
        ),
        apiClient.get<{
          data: {
            by_org_unit?: Array<{
              department: string;
              headcount: number;
              avg_salary: number;
              total_cost: number;
            }>;
          };
        }>('/api/v1/analytics/compensation/overview'),
      ]);

      type DeptItem = {
        id: string;
        name: string;
        employee_count?: number;
        total_cost?: number;
        avg_salary?: number;
      };
      const deptData = deptRes.status === 'fulfilled' ? deptRes.value?.data : null;
      const departments: DeptItem[] = Array.isArray(deptData)
        ? (deptData as DeptItem[])
        : (deptData as { departments?: DeptItem[] } | null)?.departments || [];
      const totalEmployees =
        empRes.status === 'fulfilled' ? empRes.value?.data?.summary?.total_employees || 0 : 0;
      const costByDept =
        costRes.status === 'fulfilled' ? costRes.value?.data?.by_org_unit || [] : [];

      // Use real compensation data if available, otherwise use department headcount only
      const deptCosts = departments
        .slice(0, 10)
        .map(
          (d: {
            name: string;
            employee_count?: number;
            total_cost?: number;
            avg_salary?: number;
          }) => {
            const costEntry = costByDept.find(
              (c: { department: string }) => c.department === d.name
            );
            const headcount = costEntry?.headcount ?? d.employee_count ?? 0;
            const cost = costEntry?.total_cost ?? d.total_cost ?? 0;
            const costPerEmployee =
              headcount > 0
                ? Math.round(cost / headcount)
                : (costEntry?.avg_salary ?? d.avg_salary ?? 0);
            return { name: d.name, cost, headcount, costPerEmployee };
          }
        )
        .filter((d: { cost: number }) => d.cost > 0);

      const totalCost = deptCosts.reduce((sum: number, d: { cost: number }) => sum + d.cost, 0);

      setData({
        departments: deptCosts.sort((a: { cost: number }, b: { cost: number }) => b.cost - a.cost),
        totalCost,
        avgCostPerEmployee: totalEmployees > 0 ? Math.round(totalCost / totalEmployees) : 0,
      });
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
        <PageHeader title={t('breakdowns.title')} description={t('breakdowns.description')} />
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
      <PageHeader
        title="Ripartizione Costi"
        description="Analisi dei costi HR per dipartimento e centro di costo"
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {data ? `${(data.totalCost / 1_000_000).toFixed(1)}M` : '-'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t('breakdowns.totalHrCost')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {data ? `${(data.avgCostPerEmployee / 1000).toFixed(0)}K` : '-'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('breakdowns.avgCostPerEmployee')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {data?.departments.length || 0}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('breakdowns.analyzedDepartments')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OrgUnit Cost Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            {t('breakdowns.costsByDepartment')}
          </CardTitle>
          <CardDescription>{t('breakdowns.costsByDepartmentDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : !data?.departments.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('breakdowns.noDataAvailable')}
            </p>
          ) : (
            <div className="space-y-3">
              {data.departments.map((dept, _i) => {
                const percentage = data.totalCost > 0 ? (dept.cost / data.totalCost) * 100 : 0;
                return (
                  <div key={dept.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{dept.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {dept.headcount} dip.
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">
                          {(dept.costPerEmployee / 1000).toFixed(0)}K/dip.
                        </span>
                        <span className="font-medium">{(dept.cost / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
