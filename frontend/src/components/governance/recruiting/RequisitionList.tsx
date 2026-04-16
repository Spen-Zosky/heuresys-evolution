'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useRequisitions } from '@/lib/hooks/use-governance-queries';
import type { RequisitionStatus, RequisitionPriority } from '@/lib/api/endpoints/governance';

const STATUS_LABELS: Record<RequisitionStatus, string> = {
  draft: 'Bozza',
  open: 'Aperta',
  in_progress: 'In corso',
  filled: 'Coperta',
  cancelled: 'Cancellata',
};

const STATUS_VARIANT: Record<RequisitionStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  filled: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

const PRIORITY_LABELS: Record<RequisitionPriority, string> = {
  low: 'Bassa',
  normal: 'Normale',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_VARIANT: Record<RequisitionPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-slate-100 text-slate-600',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const PAGE_SIZE = 20;

export function RequisitionList() {
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'all'>('all');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useRequisitions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const total = data?.pagination?.total ?? 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Requisition</CardTitle>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as RequisitionStatus | 'all');
            setPage(0);
          }}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {(Object.keys(STATUS_LABELS) as RequisitionStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">Nessuna requisition trovata.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Posizione</th>
                  <th className="px-4 py-2 text-left font-medium">Hiring Manager</th>
                  <th className="px-4 py-2 text-left font-medium">Stato</th>
                  <th className="px-4 py-2 text-left font-medium">Priorità</th>
                  <th className="px-4 py-2 text-right font-medium">Candidati</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((req) => (
                  <tr key={req.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{req.title}</p>
                      {req.department_name && (
                        <p className="text-xs text-muted-foreground">{req.department_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {req.hiring_manager_name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANT[req.status]}`}
                      >
                        {STATUS_LABELS[req.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_VARIANT[req.priority]}`}
                      >
                        {PRIORITY_LABELS[req.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge variant="secondary">{req.candidates_count ?? 0}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(page > 0 || hasMore) && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} di {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Precedente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Successiva
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
