'use client';

import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import { ClipboardList, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PendingItem {
  id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
}

interface PendingApprovalsData {
  total: number;
  items: PendingItem[];
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(
      new Date(start)
    );
    const e = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(
      new Date(end)
    );
    return s === e ? s : `${s} - ${e}`;
  } catch {
    return `${start}/${end}`;
  }
}

export default function PendingApprovalsCard({ code }: { code: string }) {
  const { data, loading, error } = useWidgetData<PendingApprovalsData>(code);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const footer = total > 0 ? <span>{total} richieste in attesa</span> : undefined;

  return (
    <WidgetWrapper title="Approvazioni in attesa" icon={ClipboardList} footer={footer}>
      {loading ? (
        <div className="space-y-2 py-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-1 py-4 text-xs text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-green-500/80" />
          Tutto approvato
        </div>
      ) : (
        <ul className="divide-y divide-border/40 text-xs">
          {items.slice(0, 4).map((item) => (
            <li key={item.id} className="flex items-center justify-between py-1.5">
              <div className="flex flex-col">
                <span className="font-medium">{item.employee_name}</span>
                <span className="text-muted-foreground/80">
                  {formatRange(item.start_date, item.end_date)}
                </span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {Number(item.days_requested).toFixed(1)}g
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetWrapper>
  );
}
