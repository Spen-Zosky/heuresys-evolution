'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import {
  Users,
  Star,
  Lightbulb,
  GraduationCap,
  AlertCircle,
  RefreshCw,
  Zap,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NineBoxCell {
  label: string;
  value: number;
  perf: string;
  pot: string;
  color: string;
}

interface SkillItem {
  name: string;
  coverage: number;
}

interface GapItem {
  name: string;
  gap: number;
}

interface TalentData {
  totalEmployees: number;
  highPotential: number;
  skillGaps: number;
  successionReady: number;
  totalCourses: number;
  nineBox: NineBoxCell[];
  topSkills: SkillItem[];
  criticalGaps: GapItem[];
}

export default function OrganizationTalentPage() {
  const t = useTranslations('companyPet');
  const [data, setData] = useState<TalentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, nineBoxRes, skillsRes] = await Promise.allSettled([
        apiClient.get<{ data: { summary?: Record<string, number> } }>(
          '/api/v1/analytics/dashboard'
        ),
        apiClient.get<{
          data: {
            cells?: Array<{ label: string; value: number; performance: string; potential: string }>;
          };
        }>('/api/v1/performance-analytics/nine-box'),
        apiClient.get<{
          data: {
            top_skills?: Array<{ name: string; coverage: number }>;
            critical_gaps?: Array<{ name: string; gap: number }>;
          };
        }>('/api/v1/skill-analytics/summary'),
      ]);

      const summary = dashRes.status === 'fulfilled' ? dashRes.value?.data?.summary || {} : {};

      // 9-box matrix from API or empty
      const colorMap: Record<string, string> = {
        'high-high': 'bg-green-100 border-green-300 text-green-800',
        'medium-high': 'bg-blue-100 border-blue-300 text-blue-800',
        'low-high': 'bg-amber-100 border-amber-300 text-amber-800',
        'high-medium': 'bg-blue-100 border-blue-300 text-blue-800',
        'medium-medium': 'bg-gray-100 border-gray-300 text-gray-800',
        'low-medium': 'bg-red-100 border-red-300 text-red-800',
        'high-low': 'bg-green-100 border-green-300 text-green-800',
        'medium-low': 'bg-gray-100 border-gray-300 text-gray-800',
        'low-low': 'bg-red-100 border-red-300 text-red-800',
      };
      let nineBox: NineBoxCell[] = [];
      if (nineBoxRes.status === 'fulfilled' && nineBoxRes.value?.data?.cells) {
        nineBox = nineBoxRes.value.data.cells.map((c) => ({
          label: c.label,
          value: c.value,
          perf: c.performance,
          pot: c.potential,
          color:
            colorMap[`${c.performance.toLowerCase()}-${c.potential.toLowerCase()}`] ||
            'bg-gray-100 border-gray-300 text-gray-800',
        }));
      }

      // Skills/gaps from API or empty
      let topSkills: SkillItem[] = [];
      let criticalGaps: GapItem[] = [];
      if (skillsRes.status === 'fulfilled') {
        const skillData = skillsRes.value?.data;
        if (skillData?.top_skills) {
          topSkills = skillData.top_skills.slice(0, 4);
        }
        if (skillData?.critical_gaps) {
          criticalGaps = skillData.critical_gaps.slice(0, 4);
        }
      }

      setData({
        totalEmployees: summary.total_employees ?? 0,
        highPotential: summary.high_potential ?? 0,
        skillGaps: summary.skill_gaps ?? 0,
        successionReady: summary.succession_ready ?? 0,
        totalCourses: summary.total_courses ?? 0,
        nineBox,
        topSkills,
        criticalGaps,
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
        <PageHeader title={t('orgTalent.title')} description={t('orgTalent.description')} />
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('orgTalent.title')} description={t('orgTalent.description')} />

      {/* Talent KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Totale Dipendenti',
            value: loading ? '-' : data?.totalEmployees.toString(),
            icon: Users,
          },
          {
            label: 'High Potential',
            value: loading ? '-' : data?.highPotential.toString(),
            icon: Star,
          },
          {
            label: 'Succession Ready',
            value: loading ? '-' : data?.successionReady.toString(),
            icon: UserCheck,
          },
          {
            label: 'Skill Gaps',
            value: loading ? '-' : data?.skillGaps.toString(),
            icon: Lightbulb,
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Talent Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              9-Box Talent Matrix
            </CardTitle>
            <CardDescription>Distribuzione talenti per performance e potenziale</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : data?.nineBox && data.nineBox.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {data.nineBox.map((cell) => (
                  <div
                    key={cell.label}
                    className={`p-3 rounded-lg border text-center ${cell.color}`}
                  >
                    <p className="text-2xl font-bold">{cell.value}</p>
                    <p className="text-xs font-medium mt-1">{cell.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Dati 9-Box non ancora disponibili. Completare le valutazioni di performance e
                potenziale.
              </p>
            )}
            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <span>Performance &rarr;</span>
              <span>&uarr; Potenziale</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Skills & Gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Competenze Chiave & Gap
            </CardTitle>
            <CardDescription>Competenze piu diffuse e gap piu rilevanti</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.topSkills?.length || data?.criticalGaps?.length ? (
              <div className="space-y-4">
                {data?.topSkills && data.topSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Competenze Top</p>
                    <div className="space-y-2">
                      {data.topSkills.map((skill) => (
                        <div key={skill.name} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-36 truncate">
                            {skill.name}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${skill.coverage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {skill.coverage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data?.criticalGaps && data.criticalGaps.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-foreground mb-2">Gap Critici</p>
                    <div className="space-y-2">
                      {data.criticalGaps.map((skill) => (
                        <div key={skill.name} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-36 truncate">
                            {skill.name}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-400 rounded-full"
                              style={{ width: `${skill.gap}%` }}
                            />
                          </div>
                          <span className="text-xs text-red-500 w-10 text-right">{skill.gap}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Dati sulle competenze non ancora disponibili. Configurare i profili skill dei
                dipendenti.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
