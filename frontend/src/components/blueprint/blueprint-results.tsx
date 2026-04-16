'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useBlueprintRun, useBlueprintResults } from '@/lib/hooks/use-blueprint-queries';
import { SeverityBadge } from './severity-badge';

interface BlueprintResultsProps {
  runId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SEVERITY_ALL = '__all__';
const TYPE_ALL = '__all__';

export function BlueprintResults({ runId }: BlueprintResultsProps) {
  const router = useRouter();
  const { data: runDetail, isLoading: runLoading } = useBlueprintRun(runId);
  const [severityFilter, setSeverityFilter] = useState(SEVERITY_ALL);
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);

  const filters: Record<string, string> = {};
  if (severityFilter !== SEVERITY_ALL) filters.severity = severityFilter;
  if (typeFilter !== TYPE_ALL) filters.resultType = typeFilter;

  const { data: results, isLoading: resultsLoading } = useBlueprintResults(
    runId,
    Object.keys(filters).length > 0 ? filters : undefined
  );

  const resultTypes = useMemo(() => {
    if (!results) return [];
    const types = new Set(results.map((r) => r.resultType));
    return Array.from(types).sort();
  }, [results]);

  const severity = runDetail?.severitySummary || {};
  const run = runDetail?.run;

  if (runLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risultati Analisi"
        description={run ? `${run.runMode} — ${formatDate(run.createdAt)}` : undefined}
      >
        <Button variant="outline" onClick={() => router.push('/platform/blueprint')}>
          <span className="flex items-center">
            <ArrowLeft className="h-4 w-4 mr-2" />
          </span>
          Torna alla lista
        </Button>
      </PageHeader>

      {/* Run info badges */}
      {run && (
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="capitalize">
            {run.runMode}
          </Badge>
          <Badge
            className={cn(
              run.status === 'completed' && 'bg-emerald-100 text-emerald-800 border-emerald-200',
              run.status === 'failed' && 'bg-destructive text-destructive-foreground',
              run.status === 'running' && 'bg-amber-100 text-amber-800 border-amber-200'
            )}
          >
            {run.status}
          </Badge>
          {run.completedAt && (
            <Badge variant="secondary">Completato: {formatDate(run.completedAt)}</Badge>
          )}
        </div>
      )}

      {/* Severity summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 flex items-center gap-3">
            <span className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </span>
            <div>
              <p className="text-2xl font-bold text-red-800">{severity.critical ?? 0}</p>
              <p className="text-xs text-red-600">Critical</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 flex items-center gap-3">
            <span className="flex items-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </span>
            <div>
              <p className="text-2xl font-bold text-amber-800">{severity.warning ?? 0}</p>
              <p className="text-xs text-amber-600">Warning</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 flex items-center gap-3">
            <span className="flex items-center">
              <Info className="h-5 w-5 text-blue-600" />
            </span>
            <div>
              <p className="text-2xl font-bold text-blue-800">{severity.info ?? 0}</p>
              <p className="text-xs text-blue-600">Info</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEVERITY_ALL}>Tutte le severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TYPE_ALL}>Tutti i tipi</SelectItem>
            {resultTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results list */}
      {resultsLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!resultsLoading && (!results || results.length === 0) && (
        <EmptyState
          title="Nessun risultato"
          description={
            severityFilter !== SEVERITY_ALL || typeFilter !== TYPE_ALL
              ? 'Nessun risultato con i filtri selezionati.'
              : "L'analisi non ha prodotto risultati."
          }
          size="sm"
        />
      )}

      {!resultsLoading && results && results.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {results.map((result) => (
            <motion.div key={result.id} variants={staggerItem}>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {result.severity && (
                      <SeverityBadge
                        severity={result.severity as 'critical' | 'warning' | 'info'}
                      />
                    )}
                    <Badge variant="outline">{result.resultType}</Badge>
                  </div>
                  <h4 className="font-medium">{result.title}</h4>
                  {result.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {result.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
