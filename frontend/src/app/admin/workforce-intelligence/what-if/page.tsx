'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  UserMinus,
  UserPlus,
  ArrowDown,
  ArrowUp,
  Minus,
  AlertTriangle,
  Shield,
  Search,
  X,
} from 'lucide-react';
import { RiskBadge } from '@/components/workforce-intelligence/risk-badge';
import { apiClient } from '@/lib/api/client';
import * as careerApi from '@/lib/api/endpoints/career-intelligence';
import type {
  SkillIntelligenceResponse,
  SkillIntelligenceItem,
} from '@/lib/api/endpoints/career-intelligence';

// ============================================
// TYPES
// ============================================

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
}

interface RiskSummary {
  critical: number;
  high: number;
  moderate: number;
  healthy: number;
}

interface SkillDiff {
  skillLabel: string;
  currentLevel: string;
  simulatedLevel: string;
  direction: 'up' | 'down' | 'same';
  currentCount: number;
  simulatedCount: number;
}

// ============================================
// RISK CALCULATION
// ============================================

function calcRiskLevel(employeesWithSkill: number, totalEmployees: number): string {
  if (totalEmployees === 0) return 'healthy';
  const penetration = employeesWithSkill / totalEmployees;
  if (employeesWithSkill <= 2) return 'critical';
  if (employeesWithSkill <= 4 || penetration < 0.05) return 'high';
  if (penetration < 0.1) return 'moderate';
  return 'healthy';
}

function riskSeverity(level: string): number {
  switch (level) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'moderate':
      return 2;
    case 'healthy':
      return 3;
    default:
      return 4;
  }
}

function mapIntelToConcentrationLevel(riskLevel: string): string {
  switch (riskLevel) {
    case 'CRITICAL_GAP':
      return 'critical';
    case 'SCARCE':
      return 'high';
    case 'HEALTHY':
      return 'healthy';
    case 'WIDESPREAD':
      return 'healthy';
    default:
      return 'healthy';
  }
}

function summarizeRisks(levels: string[]): RiskSummary {
  return levels.reduce<RiskSummary>(
    (acc, l) => {
      if (l === 'critical') acc.critical++;
      else if (l === 'high') acc.high++;
      else if (l === 'moderate') acc.moderate++;
      else acc.healthy++;
      return acc;
    },
    { critical: 0, high: 0, moderate: 0, healthy: 0 }
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function WhatIfPage() {
  const t = useTranslations('admin.workforceIntelligence.whatIf');
  const tCommon = useTranslations('common');
  const [intel, setIntel] = useState<SkillIntelligenceResponse | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('loss');

  // Loss scenario state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [employeeSkills, setEmployeeSkills] = useState<Map<string, string[]>>(new Map());
  const [loadingSkills, setLoadingSkills] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Acquisition scenario state
  const [addCount, setAddCount] = useState(1);
  const [selectedAcqSkills, setSelectedAcqSkills] = useState<Set<string>>(new Set());
  const [skillSearch, setSkillSearch] = useState('');

  // Fetch base data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [intelRes, empRes] = await Promise.all([
        careerApi.getSkillIntelligence(),
        apiClient.get<{ data: { items?: Employee[] } | Employee[] }>('/api/v1/employees?limit=200'),
      ]);
      setIntel(intelRes);
      const empData = empRes.data;
      const empList = Array.isArray(empData) ? empData : (empData.items ?? []);
      setEmployees(empList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dati');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch employee skills when selected
  const fetchEmployeeSkills = useCallback(
    async (empId: string) => {
      if (employeeSkills.has(empId)) return;
      setLoadingSkills((prev) => new Set(prev).add(empId));
      try {
        const res = await apiClient.get<{
          data:
            | { skills?: { skillLabel?: string; preferredLabel?: string }[] }
            | { skillLabel?: string; preferredLabel?: string }[];
        }>(`/api/v1/employee-skill-profiles/${empId}`);
        const profile = res.data;
        const skills = Array.isArray(profile)
          ? profile.map((s) => s.preferredLabel || s.skillLabel || '')
          : (profile.skills ?? []).map((s) => s.preferredLabel || s.skillLabel || '');
        setEmployeeSkills((prev) => new Map(prev).set(empId, skills.filter(Boolean)));
      } catch {
        // Silently handle - employee may have no skill profile
        setEmployeeSkills((prev) => new Map(prev).set(empId, []));
      } finally {
        setLoadingSkills((prev) => {
          const next = new Set(prev);
          next.delete(empId);
          return next;
        });
      }
    },
    [employeeSkills]
  );

  const toggleEmployee = useCallback(
    (empId: string) => {
      setSelectedEmployeeIds((prev) => {
        const next = new Set(prev);
        if (next.has(empId)) {
          next.delete(empId);
        } else {
          next.add(empId);
          fetchEmployeeSkills(empId);
        }
        return next;
      });
    },
    [fetchEmployeeSkills]
  );

  // Current risk levels from intel data
  const currentSkillMap = useMemo(() => {
    if (!intel) return new Map<string, SkillIntelligenceItem>();
    return new Map(intel.skills.map((s) => [s.skillLabel, s]));
  }, [intel]);

  const currentRiskLevels = useMemo(() => {
    if (!intel) return [];
    return intel.skills.map((s) => mapIntelToConcentrationLevel(s.riskLevel));
  }, [intel]);

  const currentSummary = useMemo(() => summarizeRisks(currentRiskLevels), [currentRiskLevels]);

  // ==== LOSS SCENARIO SIMULATION ====
  const lossSimulation = useMemo((): {
    diffs: SkillDiff[];
    summary: RiskSummary;
    impactScore: number;
  } => {
    if (!intel || selectedEmployeeIds.size === 0) {
      return { diffs: [], summary: currentSummary, impactScore: 0 };
    }

    const totalEmployees = Math.max(
      (intel.skills[0]?.employeesWithSkill ?? 0) > 0
        ? Math.round(intel.skills[0].employeesWithSkill / intel.skills[0].penetrationRate)
        : 0,
      1
    );
    const simTotalEmployees = Math.max(totalEmployees - selectedEmployeeIds.size, 0);

    // Gather all skills from selected employees
    const skillLossCount = new Map<string, number>();
    for (const empId of selectedEmployeeIds) {
      const skills = employeeSkills.get(empId) ?? [];
      for (const skillLabel of skills) {
        skillLossCount.set(skillLabel, (skillLossCount.get(skillLabel) ?? 0) + 1);
      }
    }

    const diffs: SkillDiff[] = [];
    const simRiskLevels: string[] = [];

    for (const skill of intel.skills) {
      const currentLevel = mapIntelToConcentrationLevel(skill.riskLevel);
      const loss = skillLossCount.get(skill.skillLabel) ?? 0;
      const simCount = Math.max(skill.employeesWithSkill - loss, 0);
      const simLevel = calcRiskLevel(simCount, simTotalEmployees);
      simRiskLevels.push(simLevel);

      if (currentLevel !== simLevel) {
        const currentSev = riskSeverity(currentLevel);
        const simSev = riskSeverity(simLevel);
        diffs.push({
          skillLabel: skill.skillLabel,
          currentLevel,
          simulatedLevel: simLevel,
          direction: simSev < currentSev ? 'down' : simSev > currentSev ? 'up' : 'same',
          currentCount: skill.employeesWithSkill,
          simulatedCount: simCount,
        });
      }
    }

    const simSummary = summarizeRisks(simRiskLevels);
    const currentCritHigh = currentSummary.critical + currentSummary.high;
    const simCritHigh = simSummary.critical + simSummary.high;
    const impactScore = simCritHigh - currentCritHigh;

    // Sort diffs: worsened (down = more critical) first
    diffs.sort((a, b) => riskSeverity(a.simulatedLevel) - riskSeverity(b.simulatedLevel));

    return { diffs, summary: simSummary, impactScore };
  }, [intel, selectedEmployeeIds, employeeSkills, currentSummary]);

  // ==== ACQUISITION SCENARIO SIMULATION ====
  const acqSimulation = useMemo((): {
    diffs: SkillDiff[];
    summary: RiskSummary;
    impactScore: number;
  } => {
    if (!intel || selectedAcqSkills.size === 0 || addCount <= 0) {
      return { diffs: [], summary: currentSummary, impactScore: 0 };
    }

    const totalEmployees = Math.max(
      (intel.skills[0]?.employeesWithSkill ?? 0) > 0
        ? Math.round(intel.skills[0].employeesWithSkill / intel.skills[0].penetrationRate)
        : 0,
      1
    );
    const simTotalEmployees = totalEmployees + addCount;

    const diffs: SkillDiff[] = [];
    const simRiskLevels: string[] = [];

    for (const skill of intel.skills) {
      const currentLevel = mapIntelToConcentrationLevel(skill.riskLevel);
      const addition = selectedAcqSkills.has(skill.skillLabel) ? addCount : 0;
      const simCount = skill.employeesWithSkill + addition;
      const simLevel = calcRiskLevel(simCount, simTotalEmployees);
      simRiskLevels.push(simLevel);

      if (currentLevel !== simLevel) {
        const currentSev = riskSeverity(currentLevel);
        const simSev = riskSeverity(simLevel);
        diffs.push({
          skillLabel: skill.skillLabel,
          currentLevel,
          simulatedLevel: simLevel,
          direction: simSev > currentSev ? 'up' : simSev < currentSev ? 'down' : 'same',
          currentCount: skill.employeesWithSkill,
          simulatedCount: simCount,
        });
      }
    }

    const simSummary = summarizeRisks(simRiskLevels);
    const currentCritHigh = currentSummary.critical + currentSummary.high;
    const simCritHigh = simSummary.critical + simSummary.high;
    const impactScore = simCritHigh - currentCritHigh;

    diffs.sort((a, b) => riskSeverity(a.simulatedLevel) - riskSeverity(b.simulatedLevel));

    return { diffs, summary: simSummary, impactScore };
  }, [intel, selectedAcqSkills, addCount, currentSummary]);

  // Filtered employee list
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        (e.jobTitle?.toLowerCase().includes(q) ?? false)
    );
  }, [employees, employeeSearch]);

  // Available skills for acquisition
  const availableSkills = useMemo(() => {
    if (!intel) return [];
    if (!skillSearch.trim()) return intel.skills.map((s) => s.skillLabel);
    const q = skillSearch.toLowerCase();
    return intel.skills
      .filter((s) => s.skillLabel.toLowerCase().includes(q))
      .map((s) => s.skillLabel);
  }, [intel, skillSearch]);

  const toggleAcqSkill = useCallback((label: string) => {
    setSelectedAcqSkills((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // Error state
  if (error && !loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 text-sm text-primary underline hover:no-underline"
          >
            Riprova
          </button>
        </CardContent>
      </Card>
    );
  }

  // Active simulation results
  const simulation = activeTab === 'loss' ? lossSimulation : acqSimulation;
  const hasSimulation =
    activeTab === 'loss'
      ? selectedEmployeeIds.size > 0
      : selectedAcqSkills.size > 0 && addCount > 0;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      <h1 className="sr-only">What-If Simulator</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <motion.div variants={staggerItem}>
          <TabsList className="mb-4">
            <TabsTrigger value="loss" className="gap-2">
              <UserMinus className="h-4 w-4" />
              Scenario Perdita
            </TabsTrigger>
            <TabsTrigger value="acquisition" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Scenario Acquisizione
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* Loss Scenario Tab */}
        <TabsContent value="loss">
          <motion.div variants={staggerItem}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Employee Selector */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">Seleziona Dipendenti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca dipendente..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="pl-9"
                    />
                    {employeeSearch && (
                      <button
                        onClick={() => setEmployeeSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {selectedEmployeeIds.size > 0 && (
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant="secondary">
                        {selectedEmployeeIds.size} selezionat
                        {selectedEmployeeIds.size === 1 ? 'o' : 'i'}
                      </Badge>
                      <button
                        onClick={() => setSelectedEmployeeIds(new Set())}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Deseleziona tutti
                      </button>
                    </div>
                  )}

                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                      {filteredEmployees.map((emp) => {
                        const isSelected = selectedEmployeeIds.has(emp.id);
                        const skills = employeeSkills.get(emp.id);
                        const isLoadingSkills = loadingSkills.has(emp.id);
                        return (
                          <div
                            key={emp.id}
                            className={`p-2 rounded-md border cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-transparent hover:bg-muted/50'
                            }`}
                            onClick={() => toggleEmployee(emp.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox checked={isSelected} tabIndex={-1} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {emp.firstName} {emp.lastName}
                                </p>
                                {emp.jobTitle && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {emp.jobTitle}
                                  </p>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-1.5 ml-6">
                                {isLoadingSkills ? (
                                  <Skeleton className="h-4 w-32" />
                                ) : skills && skills.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {skills.slice(0, 5).map((s) => (
                                      <Badge
                                        key={s}
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        {s}
                                      </Badge>
                                    ))}
                                    {skills.length > 5 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{skills.length - 5}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground">
                                    Nessuna skill registrata
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {filteredEmployees.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nessun dipendente trovato
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Comparison View */}
              <div className="lg:col-span-2">
                <ComparisonView
                  loading={loading}
                  hasSimulation={hasSimulation}
                  currentSummary={currentSummary}
                  simSummary={simulation.summary}
                  diffs={simulation.diffs}
                  impactScore={simulation.impactScore}
                  scenarioLabel="Dopo la perdita"
                />
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Acquisition Scenario Tab */}
        <TabsContent value="acquisition">
          <motion.div variants={staggerItem}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Skill Selector */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">Configura Acquisizione</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                      Numero persone da aggiungere
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={addCount}
                      onChange={(e) => setAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                      Skill da aggiungere
                    </label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca skill..."
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        className="pl-9"
                      />
                      {skillSearch && (
                        <button
                          onClick={() => setSkillSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>

                    {selectedAcqSkills.size > 0 && (
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="secondary">
                          {selectedAcqSkills.size} skill selezionat
                          {selectedAcqSkills.size === 1 ? 'a' : 'e'}
                        </Badge>
                        <button
                          onClick={() => setSelectedAcqSkills(new Set())}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Rimuovi tutte
                        </button>
                      </div>
                    )}

                    {/* Selected skills tags */}
                    {selectedAcqSkills.size > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {Array.from(selectedAcqSkills).map((s) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-destructive/10"
                            onClick={() => toggleAcqSkill(s)}
                          >
                            {s}
                            <X className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    )}

                    {loading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                        {availableSkills.map((label) => {
                          const isSelected = selectedAcqSkills.has(label);
                          const skillData = currentSkillMap.get(label);
                          return (
                            <div
                              key={label}
                              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-primary/5 border border-primary'
                                  : 'hover:bg-muted/50 border border-transparent'
                              }`}
                              onClick={() => toggleAcqSkill(label)}
                            >
                              <Checkbox checked={isSelected} tabIndex={-1} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{label}</p>
                              </div>
                              {skillData && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {skillData.employeesWithSkill}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {availableSkills.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nessuna skill trovata
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Comparison View */}
              <div className="lg:col-span-2">
                <ComparisonView
                  loading={loading}
                  hasSimulation={hasSimulation}
                  currentSummary={currentSummary}
                  simSummary={simulation.summary}
                  diffs={simulation.diffs}
                  impactScore={simulation.impactScore}
                  scenarioLabel="Dopo l'acquisizione"
                />
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

// ============================================
// COMPARISON VIEW COMPONENT
// ============================================

function ComparisonView({
  loading,
  hasSimulation,
  currentSummary,
  simSummary,
  diffs,
  impactScore,
  scenarioLabel,
}: {
  loading: boolean;
  hasSimulation: boolean;
  currentSummary: RiskSummary;
  simSummary: RiskSummary;
  diffs: SkillDiff[];
  impactScore: number;
  scenarioLabel: string;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Impact Score */}
      {hasSimulation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card
            className={
              impactScore > 0
                ? 'border-destructive/30 bg-destructive/5'
                : impactScore < 0
                  ? 'border-green-500/30 bg-green-500/5'
                  : ''
            }
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {impactScore > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : impactScore < 0 ? (
                    <Shield className="h-5 w-5 text-green-600" />
                  ) : (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Impatto Rischio</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      impactScore > 0
                        ? 'text-destructive'
                        : impactScore < 0
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {impactScore > 0 ? '+' : ''}
                    {impactScore}
                  </span>
                  <span className="text-xs text-muted-foreground">rischi critici/alti</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Side by side summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard title="Stato Attuale" summary={currentSummary} />
        <SummaryCard
          title={scenarioLabel}
          summary={hasSimulation ? simSummary : currentSummary}
          highlight={hasSimulation}
        />
      </div>

      {/* Diff list */}
      {hasSimulation && diffs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skill con Cambio Livello ({diffs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {diffs.map((diff) => (
                  <motion.div
                    key={diff.skillLabel}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{diff.skillLabel}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {diff.currentCount} &rarr; {diff.simulatedCount} dipendenti
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={diff.currentLevel} />
                      <DiffArrow direction={diff.direction} />
                      <RiskBadge level={diff.simulatedLevel} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}

      {hasSimulation && diffs.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nessun cambio di livello di rischio rilevato con questa configurazione.
            </p>
          </CardContent>
        </Card>
      )}

      {!hasSimulation && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Seleziona gli elementi nel pannello a sinistra per simulare uno scenario.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// SUMMARY CARD
// ============================================

function SummaryCard({
  title,
  summary,
  highlight,
}: {
  title: string;
  summary: RiskSummary;
  highlight?: boolean;
}) {
  const total = summary.critical + summary.high + summary.moderate + summary.healthy;

  return (
    <Card className={highlight ? 'border-primary/30' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <SummaryItem label="Critico" value={summary.critical} color="text-red-600" />
          <SummaryItem label="Alto" value={summary.high} color="text-orange-600" />
          <SummaryItem label="Moderato" value={summary.moderate} color="text-yellow-600" />
          <SummaryItem label="Sano" value={summary.healthy} color="text-green-600" />
        </div>
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground text-center">
          Totale skill analizzate: {total}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ============================================
// DIFF ARROW
// ============================================

function DiffArrow({ direction }: { direction: 'up' | 'down' | 'same' }) {
  if (direction === 'down') {
    return <ArrowDown className="h-4 w-4 text-destructive shrink-0" />;
  }
  if (direction === 'up') {
    return <ArrowUp className="h-4 w-4 text-green-600 shrink-0" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground shrink-0" />;
}
