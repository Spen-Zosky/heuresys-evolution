'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowLeft,
  Plus,
  Target,
  TrendingUp,
  BookOpen,
  Star,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import type { Employee, EmployeeSkill } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { BasePieChart, BaseBarChart } from '@/components/charts';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'language' | 'tool';
  proficiency: number; // 1-5
  required_level: number; // Required for current role
  source: 'self' | 'manager' | 'assessment';
  last_updated: string;
}

interface SkillCategory {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ============================================
// ADAPTERS: Map API response to local types
// ============================================

function mapApiSkillToLocal(apiSkill: EmployeeSkill): Skill {
  const categoryMap: Record<string, Skill['category']> = {
    hard: 'technical',
    technical: 'technical',
    soft: 'soft',
    language: 'language',
    tool: 'tool',
    transversal: 'soft',
  };
  return {
    id: apiSkill.id,
    name: apiSkill.skill_name || 'Competenza',
    category: categoryMap[apiSkill.skill_category || ''] || 'technical',
    proficiency: apiSkill.proficiency_level || 1,
    required_level: apiSkill.manager_assessment || apiSkill.proficiency_level || 1,
    source:
      apiSkill.source === 'self_assessment'
        ? 'self'
        : apiSkill.source === 'manager'
          ? 'manager'
          : 'assessment',
    last_updated: apiSkill.updated_at || apiSkill.created_at,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getProficiencyLabel = (level: number): string => {
  const labels = ['', 'Base', 'Intermedio', 'Avanzato', 'Esperto', 'Master'];
  return labels[level] || '';
};

const getCategoryIcon = (category: Skill['category']) => {
  switch (category) {
    case 'technical':
      return <Sparkles className="h-4 w-4" />;
    case 'soft':
      return <Star className="h-4 w-4" />;
    case 'language':
      return <BookOpen className="h-4 w-4" />;
    case 'tool':
      return <Target className="h-4 w-4" />;
  }
};

const getCategoryLabel = (category: Skill['category']): string => {
  const labels = {
    technical: 'Tecnica',
    soft: 'Soft Skill',
    language: 'Lingua',
    tool: 'Strumento',
  };
  return labels[category];
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function EmployeeSkillsPage() {
  const t = useTranslations('admin.employees.skills');
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addSkillOpen, setAddSkillOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [employeeData, skillsData] = await Promise.all([
        api.employees.getEmployeeById(employeeId),
        api.skills.getEmployeeSkills(employeeId).catch(() => [] as EmployeeSkill[]),
      ]);
      setEmployee(employeeData);
      setSkills(skillsData.map(mapApiSkillToLocal));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dipendente');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate statistics
  const stats = useMemo(() => {
    const avgProficiency = skills.reduce((sum, s) => sum + s.proficiency, 0) / skills.length;
    const meetingRequirements = skills.filter((s) => s.proficiency >= s.required_level).length;
    const gapsCount = skills.filter((s) => s.proficiency < s.required_level).length;
    return { avgProficiency, meetingRequirements, gapsCount, total: skills.length };
  }, [skills]);

  // Category distribution for pie chart
  const categoryData: SkillCategory[] = useMemo(() => {
    const counts: Record<string, number> = {};
    skills.forEach((s) => {
      counts[getCategoryLabel(s.category)] = (counts[getCategoryLabel(s.category)] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [skills]);

  // Gap analysis bar chart data (computed from skills)
  const skillGaps = skills
    .filter((s) => s.proficiency < s.required_level)
    .map((s) => ({
      skill_name: s.name,
      current: s.proficiency,
      required: s.required_level,
      gap: s.required_level - s.proficiency,
    }));

  const gapChartData = skillGaps.map((g) => ({
    name: g.skill_name,
    Attuale: g.current,
    Richiesto: g.required,
    [Symbol.for('index')]: true,
  }));

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const grouped: Record<Skill['category'], Skill[]> = {
      technical: [],
      soft: [],
      language: [],
      tool: [],
    };
    skills.forEach((s) => grouped[s.category].push(s));
    return grouped;
  }, [skills]);

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

  if (error || !employee) {
    return <ApiError message={error || 'Dipendente non trovato'} onRetry={fetchData} />;
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            onClick={() => router.push(`/admin/employees/${employeeId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {employee.first_name} {employee.last_name}
            </p>
          </div>
        </div>

        <Dialog open={addSkillOpen} onOpenChange={setAddSkillOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Skill
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi Competenza</DialogTitle>
              <DialogDescription>
                Aggiungi una nuova competenza al profilo di {employee.first_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Competenza</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona competenza" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="agile">Agile/Scrum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Livello Proficiency (1-5)</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona livello" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Base</SelectItem>
                    <SelectItem value="2">2 - Intermedio</SelectItem>
                    <SelectItem value="3">3 - Avanzato</SelectItem>
                    <SelectItem value="4">4 - Esperto</SelectItem>
                    <SelectItem value="5">5 - Master</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddSkillOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setAddSkillOpen(false)}>Aggiungi</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">Competenze Totali</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Media Proficiency</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgProficiency.toFixed(1)}/5</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Requisiti OK</span>
            </div>
            <p className="text-2xl font-bold">{stats.meetingRequirements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Gap da Colmare</span>
            </div>
            <p className="text-2xl font-bold">{stats.gapsCount}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuzione per Categoria</CardTitle>
              <CardDescription>Ripartizione delle competenze</CardDescription>
            </CardHeader>
            <CardContent>
              <BasePieChart
                data={categoryData}
                height={250}
                innerRadius={50}
                outerRadius={80}
                showLegend={true}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gap Analysis</CardTitle>
              <CardDescription>Competenze da migliorare</CardDescription>
            </CardHeader>
            <CardContent>
              <BaseBarChart
                data={gapChartData as Record<string, unknown>[]}
                xAxisKey="name"
                height={250}
                bars={[
                  { dataKey: 'Attuale', name: 'Livello Attuale' },
                  { dataKey: 'Richiesto', name: 'Livello Richiesto' },
                ]}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Skills by Category */}
      {(['technical', 'soft', 'tool', 'language'] as const).map((category) => (
        <motion.div key={category} variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {getCategoryIcon(category)}
                {getCategoryLabel(category)} ({skillsByCategory[category].length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {skillsByCategory[category].map((skill) => (
                  <div key={skill.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{skill.name}</span>
                      <Badge variant="outline">{getProficiencyLabel(skill.proficiency)}</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Proficiency</span>
                        <span>{skill.proficiency}/5</span>
                      </div>
                      <Progress value={skill.proficiency * 20} className="h-2" />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Richiesto: {skill.required_level}/5</span>
                      {skill.proficiency < skill.required_level ? (
                        <span className="text-orange-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Gap: {skill.required_level - skill.proficiency}
                        </span>
                      ) : (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Skill Gaps Summary */}
      {skillGaps.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Gap da Colmare ({skillGaps.length})
              </CardTitle>
              <CardDescription>Competenze sotto il livello richiesto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {skillGaps.map((gap) => (
                  <div key={gap.skill_name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{gap.skill_name}</span>
                      <Badge variant="outline" className="text-orange-600">
                        Gap: {gap.gap} {gap.gap === 1 ? 'livello' : 'livelli'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Attuale: {gap.current}/5</span>
                      <span>Richiesto: {gap.required}/5</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
