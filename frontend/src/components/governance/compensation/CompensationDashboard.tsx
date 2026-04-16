'use client';

import { DollarSign, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useCompAnalyticsSummary, useMeritCycleStats } from '@/lib/hooks/use-governance-queries';
import Link from 'next/link';

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  alert,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${alert ? 'text-amber-600' : ''}`}>{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={`rounded-md p-2 ${alert ? 'bg-amber-100' : 'bg-primary/10'}`}>
            <Icon className={`h-5 w-5 ${alert ? 'text-amber-600' : 'text-primary'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompensationDashboard() {
  const { data: summary, isLoading: summaryLoading } = useCompAnalyticsSummary();
  const { data: meritStats, isLoading: meritLoading } = useMeritCycleStats();

  const isLoading = summaryLoading || meritLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const compaRatio = summary?.avg_compa_ratio ?? 1;
  const equityScore = summary?.equity_score ?? 100;
  const budgetUsed = summary?.merit_budget_used_pct ?? 0;
  const outOfRange = (summary?.headcount_above_range ?? 0) + (summary?.headcount_below_range ?? 0);

  const compaAlert = compaRatio < 0.85 || compaRatio > 1.15;
  const equityAlert = equityScore < 80;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Compa-Ratio medio"
          value={compaRatio.toFixed(2)}
          icon={TrendingUp}
          description="Media ponderata aziendale"
          alert={compaAlert}
        />
        <StatCard
          title="Equity Score"
          value={`${equityScore}%`}
          icon={Users}
          description="Equità retributiva"
          alert={equityAlert}
        />
        <StatCard
          title="Merit budget usato"
          value={`${budgetUsed}%`}
          icon={DollarSign}
          description={`Cicli attivi: ${meritStats?.active ?? 0}`}
        />
        <StatCard
          title="Fuori banda"
          value={outOfRange}
          icon={AlertTriangle}
          description={`Sopra: ${summary?.headcount_above_range ?? 0} | Sotto: ${summary?.headcount_below_range ?? 0}`}
          alert={outOfRange > 0}
        />
      </div>

      {(compaAlert || equityAlert || outOfRange > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alert compensazione
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {compaAlert && (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  Compa-Ratio
                </Badge>
                Valore {compaRatio.toFixed(2)} fuori dall&apos;intervallo ottimale (0.85–1.15)
              </div>
            )}
            {equityAlert && (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  Equity
                </Badge>
                Score equità {equityScore}% sotto soglia accettabile (80%)
              </div>
            )}
            {outOfRange > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  Banda
                </Badge>
                {outOfRange} dipendenti fuori dalla banda salariale assegnata
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cicli merit</CardTitle>
        </CardHeader>
        <CardContent>
          {!meritStats ? (
            <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Totali</p>
                <p className="text-xl font-semibold">{meritStats.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Attivi</p>
                <p className="text-xl font-semibold text-green-600">{meritStats.active}</p>
              </div>
              <div>
                <p className="text-muted-foreground">In pianificazione</p>
                <p className="text-xl font-semibold text-blue-600">{meritStats.planning}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Completati</p>
                <p className="text-xl font-semibold">{meritStats.completed}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Azioni rapide</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/compensation/bands">Salary Band Editor</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/compensation/analytics">Analytics comp.</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
