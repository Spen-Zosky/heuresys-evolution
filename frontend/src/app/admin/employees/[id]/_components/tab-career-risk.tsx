'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api/client';

interface TabCareerRiskProps {
  employeeId: string;
}

interface SectionState {
  data: any;
  error: boolean;
}

export function TabCareerRisk({ employeeId }: TabCareerRiskProps) {
  const [career, setCareer] = useState<SectionState>({ data: null, error: false });
  const [succession, setSuccession] = useState<SectionState>({ data: null, error: false });
  const [wellbeing, setWellbeing] = useState<SectionState>({ data: null, error: false });
  const [turnover, setTurnover] = useState<SectionState>({ data: null, error: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSection = async (
      url: string,
      transform: (raw: any) => any,
      setter: (v: SectionState) => void
    ) => {
      try {
        const response = await apiClient.get<any>(url);
        setter({ data: transform(response?.data), error: false });
      } catch {
        setter({ data: null, error: true });
      }
    };

    // Career: recommendations endpoint returns [{path, score, gap_count, ...}]
    const careerTransform = (raw: any) => {
      const arr = Array.isArray(raw) ? raw : raw?.items || [];
      return arr.map((r: any) => ({
        id: r.path?.id || r.id,
        target_role: r.path?.name || r.target_role || r.title || r.name,
        status: r.path?.path_type,
        readiness_percent: r.score != null ? Math.round(r.score * 100) : r.readiness_percent,
      }));
    };

    // Succession: filter candidates where this employee is a candidate
    const successionTransform = (raw: any) => {
      const arr = Array.isArray(raw) ? raw : raw?.items || [];
      return arr
        .filter((c: any) => c.candidate_employee_id === employeeId)
        .map((c: any) => ({
          id: c.id,
          position_title: c.target_role || c.current_role,
          readiness: c.readiness_level,
        }));
    };

    // Wellbeing: extract latest checkin and aggregate fields
    const wellbeingTransform = (raw: any) => {
      const checkins = Array.isArray(raw?.checkins) ? raw.checkins : [];
      if (checkins.length === 0) return [];
      const sorted = [...checkins].sort(
        (a, b) => new Date(b.checkin_date || 0).getTime() - new Date(a.checkin_date || 0).getTime()
      );
      const latest = sorted[0];
      const wellbeingScore =
        ((Number(latest.mood_score) || 0) +
          (Number(latest.energy_level) || 0) +
          (Number(latest.work_life_balance) || 0) +
          (Number(latest.sleep_quality) || 0)) /
        4;
      const stress = Number(latest.stress_level) || 0;
      const burnout = stress >= 4 ? 'high' : stress >= 3 ? 'medium' : 'low';
      return [
        {
          id: latest.id,
          wellbeing_score: wellbeingScore.toFixed(1),
          stress_level: stress.toFixed(1),
          burnout_risk: burnout,
        },
      ];
    };

    // Predictions: filter by employee
    const turnoverTransform = (raw: any) => {
      const arr = Array.isArray(raw) ? raw : raw?.items || [];
      return arr
        .filter((p: any) => p.employee_id === employeeId)
        .map((p: any) => ({
          id: p.id,
          risk_score: parseFloat(p.risk_score) * 100,
          risk_level: p.risk_level,
          prediction_type: Array.isArray(p.risk_factors)
            ? p.risk_factors.join(', ')
            : p.prediction_type,
        }));
    };

    Promise.allSettled([
      fetchSection(
        `/api/v1/career-paths/recommendations/${employeeId}`,
        careerTransform,
        setCareer
      ),
      fetchSection(`/api/v1/succession/candidates`, successionTransform, setSuccession),
      fetchSection(`/api/v1/wellbeing/employee/${employeeId}`, wellbeingTransform, setWellbeing),
      fetchSection(`/api/v1/predictions/turnover/high-risk`, turnoverTransform, setTurnover),
    ]).finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Profilo Carriera */}
      <Card>
        <CardHeader>
          <CardTitle>Profilo Carriera</CardTitle>
        </CardHeader>
        <CardContent>
          {career.error ? (
            <p className="text-sm text-muted-foreground">Dati non disponibili</p>
          ) : !career.data || (Array.isArray(career.data) && career.data.length === 0) ? (
            <p className="text-sm text-muted-foreground">Nessun percorso di carriera definito</p>
          ) : (
            <div className="space-y-3">
              {(Array.isArray(career.data) ? career.data : [career.data]).map(
                (p: any, i: number) => (
                  <div key={p.id || i} className="rounded-md border p-3 space-y-1">
                    <p className="font-medium text-sm">
                      {p.target_role || p.title || p.name || 'Percorso'}
                    </p>
                    {p.status && <Badge variant="secondary">{p.status}</Badge>}
                    {p.readiness_percent != null && (
                      <div className="flex items-center gap-2 pt-1">
                        <Progress value={parseFloat(p.readiness_percent)} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {parseFloat(p.readiness_percent).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Piani di Successione */}
      <Card>
        <CardHeader>
          <CardTitle>Piani di Successione</CardTitle>
        </CardHeader>
        <CardContent>
          {succession.error ? (
            <p className="text-sm text-muted-foreground">Dati non disponibili</p>
          ) : !succession.data ||
            (Array.isArray(succession.data) && succession.data.length === 0) ? (
            <p className="text-sm text-muted-foreground">Nessun piano di successione</p>
          ) : (
            <div className="space-y-3">
              {(Array.isArray(succession.data) ? succession.data : [succession.data]).map(
                (s: any, i: number) => (
                  <div key={s.id || i} className="rounded-md border p-3">
                    <p className="font-medium text-sm">
                      {s.position_title || s.role || 'Posizione'}
                    </p>
                    {s.readiness && (
                      <Badge variant="outline" className="mt-1">
                        {s.readiness}
                      </Badge>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benessere & Burnout */}
      <Card>
        <CardHeader>
          <CardTitle>Benessere &amp; Burnout</CardTitle>
        </CardHeader>
        <CardContent>
          {wellbeing.error ? (
            <p className="text-sm text-muted-foreground">Dati non disponibili</p>
          ) : !wellbeing.data || (Array.isArray(wellbeing.data) && wellbeing.data.length === 0) ? (
            <p className="text-sm text-muted-foreground">Nessun dato di benessere disponibile</p>
          ) : (
            <div className="space-y-3">
              {(Array.isArray(wellbeing.data) ? wellbeing.data : [wellbeing.data]).map(
                (w: any, i: number) => (
                  <div key={w.id || i} className="space-y-2">
                    {w.wellbeing_score != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Punteggio Benessere</span>
                        <span className="font-medium">
                          {parseFloat(w.wellbeing_score).toFixed(1)}/10
                        </span>
                      </div>
                    )}
                    {w.burnout_risk != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Rischio Burnout</span>
                        <Badge
                          variant={
                            w.burnout_risk === 'high' || w.burnout_risk === 'critical'
                              ? 'destructive'
                              : w.burnout_risk === 'medium'
                                ? 'outline'
                                : 'secondary'
                          }
                        >
                          {w.burnout_risk === 'high'
                            ? 'Alto'
                            : w.burnout_risk === 'critical'
                              ? 'Critico'
                              : w.burnout_risk === 'medium'
                                ? 'Medio'
                                : w.burnout_risk === 'low'
                                  ? 'Basso'
                                  : w.burnout_risk}
                        </Badge>
                      </div>
                    )}
                    {w.stress_level != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Livello Stress</span>
                        <span className="font-medium">
                          {parseFloat(w.stress_level).toFixed(1)}/10
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rischio Turnover */}
      <Card>
        <CardHeader>
          <CardTitle>Rischio Turnover</CardTitle>
        </CardHeader>
        <CardContent>
          {turnover.error ? (
            <p className="text-sm text-muted-foreground">Dati non disponibili</p>
          ) : !turnover.data || (Array.isArray(turnover.data) && turnover.data.length === 0) ? (
            <p className="text-sm text-muted-foreground">Nessuna previsione disponibile</p>
          ) : (
            <div className="space-y-3">
              {(Array.isArray(turnover.data) ? turnover.data : [turnover.data]).map(
                (t: any, i: number) => (
                  <div key={t.id || i} className="space-y-2">
                    {t.risk_score != null && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Punteggio Rischio</span>
                          <span className="font-medium">
                            {parseFloat(t.risk_score).toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={parseFloat(t.risk_score)} className="h-2" />
                      </div>
                    )}
                    {t.risk_level && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Livello</span>
                        <Badge
                          variant={
                            t.risk_level === 'high' || t.risk_level === 'critical'
                              ? 'destructive'
                              : t.risk_level === 'medium'
                                ? 'outline'
                                : 'secondary'
                          }
                        >
                          {t.risk_level === 'high'
                            ? 'Alto'
                            : t.risk_level === 'critical'
                              ? 'Critico'
                              : t.risk_level === 'medium'
                                ? 'Medio'
                                : t.risk_level === 'low'
                                  ? 'Basso'
                                  : t.risk_level}
                        </Badge>
                      </div>
                    )}
                    {t.prediction_type && (
                      <p className="text-xs text-muted-foreground">Tipo: {t.prediction_type}</p>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
