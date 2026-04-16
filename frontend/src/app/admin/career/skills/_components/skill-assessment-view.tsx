'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain,
  Filter,
  Download,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BaseBarChart, BaseRadarChart, BasePieChart } from '@/components/charts';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'leadership';
  currentLevel: number;
  targetLevel: number;
  requiredLevel: number;
  trend: 'improving' | 'stable' | 'declining';
  lastAssessment: string;
  gap: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendedActions: string[];
}

interface SkillCategory {
  name: string;
  skills: Skill[];
  avgCurrent: number;
  avgTarget: number;
  gapCount: number;
}

interface SkillAssessmentViewProps {
  /** When true, hides CRUD buttons, admin-only links, and admin actions */
  readOnly?: boolean;
  /** Extra elements rendered in the header area (e.g. Badge or action buttons) */
  headerActions?: React.ReactNode;
  /** Base path for internal links (default: '/admin/career/skills') */
  linkPrefix?: string;
}

// ============================================
// VIEW COMPONENT
// ============================================

export function SkillAssessmentView({
  readOnly = false,
  headerActions,
  linkPrefix = '/admin/career/skills',
}: SkillAssessmentViewProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [allSkills, setAllSkills] = useState<Skill[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await apiClient
          .get<{ success: boolean; data: Skill[] }>('/api/v1/career-coach/skills')
          .catch(() => ({ data: null }));
        if (resp?.data) {
          const raw = (Array.isArray(resp.data) ? resp.data : []) as unknown as Record<string, unknown>[];
          const normalized: Skill[] = raw.map((r: Record<string, unknown>) => {
            const current = Number(r.currentLevel ?? r.proficiency ?? 0);
            const target = Number(r.targetLevel ?? r.target_proficiency ?? current + 1);
            const gap = Math.max(0, target - current);
            return {
              id: String(r.id ?? ''),
              name: String(r.name ?? r.skill_name ?? 'Unknown'),
              category: (r.category as Skill['category']) ?? 'technical',
              currentLevel: isFinite(current) ? current : 0,
              targetLevel: isFinite(target) ? target : 0,
              requiredLevel: Number(r.requiredLevel ?? r.required_level ?? target) || 0,
              trend: (r.trend as Skill['trend']) ?? 'stable',
              lastAssessment: String(r.lastAssessment ?? r.updated_at ?? ''),
              gap,
              priority:
                (r.priority as Skill['priority']) ??
                (gap >= 3 ? 'critical' : gap === 2 ? 'high' : gap === 1 ? 'medium' : 'low'),
              recommendedActions: Array.isArray(r.recommendedActions)
                ? (r.recommendedActions as string[])
                : [],
            } as Skill;
          });
          setAllSkills(normalized);
        }
      } catch (error) {
        console.error('Failed to fetch skills data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter skills
  const filteredSkills = useMemo(() => {
    return allSkills.filter((skill) => {
      if (categoryFilter !== 'all' && skill.category !== categoryFilter) return false;
      if (priorityFilter !== 'all' && skill.priority !== priorityFilter) return false;
      return true;
    });
  }, [allSkills, categoryFilter, priorityFilter]);

  // Group by category
  const categories = useMemo<SkillCategory[]>(() => {
    const cats: Record<string, SkillCategory> = {};
    const categoryNames: Record<string, string> = {
      technical: 'Competenze Tecniche',
      hard: 'Competenze Tecniche',
      soft: 'Soft Skills',
      competences: 'Competenze Trasversali',
      leadership: 'Leadership',
      domain: 'Conoscenze di Dominio',
    };

    allSkills.forEach((skill) => {
      const catKey = skill.category || 'other';
      if (!cats[catKey]) {
        cats[catKey] = {
          name: categoryNames[catKey] || catKey.charAt(0).toUpperCase() + catKey.slice(1),
          skills: [],
          avgCurrent: 0,
          avgTarget: 0,
          gapCount: 0,
        };
      }
      cats[catKey].skills.push(skill);
      if (skill.gap > 0) cats[catKey].gapCount++;
    });

    Object.values(cats).forEach((cat) => {
      cat.avgCurrent = cat.skills.reduce((sum, s) => sum + s.currentLevel, 0) / cat.skills.length;
      cat.avgTarget = cat.skills.reduce((sum, s) => sum + s.targetLevel, 0) / cat.skills.length;
    });

    return Object.values(cats);
  }, [allSkills]);

  // Stats
  const stats = useMemo(() => {
    const withGaps = allSkills.filter((s) => s.gap > 0);
    const critical = allSkills.filter((s) => s.priority === 'critical').length;
    const improving = allSkills.filter((s) => s.trend === 'improving').length;
    const avgLevel =
      allSkills.length > 0
        ? allSkills.reduce((sum, s) => sum + s.currentLevel, 0) / allSkills.length
        : 0;

    return {
      totalSkills: allSkills.length,
      skillsWithGaps: withGaps.length,
      criticalGaps: critical,
      improving,
      avgLevel: avgLevel.toFixed(1),
      completionRate:
        allSkills.length > 0
          ? Math.round(((allSkills.length - withGaps.length) / allSkills.length) * 100)
          : 0,
    };
  }, [allSkills]);

  // Chart data
  const radarData = categories.map((cat) => ({
    category: cat.name.split(' ')[0],
    current: Math.round(cat.avgCurrent * 20),
    target: Math.round(cat.avgTarget * 20),
  }));

  const gapDistributionData = [
    { name: 'Nessun Gap', value: allSkills.filter((s) => s.gap === 0).length },
    { name: 'Gap 1', value: allSkills.filter((s) => s.gap === 1).length },
    { name: 'Gap 2+', value: allSkills.filter((s) => s.gap >= 2).length },
  ];

  const priorityData = [
    {
      priority: isEn ? 'Critical' : 'Critico',
      count: allSkills.filter((s) => s.priority === 'critical').length,
    },
    {
      priority: isEn ? 'High' : 'Alto',
      count: allSkills.filter((s) => s.priority === 'high').length,
    },
    {
      priority: isEn ? 'Medium' : 'Medio',
      count: allSkills.filter((s) => s.priority === 'medium').length,
    },
    {
      priority: isEn ? 'Low' : 'Basso',
      count: allSkills.filter((s) => s.priority === 'low').length,
    },
  ];

  const getPriorityBadge = (priority: Skill['priority']) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
      critical: 'destructive',
      high: 'default',
      medium: 'secondary',
      low: 'outline',
    };
    const labels: Record<string, string> = {
      critical: 'Critico',
      high: 'Alto',
      medium: 'Medio',
      low: 'Basso',
    };
    return <Badge variant={variants[priority]}>{labels[priority]}</Badge>;
  };

  const getTrendIcon = (trend: Skill['trend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
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
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" aria-label="Go back" asChild>
            <Link href={readOnly ? '/portal/skills' : '/admin/career'}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-orange-500" />
              Skill Gap Analysis
            </h1>
            <p className="text-muted-foreground">Analisi AI delle tue competenze e gap formativi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {!readOnly && (
            <>
              <Button variant="outline" size="icon" aria-label="Aggiorna competenze carriera">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Esporta Report
              </Button>
              <Button>
                <Brain className="h-4 w-4 mr-2" />
                Nuovo Assessment
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerItem}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Total Skills' : 'Skills Totali'}</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalSkills}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'With Gap' : 'Con Gap'}</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{stats.skillsWithGaps}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Critical Gaps' : 'Gap Critici'}</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{stats.criticalGaps}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Growing' : 'In Crescita'}</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{stats.improving}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Avg Level' : 'Media Livello'}</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgLevel}/5</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Completamento</span>
            </div>
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={staggerItem} className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isEn ? 'Skills Radar' : 'Radar Competenze'}</CardTitle>
            <CardDescription>Attuale vs Target per categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <BaseRadarChart
              data={radarData}
              dataKey="category"
              series={[
                { dataKey: 'current', name: 'Attuale', color: '#3B82F6' },
                { dataKey: 'target', name: 'Target', color: '#10B981' },
              ]}
              height={250}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isEn ? 'Gap Distribution' : 'Distribuzione Gap'}
            </CardTitle>
            <CardDescription>Skills per livello di gap</CardDescription>
          </CardHeader>
          <CardContent>
            <BasePieChart
              data={gapDistributionData}
              height={250}
              innerRadius={50}
              outerRadius={80}
              showLegend
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isEn ? 'Gap Priority' : 'Priorità Gap'}</CardTitle>
            <CardDescription>Skills da sviluppare per priorita</CardDescription>
          </CardHeader>
          <CardContent>
            <BaseBarChart
              data={priorityData}
              xAxisKey="priority"
              height={250}
              bars={[{ dataKey: 'count', name: 'Skills' }]}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Skills List */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Dettaglio Competenze</CardTitle>
              <CardDescription>Lista completa con gap e azioni consigliate</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="technical">Tecniche</SelectItem>
                  <SelectItem value="soft">Soft Skills</SelectItem>
                  <SelectItem value="leadership">Leadership</SelectItem>
                  <SelectItem value="domain">Dominio</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priorità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="critical">Critico</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="low">Basso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="gaps" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="gaps">
                  {isEn ? 'With Gap' : 'Con Gap'} ({filteredSkills.filter((s) => s.gap > 0).length})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  {isEn ? 'Completed' : 'Completate'} (
                  {filteredSkills.filter((s) => s.gap === 0).length})
                </TabsTrigger>
                <TabsTrigger value="all">
                  {isEn ? 'All' : 'Tutte'} ({filteredSkills.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="gaps" className="space-y-3">
                {filteredSkills
                  .filter((s) => s.gap > 0)
                  .sort((a, b) => {
                    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                  })
                  .map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      getPriorityBadge={getPriorityBadge}
                      getTrendIcon={getTrendIcon}
                    />
                  ))}
              </TabsContent>

              <TabsContent value="completed" className="space-y-3">
                {filteredSkills
                  .filter((s) => s.gap === 0)
                  .map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      getPriorityBadge={getPriorityBadge}
                      getTrendIcon={getTrendIcon}
                    />
                  ))}
              </TabsContent>

              <TabsContent value="all" className="space-y-3">
                {filteredSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    getPriorityBadge={getPriorityBadge}
                    getTrendIcon={getTrendIcon}
                  />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Skill Card Component
function SkillCard({
  skill,
  getPriorityBadge,
  getTrendIcon,
}: {
  skill: Skill;
  getPriorityBadge: (p: Skill['priority']) => React.ReactNode;
  getTrendIcon: (t: Skill['trend']) => React.ReactNode;
}) {
  const categoryLabels: Record<string, string> = {
    technical: 'Tecnica',
    soft: 'Soft Skill',
    leadership: 'Leadership',
    domain: 'Dominio',
  };

  return (
    <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">{skill.name}</span>
            {getPriorityBadge(skill.priority)}
            <Badge variant="outline" className="text-xs">
              {categoryLabels[skill.category]}
            </Badge>
            {getTrendIcon(skill.trend)}
          </div>

          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground w-16">Attuale:</span>
              <Progress value={(skill.currentLevel / 5) * 100} className="h-2 flex-1" />
              <span className="text-sm font-medium w-8">{skill.currentLevel}/5</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground w-16">Target:</span>
              <Progress
                value={(skill.targetLevel / 5) * 100}
                className="h-2 flex-1 bg-muted [&>div]:bg-green-500"
              />
              <span className="text-sm font-medium w-8">{skill.targetLevel}/5</span>
            </div>
          </div>

          {skill.gap > 0 && skill.recommendedActions.length > 0 && (
            <div className="flex items-start gap-2 mt-2 p-2 bg-muted rounded">
              <Zap className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium">Azioni consigliate: </span>
                <span className="text-muted-foreground">{skill.recommendedActions.join(', ')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="text-right">
          {skill.gap > 0 ? (
            <>
              <div className="text-2xl font-bold text-orange-500">-{skill.gap}</div>
              <span className="text-xs text-muted-foreground">gap</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
              <span className="text-xs text-muted-foreground">OK</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
