'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Play,
  CheckCircle2,
  Calendar,
  BarChart3,
  Users,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';

interface AnalysisSession {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'in_progress' | 'scheduled';
  type: string;
  findings: number;
  participants: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completata
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge
          variant="default"
          className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100"
        >
          <Play className="h-3 w-3 mr-1" />
          In Corso
        </Badge>
      );
    case 'scheduled':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pianificata
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SessionsPage() {
  const t = useTranslations('companyPet');
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: AnalysisSession[] }>(
        '/api/v1/analysis-sessions'
      );
      const items = response?.data;
      setSessions(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('sessions.title')} description={t('sessions.description')} />
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              <RefreshCw className="h-4 w-4 mr-2" /> Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completed = sessions.filter((s) => s.status === 'completed').length;
  const inProgress = sessions.filter((s) => s.status === 'in_progress').length;
  const totalFindings = sessions.reduce((sum, s) => sum + (s.findings || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('sessions.title')} description={t('sessions.description')}>
        <Button size="sm">
          <Play className="h-4 w-4 mr-2" />
          {t('sessions.newSession')}
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{completed}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('sessions.completedCount')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{inProgress}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('sessions.inProgress')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{totalFindings}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('sessions.totalFindings')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Tutte le Sessioni
          </CardTitle>
          {!loading && (
            <CardDescription>{sessions.length} sessioni di analisi registrate</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessuna sessione di analisi trovata.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground">{session.name}</span>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(session.date).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.participants} partecipanti
                      </span>
                      {session.type && (
                        <Badge variant="outline" className="text-xs">
                          {session.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-foreground">{session.findings ?? 0}</p>
                    <p className="text-xs text-muted-foreground">findings</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
