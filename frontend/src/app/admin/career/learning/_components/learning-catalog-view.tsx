'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  Star,
  Filter,
  Search,
  Play,
  CheckCircle2,
  Circle,
  ExternalLink,
  Sparkles,
  Brain,
  Users,
  Calendar,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

export interface LearningItem {
  id: string;
  title: string;
  type: 'course' | 'certification' | 'workshop' | 'mentorship' | 'book' | 'project';
  provider: string;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  relevanceScore: number;
  skills: string[];
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  deadline?: string;
  enrolledCount?: number;
  rating?: number;
  cost: 'free' | 'paid' | 'sponsored';
  aiRecommendation?: string;
}

// ============================================
// PROPS
// ============================================

interface LearningCatalogViewProps {
  readOnly?: boolean;
  headerActions?: React.ReactNode;
  linkPrefix?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTypeIcon(type: LearningItem['type']) {
  switch (type) {
    case 'course':
      return <BookOpen className="h-4 w-4" />;
    case 'certification':
      return <Award className="h-4 w-4" />;
    case 'workshop':
      return <Users className="h-4 w-4" />;
    case 'mentorship':
      return <Brain className="h-4 w-4" />;
    case 'book':
      return <BookOpen className="h-4 w-4" />;
    case 'project':
      return <Zap className="h-4 w-4" />;
  }
}

function getTypeBadge(type: LearningItem['type']) {
  const colors: Record<string, string> = {
    course: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    certification: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    workshop: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    mentorship: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    book: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    project: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  };
  const labels: Record<string, string> = {
    course: 'Corso',
    certification: 'Certificazione',
    workshop: 'Workshop',
    mentorship: 'Mentorship',
    book: 'Libro',
    project: 'Progetto',
  };
  return <Badge className={colors[type]}>{labels[type]}</Badge>;
}

function getLevelBadge(level: LearningItem['level']) {
  const colors: Record<string, string> = {
    beginner: 'text-green-600',
    intermediate: 'text-blue-600',
    advanced: 'text-purple-600',
    expert: 'text-red-600',
  };
  return <span className={`text-xs ${colors[level]}`}>{level}</span>;
}

function getCostBadge(cost: LearningItem['cost']) {
  switch (cost) {
    case 'free':
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          Gratuito
        </Badge>
      );
    case 'sponsored':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          Sponsorizzato
        </Badge>
      );
    case 'paid':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-600">
          A pagamento
        </Badge>
      );
  }
}

function getStatusIcon(status: LearningItem['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'in_progress':
      return <Play className="h-5 w-5 text-blue-500" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

// ============================================
// LEARNING CARD COMPONENT
// ============================================

function LearningCard({ item, readOnly }: { item: LearningItem; readOnly?: boolean }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="mt-1">{getStatusIcon(item.status)}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium">{item.title}</span>
              {getTypeBadge(item.type)}
              {getCostBadge(item.cost)}
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
              <span>{item.provider}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.duration}
              </span>
              <span>&bull;</span>
              {getLevelBadge(item.level)}
              {item.rating && (
                <>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {item.rating}
                  </span>
                </>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.description}</p>

            <div className="flex flex-wrap gap-1 mb-2">
              {item.skills.map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>

            {item.status === 'in_progress' && (
              <div className="flex items-center gap-2 mb-2">
                <Progress value={item.progress} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">{item.progress}%</span>
              </div>
            )}

            {item.aiRecommendation && (
              <div className="flex items-start gap-2 p-2 bg-primary/5 rounded text-sm">
                <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                <span>{item.aiRecommendation}</span>
              </div>
            )}

            {item.deadline && (
              <div className="flex items-center gap-1 text-sm text-orange-600 mt-2">
                <Calendar className="h-3 w-3" />
                Scadenza: {new Date(item.deadline).toLocaleDateString('it-IT')}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">{item.relevanceScore}%</div>
            <span className="text-xs text-muted-foreground">rilevanza</span>
            {!readOnly && (
              <div className="mt-2">
                {item.status === 'not_started' && (
                  <Button size="sm">
                    <Play className="h-3 w-3 mr-1" />
                    Inizia
                  </Button>
                )}
                {item.status === 'in_progress' && (
                  <Button size="sm" variant="outline">
                    Continua
                  </Button>
                )}
                {item.status === 'completed' && (
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Rivedi
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN VIEW COMPONENT
// ============================================

export function LearningCatalogView({
  readOnly = false,
  headerActions,
  linkPrefix = '/admin/career/learning',
}: LearningCatalogViewProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [allItems, setAllItems] = useState<LearningItem[]>([]);

  // Derive back link from linkPrefix: go one level up
  const backLink = readOnly ? '/portal/learning' : '/admin/career';

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await apiClient
          .get<{ success: boolean; data: LearningItem[] }>('/api/v1/career-coach/learning')
          .catch(() => ({ data: null }));
        if (resp?.data) {
          setAllItems(Array.isArray(resp.data) ? resp.data : []);
        }
      } catch (error) {
        console.error('Failed to fetch learning data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    return allItems
      .filter((item) => {
        if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()))
          return false;
        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [allItems, searchQuery, typeFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: allItems.length,
      inProgress: allItems.filter((i) => i.status === 'in_progress').length,
      completed: allItems.filter((i) => i.status === 'completed').length,
      hoursLearned: allItems
        .filter((i) => i.status === 'completed' || i.status === 'in_progress')
        .reduce((sum, i) => {
          // Parse hours from strings like "4h", "2h 30m", "30 min", "4 ore"
          const hMatch = i.duration?.match(/(\d+)\s*[hH]/);
          const mMatch = i.duration?.match(/(\d+)\s*[mM]/);
          const hours =
            (hMatch ? Number(hMatch[1]) : 0) + (mMatch ? Number(mMatch[1]) / 60 : 0) ||
            parseFloat(i.duration) ||
            0;
          return sum + hours;
        }, 0),
      certifications: allItems.filter((i) => i.type === 'certification' && i.status === 'completed')
        .length,
    }),
    [allItems]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
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
            <Link href={backLink}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-blue-500" />
              Learning Recommendations
            </h1>
            <p className="text-muted-foreground">
              {isEn
                ? 'AI-recommended personalized training'
                : 'Formazione personalizzata consigliata dall\u2019AI'}
            </p>
          </div>
        </div>
        {headerActions}
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerItem}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BookOpen className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Recommended' : 'Consigliati'}</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'In Progress' : 'In Corso'}</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{stats.inProgress}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Completed' : 'Completati'}</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Training Hours' : 'Ore Formazione'}</span>
            </div>
            <p className="text-2xl font-bold">{stats.hoursLearned}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Award className="h-4 w-4" />
              <span className="text-sm">{isEn ? 'Certifications' : 'Certificazioni'}</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">{stats.certifications}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Learning Path */}
      <motion.div variants={staggerItem}>
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {isEn ? 'AI-Recommended Path' : 'Percorso AI Consigliato'}
              </CardTitle>
            </div>
            <CardDescription>Basato sui tuoi gap e obiettivi di carriera</CardDescription>
          </CardHeader>
          <CardContent>
            {allItems.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">Percorso consigliato</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.completed}/{stats.total} completati
                  </span>
                </div>
                <Progress
                  value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}
                  className="h-2 mb-4"
                />
                <div className="flex flex-wrap gap-2">
                  {[...new Set(allItems.flatMap((i) => i.skills))].slice(0, 4).map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Dati non disponibili. Completa il tuo profilo per ricevere raccomandazioni
                personalizzate.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isEn ? 'Search training...' : 'Cerca formazione...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isEn ? 'All types' : 'Tutti i tipi'}</SelectItem>
            <SelectItem value="course">Corsi</SelectItem>
            <SelectItem value="certification">
              {isEn ? 'Certifications' : 'Certificazioni'}
            </SelectItem>
            <SelectItem value="workshop">{isEn ? 'Workshop' : 'Workshop'}</SelectItem>
            <SelectItem value="mentorship">{isEn ? 'Mentorship' : 'Mentorship'}</SelectItem>
            <SelectItem value="book">{isEn ? 'Books' : 'Libri'}</SelectItem>
            <SelectItem value="project">{isEn ? 'Projects' : 'Progetti'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isEn ? 'All' : 'Tutti'}</SelectItem>
            <SelectItem value="not_started">Da iniziare</SelectItem>
            <SelectItem value="in_progress">In corso</SelectItem>
            <SelectItem value="completed">{isEn ? 'Completed' : 'Completati'}</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Learning Items */}
      <motion.div variants={staggerItem}>
        <Tabs defaultValue="recommended" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="recommended">Consigliati ({filteredItems.length})</TabsTrigger>
            <TabsTrigger value="in_progress">
              In Corso ({filteredItems.filter((i) => i.status === 'in_progress').length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completati ({filteredItems.filter((i) => i.status === 'completed').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommended" className="space-y-4">
            {filteredItems.map((item) => (
              <LearningCard key={item.id} item={item} readOnly={readOnly} />
            ))}
          </TabsContent>

          <TabsContent value="in_progress" className="space-y-4">
            {filteredItems
              .filter((i) => i.status === 'in_progress')
              .map((item) => (
                <LearningCard key={item.id} item={item} readOnly={readOnly} />
              ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {filteredItems
              .filter((i) => i.status === 'completed')
              .map((item) => (
                <LearningCard key={item.id} item={item} readOnly={readOnly} />
              ))}
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
