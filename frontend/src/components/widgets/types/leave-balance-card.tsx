'use client';

import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import { CalendarClock, AlertCircle, Inbox } from 'lucide-react';

interface LeaveLine {
  leave_type: string;
  balance: number;
  used_days: number;
  pending_days: number;
}

interface LeaveBalanceData {
  year: number | null;
  lines: LeaveLine[];
}

const TYPE_LABEL: Record<string, string> = {
  vacation: 'Ferie',
  sick: 'Malattia',
  personal: 'Permessi',
  maternity: 'Maternita',
  paternity: 'Paternita',
  bereavement: 'Lutto',
  unpaid: 'Non retribuiti',
};

function labelOf(code: string): string {
  return TYPE_LABEL[code] ?? code;
}

export default function LeaveBalanceCard({ code }: { code: string }) {
  const { data, loading, error } = useWidgetData<LeaveBalanceData>(code);
  const lines = data?.lines ?? [];

  const footer = data?.year ? <span>Anno {data.year}</span> : undefined;

  return (
    <WidgetWrapper title="Bilancio ferie e permessi" icon={CalendarClock} footer={footer}>
      {loading ? (
        <div className="space-y-2 py-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-4 text-xs text-muted-foreground">
          <Inbox className="h-5 w-5 opacity-60" />
          Nessun bilancio configurato
        </div>
      ) : (
        <ul className="divide-y divide-border/40 text-xs">
          {lines.slice(0, 5).map((line) => {
            const remaining =
              Number(line.balance) - Number(line.used_days) - Number(line.pending_days);
            return (
              <li key={line.leave_type} className="flex items-baseline justify-between py-1.5">
                <span className="text-foreground">{labelOf(line.leave_type)}</span>
                <span className="tabular-nums">
                  <span className="font-semibold">{remaining.toFixed(1)}</span>
                  <span className="text-muted-foreground/70">
                    {' '}
                    / {Number(line.balance).toFixed(0)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetWrapper>
  );
}
