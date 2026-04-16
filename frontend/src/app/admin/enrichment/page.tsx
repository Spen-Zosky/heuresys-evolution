'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Sparkles, RefreshCw, AlertCircle, ExternalLink, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type {
  EnrichmentJob,
  EnrichmentJobStatus,
  EnrichmentMetrics,
} from '@/lib/api/endpoints/enrichment';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

const statusBadgeColor: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  queued: 'bg-slate-100 text-slate-700',
  crawling: 'bg-blue-100 text-blue-800',
  extracting: 'bg-indigo-100 text-indigo-800',
  previewing: 'bg-amber-100 text-amber-800',
  committed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  rolled_back: 'bg-orange-100 text-orange-800',
  cached: 'bg-gray-100 text-gray-700',
  partial: 'bg-yellow-100 text-yellow-800',
};

const STATUS_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'allStatuses' },
  { value: 'previewing', labelKey: 'status.pending' },
  { value: 'committed', labelKey: 'status.completed' },
  { value: 'failed', labelKey: 'status.failed' },
  { value: 'running', labelKey: 'status.running' },
];

export default function EnrichmentJobsPage() {
  const t = useTranslations('admin.enrichment');
  const tCommon = useTranslations('common');
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [metrics, setMetrics] = useState<EnrichmentMetrics | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const [list, m] = await Promise.all([
        api.enrichment.listEnrichmentJobs(params),
        api.enrichment.getEnrichmentMetrics().catch(() => null),
      ]);
      setJobs(list);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento job');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const filtered = jobs.filter((j) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      j.id.toLowerCase().includes(s) ||
      j.target_record_id.toLowerCase().includes(s) ||
      j.target_table.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchJobs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </Button>
          <Link href="/admin/enrichment/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Nuovo job
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Input
            placeholder="Cerca per id job, tenant o tabella..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Job totali
              </div>
              <div className="text-2xl font-bold">{metrics.jobs.total}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {metrics.jobs.byStatus.previewing ?? 0} in preview
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Candidati</div>
              <div className="text-2xl font-bold">{metrics.candidates.total}</div>
              <div className="text-xs text-muted-foreground mt-1">
                confidence media {metrics.candidates.avgConfidence.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Scritture attive
              </div>
              <div className="text-2xl font-bold">{metrics.writes.activeWrites}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {metrics.writes.rolledBack} rollback
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                L2 cache hit
              </div>
              <div className="text-2xl font-bold">{metrics.acquisition.freshnessHits}</div>
              <div className="text-xs text-muted-foreground mt-1">
                su {metrics.acquisition.sourcesTotal} fetch
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Budget LLM
              </div>
              <div className="text-2xl font-bold">€{metrics.budget.usedEur.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                su €{metrics.budget.capEur.toFixed(2)} ({metrics.budget.percentUsed}%)
              </div>
              <div className="mt-2 h-1.5 w-full rounded bg-gray-200 overflow-hidden">
                <div
                  className={`h-full ${
                    metrics.budget.percentUsed >= 90
                      ? 'bg-red-500'
                      : metrics.budget.percentUsed >= 70
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${metrics.budget.percentUsed}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('jobId')}</TableHead>
                  <TableHead>{t('descriptor')}</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{t('startedAt')}</TableHead>
                  <TableHead className="text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      {tCommon('loading')}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      {tCommon('noResults')}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((job) => (
                  <motion.tr key={job.id} variants={staggerItem}>
                    <TableCell>
                      <div className="font-mono text-xs">{job.id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {job.target_record_id.slice(0, 12)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{job.target_table}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusBadgeColor[job.status] ?? 'bg-gray-100 text-gray-700'}
                      >
                        {statusLabel(job.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleString('it-IT')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/enrichment/${job.id}`}>
                        <Button size="sm" variant="ghost">
                          {t('viewDetail')} <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}

function statusLabel(s: EnrichmentJobStatus | string): string {
  switch (s) {
    case 'previewing':
      return 'Preview';
    case 'committed':
      return 'Applicato';
    case 'rolled_back':
      return 'Annullato';
    case 'crawling':
      return 'Crawl';
    case 'extracting':
      return 'Extract';
    case 'failed':
      return 'Errore';
    case 'cached':
      return 'Cache';
    default:
      return s;
  }
}
