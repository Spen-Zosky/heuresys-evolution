'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, staggerItem, fadeIn } from '@/lib/motion-presets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Users,
  TrendingUp,
  Briefcase,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/use-auth';
import { SearchBar, detectIntent } from '@/components/workforce-intelligence/search-bar';
import type { Intent, DetectedIntent } from '@/components/workforce-intelligence/search-bar';
import { RiskBadge } from '@/components/workforce-intelligence/risk-badge';
import * as careerApi from '@/lib/api/endpoints/career-intelligence';

// ============================================
// TYPES
// ============================================

interface SearchState {
  query: string;
  intent: DetectedIntent | null;
  loading: boolean;
  error: string | null;
  results: unknown;
}

// ============================================
// QUICK INSIGHTS (idle state)
// ============================================

function QuickInsights() {
  const [skillIntel, setSkillIntel] = useState<careerApi.SkillIntelligenceResponse | null>(null);
  const [concRisk, setConcRisk] = useState<careerApi.ConcentrationRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [si, cr] = await Promise.all([
          careerApi.getSkillIntelligence(),
          careerApi.getConcentrationRisk(),
        ]);
        if (!cancelled) {
          setSkillIntel(si);
          setConcRisk(cr);
        }
      } catch {
        // Silently degrade — insights are optional
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <h1 className="sr-only">Workforce Intelligence</h1>
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const criticalCount = (concRisk?.summary.critical ?? 0) + (concRisk?.summary.high ?? 0);
  const totalSkills = skillIntel?.summary.totalSkills ?? 0;
  const totalAssignments =
    skillIntel?.skills.reduce((sum, s) => sum + s.employeesWithSkill, 0) ?? 0;
  const avgPenetration =
    totalSkills > 0
      ? (
          (skillIntel?.skills.reduce((sum, s) => sum + s.penetrationRate, 0) ?? 0) / totalSkills
        ).toFixed(0)
      : '0';

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8"
    >
      <motion.div variants={staggerItem}>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Rischio Concentrazione
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{criticalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              skill critiche o ad alto rischio nel tuo team
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Skill Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalSkills}{' '}
              <span className="text-base font-normal text-muted-foreground">skill</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAssignments.toLocaleString()} assegnazioni totali
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Copertura Media
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{avgPenetration}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              penetrazione media delle skill nell&apos;organizzazione
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// RESULT RENDERERS
// ============================================

function FindPeopleResults({
  data,
  skillQuery,
}: {
  data: careerApi.SkillIntelligenceResponse;
  skillQuery: string;
}) {
  const filtered = data.skills.filter((s) =>
    s.skillLabel.toLowerCase().includes(skillQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nessuna skill trovata per questa ricerca.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-3"
    >
      {filtered.map((skill) => (
        <motion.div key={skill.skillLabel} variants={staggerItem}>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">{skill.skillLabel}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {skill.skillType}
                  </Badge>
                  <span>{skill.reuseLevel}</span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-semibold">{skill.employeesWithSkill}</span>
                </div>
                <RiskBadge level={skill.riskLevel} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

function CareerTransitionResults({ data }: { data: careerApi.CareerTransitionResponse }) {
  const total = data.have.length + data.transferable.length + data.learn.length;
  const havePct = total > 0 ? (data.have.length / total) * 100 : 0;
  const transferPct = total > 0 ? (data.transferable.length / total) * 100 : 0;
  const learnPct = total > 0 ? (data.learn.length / total) * 100 : 0;

  const difficultyColors: Record<string, string> = {
    easy: 'text-green-600 bg-green-50',
    moderate: 'text-yellow-600 bg-yellow-50',
    hard: 'text-red-600 bg-red-50',
  };
  const difficultyLabels: Record<string, string> = {
    easy: 'Facile',
    moderate: 'Moderata',
    hard: 'Difficile',
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-lg font-semibold">
              <span>{data.sourceOccupation}</span>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <span>{data.targetOccupation}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={difficultyColors[data.difficulty] ?? ''} variant="outline">
                {difficultyLabels[data.difficulty] ?? data.difficulty}
              </Badge>
              <span className="text-2xl font-bold">{data.readinessPercent}%</span>
            </div>
          </div>

          {/* Tricolor bar */}
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-muted">
            <div
              className="bg-green-500 transition-all duration-700"
              style={{ width: `${havePct}%` }}
              title={`Possedute: ${data.have.length}`}
            />
            <div
              className="bg-yellow-400 transition-all duration-700"
              style={{ width: `${transferPct}%` }}
              title={`Trasferibili: ${data.transferable.length}`}
            />
            <div
              className="bg-red-400 transition-all duration-700"
              style={{ width: `${learnPct}%` }}
              title={`Da apprendere: ${data.learn.length}`}
            />
          </div>
          <div className="flex gap-6 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              Possedute ({data.have.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />
              Trasferibili ({data.transferable.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
              Da apprendere ({data.learn.length})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Skill lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkillList
          title="Possedute"
          skills={data.have}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          color="green"
        />
        <SkillList
          title="Trasferibili"
          skills={data.transferable}
          icon={<RefreshCw className="h-4 w-4 text-yellow-500" />}
          color="yellow"
        />
        <SkillList
          title="Da Apprendere"
          skills={data.learn}
          icon={<XCircle className="h-4 w-4 text-red-400" />}
          color="red"
        />
      </div>
    </motion.div>
  );
}

function SkillList({
  title,
  skills,
  icon,
  color,
}: {
  title: string;
  skills: careerApi.TransitionSkill[];
  icon: React.ReactNode;
  color: string;
}) {
  const borderClass =
    color === 'green'
      ? 'border-t-green-500'
      : color === 'yellow'
        ? 'border-t-yellow-400'
        : 'border-t-red-400';

  return (
    <Card className={`border-t-4 ${borderClass}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title} ({skills.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {skills.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessuna</p>
        ) : (
          skills.map((s) => (
            <div key={s.skillLabel} className="flex items-center justify-between text-sm">
              <span className="truncate mr-2">{s.skillLabel}</span>
              {s.transferability > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(s.transferability * 100).toFixed(0)}%
                </span>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function GapAnalysisResults({ data }: { data: careerApi.GapAnalysisResponse }) {
  const possessed = data.skills.filter((s) => s.transferability >= 0.8);
  const missing = data.skills.filter((s) => s.transferability < 0.8);

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Summary card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="py-6">
          <h3 className="font-semibold text-lg mb-2">{data.targetOccupation}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold">{data.summary.readinessPercent}%</p>
              <p className="text-xs text-muted-foreground">Prontezza</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.summary.total}</p>
              <p className="text-xs text-muted-foreground">Skill totali</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{data.summary.possessed}</p>
              <p className="text-xs text-muted-foreground">Possedute</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{data.summary.missing}</p>
              <p className="text-xs text-muted-foreground">Mancanti</p>
            </div>
          </div>
          <Progress value={data.summary.readinessPercent} className="mt-4 h-2" />
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-t-4 border-t-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Possedute ({possessed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {possessed.map((s) => (
              <div key={s.skillId} className="flex items-center justify-between text-sm">
                <span className="truncate mr-2">{s.skillLabel}</span>
                <Progress value={s.transferability * 100} className="w-20 h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-red-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              Mancanti ({missing.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {missing.map((s) => (
              <div key={s.skillId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate mr-2">{s.skillLabel}</span>
                  <Badge variant="outline" className="text-xs">
                    {s.gapDifficulty ?? 'n/a'}
                  </Badge>
                </div>
                {s.closestExistingSkill && (
                  <p className="text-xs text-muted-foreground pl-2">
                    Skill simile: {s.closestExistingSkill} ({(s.transferability * 100).toFixed(0)}%)
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

function SimilarSkillsResults({ data }: { data: careerApi.SimilarSkill[] }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-3"
    >
      {data.map((skill) => (
        <motion.div key={skill.skillId} variants={staggerItem}>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">{skill.preferredLabel}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {skill.skillType}
                    </Badge>
                    <span>{skill.reuseLevel}</span>
                  </div>
                </div>
                <span className="text-lg font-semibold">
                  {(skill.similarity * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={skill.similarity * 100} className="h-1.5" />
            </CardContent>
          </Card>
        </motion.div>
      ))}
      {data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessuna skill simile trovata.
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function FindOccupationsResults({ data }: { data: careerApi.MatchingOccupation[] }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      {data.map((occ) => (
        <motion.div key={occ.occupationId} variants={staggerItem}>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="space-y-1 min-w-0">
                <p className="font-medium truncate">{occ.preferredLabel}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  <span>ISCO {occ.iscoCode}</span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <span className="text-lg font-semibold">{(occ.similarity * 100).toFixed(0)}%</span>
                <p className="text-xs text-muted-foreground">match</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
      {data.length === 0 && (
        <Card className="md:col-span-2">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessuna occupazione trovata.
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function ConcentrationRiskResults({ data }: { data: careerApi.ConcentrationRiskResponse }) {
  const sorted = [...data.risks].sort((a, b) => {
    const order = { critical: 0, high: 1, moderate: 2, healthy: 3 };
    return (order[a.riskLevel] ?? 4) - (order[b.riskLevel] ?? 4);
  });

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Critiche', count: data.summary.critical, color: 'text-red-600' },
          { label: 'Alte', count: data.summary.high, color: 'text-orange-600' },
          { label: 'Moderate', count: data.summary.moderate, color: 'text-yellow-600' },
          { label: 'Sane', count: data.summary.healthy, color: 'text-green-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk list */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-3"
      >
        {sorted.map((risk) => (
          <motion.div key={risk.skillLabel} variants={staggerItem}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="space-y-1">
                    <p className="font-medium">{risk.skillLabel}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {risk.skillType}
                      </Badge>
                      <span>
                        {risk.employeeCount} person
                        {risk.employeeCount !== 1 ? 'e' : 'a'}
                      </span>
                    </div>
                  </div>
                  <RiskBadge level={risk.riskLevel} />
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={risk.penetrationRate * 100} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {(risk.penetrationRate * 100).toFixed(0)}% penetrazione
                  </span>
                </div>
                {risk.holders.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {risk.holders.slice(0, 5).map((h) => (
                      <Badge key={h} variant="secondary" className="text-xs">
                        {h}
                      </Badge>
                    ))}
                    {risk.holders.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{risk.holders.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// INTENT LABEL
// ============================================

const INTENT_LABELS: Record<Intent, string> = {
  FIND_PEOPLE: 'Cerca Persone',
  CAREER_TRANSITION: 'Transizione Carriera',
  GAP_ANALYSIS: 'Gap Analysis',
  SIMILAR_SKILLS: 'Skill Simili',
  FIND_OCCUPATIONS: 'Cerca Occupazioni',
  CONCENTRATION_RISK: 'Rischio Concentrazione',
};

// ============================================
// MAIN PAGE
// ============================================

export default function WorkforceIntelligenceSearchPage() {
  const t = useTranslations('admin.workforceIntelligence');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const [state, setState] = useState<SearchState>({
    query: '',
    intent: null,
    loading: false,
    error: null,
    results: null,
  });

  const handleSearch = useCallback(
    async (query: string) => {
      const detected = detectIntent(query);

      setState({
        query,
        intent: detected,
        loading: true,
        error: null,
        results: null,
      });

      try {
        let results: unknown = null;

        switch (detected.intent) {
          case 'FIND_PEOPLE': {
            results = await careerApi.getSkillIntelligence();
            break;
          }

          case 'CAREER_TRANSITION': {
            const srcOccs = await careerApi.getMatchingOccupations(detected.params.source, {
              maxResults: 1,
            });
            const tgtOccs = await careerApi.getMatchingOccupations(detected.params.target, {
              maxResults: 1,
            });
            if (srcOccs.length === 0 || tgtOccs.length === 0) {
              throw new Error(
                'Occupazione di partenza o di arrivo non trovata. Prova con termini diversi.'
              );
            }
            results = await careerApi.getCareerTransition(srcOccs[0].uri, tgtOccs[0].uri);
            break;
          }

          case 'GAP_ANALYSIS': {
            if (!user?.employeeId) {
              throw new Error(
                'Nessun profilo dipendente associato al tuo account. Gap analysis non disponibile.'
              );
            }
            const occs = await careerApi.getMatchingOccupations(detected.params.occupation, {
              maxResults: 1,
            });
            if (occs.length === 0) {
              throw new Error('Occupazione non trovata. Prova con termini diversi.');
            }
            results = await careerApi.getGapAnalysis(user.employeeId, occs[0].uri);
            break;
          }

          case 'SIMILAR_SKILLS': {
            const skillOccs = await careerApi.getMatchingOccupations(detected.params.skill, {
              maxResults: 1,
            });
            if (skillOccs.length === 0) {
              throw new Error('Skill o occupazione non trovata. Prova con termini diversi.');
            }
            results = await careerApi.getSimilarSkills(skillOccs[0].uri);
            break;
          }

          case 'FIND_OCCUPATIONS': {
            results = await careerApi.getMatchingOccupations(detected.params.query, {
              maxResults: 20,
            });
            break;
          }

          case 'CONCENTRATION_RISK': {
            results = await careerApi.getConcentrationRisk();
            break;
          }
        }

        setState((prev) => ({ ...prev, loading: false, results }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore durante la ricerca. Riprova.';
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
        toast.error(message);
      }
    },
    [user]
  );

  return (
    <div className="space-y-8">
      {/* Search bar — Spotlight style */}
      <div className="pt-4">
        <SearchBar onSearch={handleSearch} isLoading={state.loading} />
      </div>

      {/* Intent indicator */}
      <AnimatePresence mode="wait">
        {state.intent && !state.loading && (
          <motion.div
            key="intent"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2"
          >
            <Badge variant="outline" className="text-xs">
              {INTENT_LABELS[state.intent.intent]}
            </Badge>
            <span className="text-sm text-muted-foreground">&ldquo;{state.query}&rdquo;</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeletons */}
      {state.loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="py-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {state.error && !state.loading && (
        <Card className="border-red-200">
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600">{state.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {!state.loading && !state.error && state.results !== null && state.intent ? (
          <motion.div
            key={state.query + state.intent.intent}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {state.intent.intent === 'FIND_PEOPLE' && (
              <FindPeopleResults
                data={state.results as careerApi.SkillIntelligenceResponse}
                skillQuery={state.intent.params.skill}
              />
            )}
            {state.intent.intent === 'CAREER_TRANSITION' && (
              <CareerTransitionResults data={state.results as careerApi.CareerTransitionResponse} />
            )}
            {state.intent.intent === 'GAP_ANALYSIS' && (
              <GapAnalysisResults data={state.results as careerApi.GapAnalysisResponse} />
            )}
            {state.intent.intent === 'SIMILAR_SKILLS' && (
              <SimilarSkillsResults data={state.results as careerApi.SimilarSkill[]} />
            )}
            {state.intent.intent === 'FIND_OCCUPATIONS' && (
              <FindOccupationsResults data={state.results as careerApi.MatchingOccupation[]} />
            )}
            {state.intent.intent === 'CONCENTRATION_RISK' && (
              <ConcentrationRiskResults
                data={state.results as careerApi.ConcentrationRiskResponse}
              />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Quick Insights — shown when no active query */}
      {!state.intent && !state.loading && <QuickInsights />}
    </div>
  );
}
