'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  StandaloneBlueprintResult,
  BlueprintProcess,
  BlueprintRole,
  BlueprintSkill,
  BlueprintKpi,
  BlueprintOrgUnit,
} from '@/lib/api/endpoints/blueprint-standalone';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function categoryLabel(cat: string) {
  if (cat === 'primary') return 'Primario';
  if (cat === 'support') return 'Supporto';
  return 'Custom';
}

function categoryVariant(cat: string): 'default' | 'secondary' | 'outline' {
  if (cat === 'primary') return 'default';
  if (cat === 'support') return 'secondary';
  return 'outline';
}

function roleTypeLabel(t: string) {
  const map: Record<string, string> = {
    owner: 'Owner',
    executor: 'Esecutore',
    approver: 'Approvatore',
    reviewer: 'Revisore',
    informed: 'Informato',
  };
  return map[t] ?? t;
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

function ProcessTree({ processes }: { processes: BlueprintProcess[] }) {
  const primary = processes.filter((p) => p.processCategory === 'primary');
  const support = processes.filter((p) => p.processCategory === 'support');
  const custom = processes.filter((p) => p.processCategory === 'custom');

  function ProcessList({ items }: { items: BlueprintProcess[] }) {
    return (
      <div className="space-y-3">
        <h1 className="sr-only">Blueprint Result</h1>
        {items.map((p) => (
          <div key={p.id} className="border rounded-lg p-4 bg-card">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded mt-0.5">
                {p.processCode}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{p.processName}</p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {p.typicalInputs?.slice(0, 3).map((inp) => (
                    <Badge key={inp} variant="outline" className="text-xs">
                      {inp}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {primary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Processi Primari ({primary.length})
          </h3>
          <ProcessList items={primary} />
        </div>
      )}
      {support.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Processi di Supporto ({support.length})
          </h3>
          <ProcessList items={support} />
        </div>
      )}
      {custom.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Processi Custom ({custom.length})
          </h3>
          <ProcessList items={custom} />
        </div>
      )}
    </div>
  );
}

function RolesGrid({
  roles,
  processes,
}: {
  roles: BlueprintRole[];
  processes: BlueprintProcess[];
}) {
  const processMap = new Map(processes.map((p) => [p.id, p.processName]));
  return (
    <div className="space-y-3">
      {roles.map((r, i) => (
        <div key={i} className="border rounded-lg p-4 bg-card flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{r.roleName}</p>
              <Badge variant="secondary" className="text-xs">
                {roleTypeLabel(r.roleType)}
              </Badge>
            </div>
            {r.occupationLabel && (
              <p className="text-xs text-muted-foreground mt-1">ESCO: {r.occupationLabel}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Processo:{' '}
              <span className="text-foreground">{processMap.get(r.processId) ?? r.processId}</span>
            </p>
          </div>
          {(r.minHeadcount !== null || r.maxHeadcount !== null) && (
            <div className="text-right text-xs text-muted-foreground shrink-0">
              <p className="font-semibold text-foreground">
                {r.minHeadcount ?? '?'}
                {r.maxHeadcount ? `–${r.maxHeadcount}` : '+'}
              </p>
              <p>FTE</p>
            </div>
          )}
        </div>
      ))}
      {roles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessun ruolo disponibile per questo profilo.
        </p>
      )}
    </div>
  );
}

function SkillsGrid({ skills }: { skills: BlueprintSkill[] }) {
  const mandatory = skills.filter((s) => s.isMandatory);
  const optional = skills.filter((s) => !s.isMandatory);

  function SkillList({ items }: { items: BlueprintSkill[] }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((s, i) => (
          <div key={i} className="border rounded-lg p-3 bg-card">
            <p className="font-medium text-sm">{s.skillName}</p>
            <div className="flex items-center gap-2 mt-1">
              {s.skillType && (
                <Badge variant="outline" className="text-xs">
                  {s.skillType}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">Livello {s.proficiencyLevel}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{s.processName}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mandatory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Skill Obbligatorie ({mandatory.length})
          </h3>
          <SkillList items={mandatory} />
        </div>
      )}
      {optional.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Skill Opzionali ({optional.length})
          </h3>
          <SkillList items={optional} />
        </div>
      )}
      {skills.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessuna skill disponibile per questo profilo.
        </p>
      )}
    </div>
  );
}

function KpiList({ kpis }: { kpis: BlueprintKpi[] }) {
  return (
    <div className="space-y-3">
      {kpis.map((k, i) => (
        <div key={i} className="border rounded-lg p-4 bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {k.kpiCode}
                </span>
                <p className="font-medium text-sm">{k.kpiName}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Processo: <span className="text-foreground">{k.processName}</span>
              </p>
              {k.description && (
                <p className="text-xs text-muted-foreground mt-1">{k.description}</p>
              )}
            </div>
            <div className="text-right text-xs shrink-0">
              {k.benchmarkValue !== null && (
                <p className="font-semibold text-foreground">
                  {parseFloat(String(k.benchmarkValue)).toFixed(1)} {k.measurementUnit ?? ''}
                </p>
              )}
              {k.targetDirection && <p className="text-muted-foreground">{k.targetDirection}</p>}
            </div>
          </div>
        </div>
      ))}
      {kpis.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun KPI disponibile per questo profilo.</p>
      )}
    </div>
  );
}

function OrgChart({
  orgUnits,
  orgConfig,
  typicalDepartments,
}: {
  orgUnits: BlueprintOrgUnit[];
  orgConfig: StandaloneBlueprintResult['meta']['orgConfig'];
  typicalDepartments: string[];
}) {
  const byDepth = orgUnits.reduce<Map<number, BlueprintOrgUnit[]>>((acc, u) => {
    const list = acc.get(u.depth) ?? [];
    list.push(u);
    acc.set(u.depth, list);
    return acc;
  }, new Map());

  return (
    <div className="space-y-6">
      {/* Config summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Headcount stimato', value: orgConfig.headcount },
          { label: 'Reparti suggeriti', value: String(orgConfig.departments) },
          { label: 'Livelli gerarchici', value: String(orgConfig.layers) },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Org unit tree */}
      {orgUnits.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Struttura Organizzativa Suggerita
          </h3>
          {Array.from(byDepth.entries())
            .sort(([a], [b]) => a - b)
            .map(([depth, units]) => (
              <div key={depth} style={{ paddingLeft: `${depth * 16}px` }}>
                <p className="text-xs text-muted-foreground mb-2">
                  Livello {depth + 1}
                  {units[0]?.levelName ? ` — ${units[0].levelName}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {units.map((u) => (
                    <Badge
                      key={u.code}
                      variant={u.isManagement ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {u.nameIt}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : typicalDepartments.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Reparti Tipici
          </h3>
          <div className="flex flex-wrap gap-2">
            {typicalDepartments.map((d) => (
              <Badge key={d} variant="secondary" className="text-sm">
                {d}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Struttura organizzativa non disponibile per questo profilo.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EXPORT HELPER
// ---------------------------------------------------------------------------

function handleExportJson(result: StandaloneBlueprintResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blueprint-${result.meta.naceCode}-${result.meta.companySize}.json`.toLowerCase();
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------

export default function BlueprintStandaloneResultPage() {
  const t = useTranslations('dashboards');
  const router = useRouter();
  const [result, setResult] = useState<StandaloneBlueprintResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('blueprint_standalone_result');
    if (!raw) {
      setNotFound(true);
      return;
    }
    try {
      setResult(JSON.parse(raw) as StandaloneBlueprintResult);
    } catch {
      setNotFound(true);
    }
  }, []);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Nessun blueprint trovato.</p>
          <Button onClick={() => router.push('/blueprint-standalone')}>Genera un Blueprint</Button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  const { meta, processes, roles, skills, kpis, orgUnits, typicalDepartments } = result;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/blueprint-standalone')}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              ← Indietro
            </button>
            <div className="h-4 w-px bg-border" />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {meta.industry?.nameIt ?? meta.naceCode}
              </p>
              <p className="text-xs text-muted-foreground">{meta.orgConfig.label}</p>
            </div>
            {!meta.matchedExact && (
              <Badge variant="outline" className="text-xs shrink-0">
                Match approssimativo
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => handleExportJson(result)}>
              Export JSON
            </Button>
            <Button size="sm" asChild>
              <a href="/auth/register">Crea Account</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="border-b bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex gap-6 overflow-x-auto">
          {[
            { label: 'Processi', value: processes.length },
            { label: 'Ruoli', value: roles.length },
            { label: 'Skill', value: skills.length },
            { label: 'KPI', value: kpis.length },
            { label: 'Unità org.', value: orgUnits.length },
          ].map((s) => (
            <div key={s.label} className="text-center shrink-0">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <Tabs defaultValue="processes">
          <TabsList className="mb-6">
            <TabsTrigger value="processes">
              Processi{' '}
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {processes.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="roles">
              Ruoli{' '}
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {roles.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="skills">
              Skill{' '}
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {skills.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="kpis">
              KPI{' '}
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {kpis.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="org">Org Chart</TabsTrigger>
          </TabsList>

          <TabsContent value="processes">
            <ProcessTree processes={processes} />
          </TabsContent>

          <TabsContent value="roles">
            <RolesGrid roles={roles} processes={processes} />
          </TabsContent>

          <TabsContent value="skills">
            <SkillsGrid skills={skills} />
          </TabsContent>

          <TabsContent value="kpis">
            <KpiList kpis={kpis} />
          </TabsContent>

          <TabsContent value="org">
            <OrgChart
              orgUnits={orgUnits}
              orgConfig={meta.orgConfig}
              typicalDepartments={typicalDepartments}
            />
          </TabsContent>
        </Tabs>

        {/* CTA bottom */}
        <Card className="mt-12 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Personalizza e salva il tuo Blueprint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Con un account Heuresys puoi modificare processi, assegnare dipendenti, tracciare i
              KPI nel tempo e molto altro.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <a href="/auth/register">Registrati gratuitamente</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/auth/login">Accedi</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
