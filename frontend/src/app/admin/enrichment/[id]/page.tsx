'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslations } from 'next-intl';
import { apiClient, api } from '@/lib/api';
import type {
  EnrichmentJob,
  EnrichmentCandidate,
  CommitJobResponse,
  RollbackJobResponse,
} from '@/lib/api/endpoints/enrichment';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  queued: 'bg-slate-100 text-slate-700',
  crawling: 'bg-blue-100 text-blue-800',
  extracting: 'bg-indigo-100 text-indigo-800',
  previewing: 'bg-amber-100 text-amber-800',
  committed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  rolled_back: 'bg-orange-100 text-orange-800',
  cached: 'bg-gray-100 text-gray-700',
};

export default function EnrichmentJobDetailPage() {
  const t = useTranslations('admin.enrichment.detail');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = params.id;

  const [job, setJob] = useState<EnrichmentJob | null>(null);
  const [candidates, setCandidates] = useState<EnrichmentCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommit, setLastCommit] = useState<CommitJobResponse | null>(null);
  const [lastRollback, setLastRollback] = useState<RollbackJobResponse | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await api.enrichment.getEnrichmentJob(jobId);
      setJob(j);
      // The upstream engine does not expose a public /candidates endpoint
      // yet; we read them from the DB via a tiny helper endpoint. For now
      // use the job detail + ask for the list via a secondary call.
      const resp = await apiClient.get<{ data: { candidates?: EnrichmentCandidate[] } }>(
        `/api/v1/enrichment/jobs/${jobId}`
      );
      // Candidates are returned by the engine's GET /jobs/:id when it embeds them.
      const c = (resp?.data as unknown as { candidates?: EnrichmentCandidate[] })?.candidates ?? [];
      setCandidates(c);
      setSelected(new Set(c.map((x) => x.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(candidates.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const handleCommit = async () => {
    if (!window.confirm(`Confermi l'applicazione di ${selected.size} candidati al record target?`))
      return;
    setActing(true);
    setError(null);
    try {
      const result = await api.enrichment.commitEnrichmentJob(jobId, {
        approved_candidate_ids: Array.from(selected),
      });
      setLastCommit(result);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit fallito');
    } finally {
      setActing(false);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Annullare tutte le scritture di questo job?')) return;
    setActing(true);
    setError(null);
    try {
      const result = await api.enrichment.rollbackEnrichmentJob(jobId);
      setLastRollback(result);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback fallito');
    } finally {
      setActing(false);
    }
  };

  if (loading && !job) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Caricamento job...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Indietro
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/admin/enrichment" className="hover:underline">
              ← Enrichment
            </Link>
            <span>/</span>
            <span className="font-mono">{jobId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Job {jobId.slice(0, 8)}
          </h1>
          {job && (
            <p className="text-sm text-muted-foreground mt-1">
              Target: <span className="font-mono">{job.target_table}</span>
              {' • '}
              Mode: <Badge variant="outline">{job.mode}</Badge>
              {' • '}
              <Badge className={STATUS_COLORS[job.status] ?? ''}>{job.status}</Badge>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>
      </div>

      {job?.error_details?.message && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 text-sm">
          <strong>Errore job:</strong> {job.error_details.message}
        </div>
      )}

      {lastCommit?.identityBlocked && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 text-sm flex gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">Commit bloccato — Identity verification</div>
            <div className="mt-1">{lastCommit.identityReason}</div>
          </div>
        </div>
      )}

      {lastCommit && !lastCommit.identityBlocked && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 text-sm flex gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <strong>Commit completato</strong>: {lastCommit.applied} applicati, {lastCommit.skipped}{' '}
            skip, {lastCommit.unmapped} unmapped, {lastCommit.alreadyCommitted} già committed.
          </div>
        </div>
      )}

      {lastRollback && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-900 text-sm flex gap-3">
          <RotateCcw className="h-5 w-5 shrink-0" />
          <div>
            <strong>Rollback</strong>: {lastRollback.reverted}/{lastRollback.totalWrites} scritture
            revertite, {lastRollback.errors} errori.
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Candidati ({candidates.length}) — {selected.size} selezionati
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={selectAll} disabled={!candidates.length}>
              Tutti
            </Button>
            <Button size="sm" variant="ghost" onClick={selectNone} disabled={!selected.size}>
              Nessuno
            </Button>
            <Button
              size="sm"
              onClick={handleCommit}
              disabled={acting || !selected.size || job?.status !== 'previewing'}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Applica {selected.size}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRollback}
              disabled={acting || job?.status !== 'committed'}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Rollback
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {candidates.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nessun candidato estratto per questo job. Attendi che lo stato raggiunga
              &quot;previewing&quot;.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Valore proposto</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Provider</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.field_name}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {typeof c.candidate_value === 'string'
                        ? c.candidate_value
                        : JSON.stringify(c.candidate_value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={Number(c.confidence) >= 0.85 ? 'default' : 'outline'}>
                        {Number(c.confidence).toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.llm_provider_code ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {lastCommit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dettaglio commit</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo</TableHead>
                  <TableHead>Applicato</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Precedente → Nuovo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastCommit.results.map((r) => (
                  <TableRow key={r.candidateId}>
                    <TableCell className="font-mono text-xs">{r.fieldName}</TableCell>
                    <TableCell>
                      {r.applied ? (
                        <Badge className="bg-emerald-100 text-emerald-800">sì</Badge>
                      ) : (
                        <Badge variant="outline">no</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                      {r.reason}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {String(r.previousValue ?? '—')} → {String(r.newValue ?? '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
