'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Compass,
  Target,
  TrendingUp,
  BookOpen,
  Users,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  Brain,
  Briefcase,
  GraduationCap,
  Award,
  Lightbulb,
  BarChart3,
  Zap,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface CareerInsight {
  id: string;
  type: 'opportunity' | 'recommendation' | 'alert' | 'milestone';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel?: string;
  actionHref?: string;
}

interface SkillGap {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendedCourse?: string;
}

interface CareerPath {
  id: string;
  title: string;
  department: string;
  matchScore: number;
  timeToAchieve: string;
  requiredSkills: string[];
}

interface LearningRecommendation {
  id: string;
  title: string;
  type: 'course' | 'certification' | 'workshop' | 'mentorship';
  provider: string;
  duration: string;
  relevanceScore: number;
  skills: string[];
}

interface CareerDashboardResponse {
  insights: CareerInsight[];
  skillGaps: SkillGap[];
  careerPaths: CareerPath[];
  learningRecommendations: LearningRecommendation[];
  stats: {
    careerScore: number;
    skillsCompleted: number;
    skillsTotal: number;
    goalsProgress: number;
    learningHours: number;
    mentoringSessions: number;
  };
}

// ============================================
// PROPS
// ============================================

interface CareerDashboardViewProps {
  /** When true, hides admin-only action links and quick actions */
  readOnly?: boolean;
  /** Optional slot rendered in the header (e.g. admin buttons) */
  headerActions?: React.ReactNode;
  /** Prefix for internal links. Default: '/admin/career' */
  linkPrefix?: string;
}

// ============================================
// HELPERS
// ============================================

function getInsightIcon(type: CareerInsight['type']) {
  switch (type) {
    case 'opportunity':
      return <Briefcase className="h-4 w-4 text-blue-500" />;
    case 'recommendation':
      return <Lightbulb className="h-4 w-4 text-yellow-500" />;
    case 'alert':
      return <Zap className="h-4 w-4 text-orange-500" />;
    case 'milestone':
      return <Award className="h-4 w-4 text-green-500" />;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    default:
      return 'text-green-500';
  }
}

function getTypeColor(type: LearningRecommendation['type']) {
  switch (type) {
    case 'course':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'certification':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    case 'workshop':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'mentorship':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
  }
}

// ============================================
// COMPONENT
// ============================================

export function CareerDashboardView({
  readOnly = false,
  headerActions,
  linkPrefix = '/admin/career',
}: CareerDashboardViewProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<CareerInsight[]>([]);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [learningRecs, setLearningRecs] = useState<LearningRecommendation[]>([]);
  const [stats, setStats] = useState({
    careerScore: 0,
    skillsCompleted: 0,
    skillsTotal: 0,
    goalsProgress: 0,
    learningHours: 0,
    mentoringSessions: 0,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await apiClient
          .get<{ success: boolean; data: CareerDashboardResponse }>('/api/v1/career-coach/paths')
          .catch(() => ({ data: null }));
        if (resp?.data) {
          setInsights(resp.data.insights || []);
          setSkillGaps(resp.data.skillGaps || []);
          setCareerPaths(resp.data.careerPaths || []);
          setLearningRecs(resp.data.learningRecommendations || []);
          if (resp.data.stats) setStats(resp.data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch career data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
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
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary" />
            AI Career Coach
          </h1>
          <p className="text-muted-foreground">
            {isEn
              ? 'Plan your professional growth with AI'
              : 'Pianifica la tua crescita professionale con l\u2019AI'}
          </p>
        </div>
        {headerActions}
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerItem}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm">Career Score</span>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">{stats.careerScore}</p>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Progress value={stats.careerScore} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Skills</span>
            </div>
            <p className="text-2xl font-bold">
              {stats.skillsCompleted}
              <span className="text-sm text-muted-foreground">/{stats.skillsTotal}</span>
            </p>
            <Progress
              value={stats.skillsTotal > 0 ? (stats.skillsCompleted / stats.skillsTotal) * 100 : 0}
              className="h-1 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-sm">{isEn ? 'Goals' : 'Obiettivi'}</span>
            </div>
            <p className="text-2xl font-bold">{stats.goalsProgress}%</p>
            <Progress value={stats.goalsProgress} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{isEn ? 'Learning Hours' : 'Ore Formazione'}</span>
            </div>
            <p className="text-2xl font-bold">{stats.learningHours}</p>
            <span className="text-xs text-muted-foreground">
              {isEn ? 'this month' : 'questo mese'}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Mentoring</span>
            </div>
            <p className="text-2xl font-bold">{stats.mentoringSessions}</p>
            <span className="text-xs text-muted-foreground">{isEn ? 'sessions' : 'sessioni'}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Trend</span>
            </div>
            <p className="text-2xl font-bold text-muted-foreground">N/A</p>
            <span className="text-xs text-muted-foreground">
              {isEn ? 'vs quarter' : 'vs trimestre'}
            </span>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI Insights */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Insights
                </CardTitle>
                <CardDescription>
                  Raccomandazioni personalizzate per la tua crescita
                </CardDescription>
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${linkPrefix}/insights`}>
                    Vedi tutti
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{insight.title}</p>
                        <Badge
                          variant={insight.priority === 'high' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{insight.description}</p>
                    </div>
                    {!readOnly && insight.actionLabel && insight.actionHref && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={insight.actionHref}>
                          {insight.actionLabel}
                          <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Skill Gaps */}
        <motion.div variants={staggerItem}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                Skill Gaps
              </CardTitle>
              <CardDescription>Competenze da sviluppare</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {skillGaps.slice(0, 4).map((gap) => (
                  <div key={gap.skill}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{gap.skill}</span>
                      <span className={`text-xs ${getPriorityColor(gap.priority)}`}>
                        {gap.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(gap.currentLevel / gap.targetLevel) * 100}
                        className="h-2 flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {gap.currentLevel}/{gap.targetLevel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {!readOnly && (
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link href={`${linkPrefix}/skills`}>Analisi Completa</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Career Paths & Learning */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Career Paths */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Percorsi Consigliati
                </CardTitle>
                <CardDescription>Basati sulle tue competenze</CardDescription>
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${linkPrefix}/paths`}>
                    Esplora
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {careerPaths.map((path) => {
                  const content = (
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{path.title}</p>
                          <p className="text-sm text-muted-foreground">{path.department}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {path.timeToAchieve}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{path.matchScore}%</div>
                          <span className="text-xs text-muted-foreground">match</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {path.requiredSkills.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </>
                  );

                  return readOnly ? (
                    <div
                      key={path.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {content}
                    </div>
                  ) : (
                    <Link
                      key={path.id}
                      href={`${linkPrefix}/paths/${path.id}`}
                      className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Learning Recommendations */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-500" />
                  {isEn ? 'Recommended Learning' : 'Formazione Consigliata'}
                </CardTitle>
                <CardDescription>AI-powered learning paths</CardDescription>
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${linkPrefix}/learning`}>
                    Vedi tutti
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {learningRecs.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <Badge className={`text-xs ${getTypeColor(rec.type)}`}>{rec.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rec.provider} • {rec.duration}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rec.skills.map((skill) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-lg font-bold text-primary">{rec.relevanceScore}%</div>
                        <span className="text-xs text-muted-foreground">rilevanza</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions — admin only */}
      {!readOnly && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link href={`${linkPrefix}/goals`}>
                    <Target className="h-4 w-4 mr-2" />I Miei Obiettivi
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`${linkPrefix}/mentors`}>
                    <Users className="h-4 w-4 mr-2" />
                    Trova Mentor
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`${linkPrefix}/skills`}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Skill Assessment
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`${linkPrefix}/reports`}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Career Reports
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
