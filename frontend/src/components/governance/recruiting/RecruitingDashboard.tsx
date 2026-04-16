'use client';

import { Briefcase, Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useRecruitingDashboardStats,
  useCandidateStats,
  useRequisitionStats,
} from '@/lib/hooks/use-governance-queries';
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

const STAGE_LABELS: Record<string, string> = {
  new: 'Nuovi',
  screening: 'Screening',
  interview: 'Colloquio',
  offer: 'Offerta',
  hired: 'Assunti',
  rejected: 'Rifiutati',
};

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  screening: 'bg-blue-100 text-blue-700',
  interview: 'bg-violet-100 text-violet-700',
  offer: 'bg-amber-100 text-amber-700',
  hired: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export function RecruitingDashboard() {
  const { data: dashStats, isLoading: dashLoading } = useRecruitingDashboardStats();
  const { data: candStats, isLoading: candLoading } = useCandidateStats();
  const { data: reqStats, isLoading: reqLoading } = useRequisitionStats();

  const isLoading = dashLoading || candLoading || reqLoading;

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
      </div>
    );
  }

  const urgentReqs = reqStats?.urgent ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Posizioni aperte"
          value={dashStats?.open_requisitions ?? 0}
          icon={Briefcase}
          description="Requisition attive"
          alert={urgentReqs > 0}
        />
        <StatCard
          title="Candidati in pipeline"
          value={dashStats?.candidates_in_pipeline ?? 0}
          icon={Users}
          description="Esclusi hired e rejected"
        />
        <StatCard title="Time to hire" value="—" icon={Clock} description="Dato non disponibile" />
        <StatCard
          title="Offer acceptance"
          value={`${dashStats?.offer_acceptance_rate ?? 0}%`}
          icon={CheckCircle}
          description="Offerte accettate / totali"
        />
      </div>

      {urgentReqs > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Requisition urgenti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              {urgentReqs} requisition con priorità urgente in attesa di copertura.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidati per stage</CardTitle>
        </CardHeader>
        <CardContent>
          {!candStats || candStats.by_stage.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun candidato presente.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {candStats.by_stage.map(({ stage, count }) => (
                <div
                  key={stage}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${STAGE_COLORS[stage] ?? 'bg-muted text-foreground'}`}
                >
                  <span>{STAGE_LABELS[stage] ?? stage}</span>
                  <Badge variant="secondary" className="ml-1 bg-white/60 text-current">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requisition per stato</CardTitle>
        </CardHeader>
        <CardContent>
          {!reqStats ? (
            <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Aperte</p>
                <p className="text-xl font-semibold text-green-600">{reqStats.open_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">In corso</p>
                <p className="text-xl font-semibold text-blue-600">{reqStats.in_progress}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Coperte</p>
                <p className="text-xl font-semibold">{reqStats.filled}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cancellate</p>
                <p className="text-xl font-semibold text-muted-foreground">{reqStats.cancelled}</p>
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
            <Link href="/company-pet/governance/recruiting/pipeline">Pipeline candidati</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/company-pet/governance/recruiting/requisitions">Requisition</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
