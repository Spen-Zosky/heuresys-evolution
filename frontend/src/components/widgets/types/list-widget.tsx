'use client';

import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import { CheckCircle2, FileText, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

// ============================================
// Types
// ============================================

interface TaskItem {
  id: string;
  title: string;
  status: string;
  due_date: string;
  priority: string;
}

interface DocumentItem {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
}

interface TaskListData {
  items: TaskItem[];
}

interface DocumentListData {
  items: DocumentItem[];
}

// ============================================
// Helpers
// ============================================

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function taskDotColor(status: string, priority: string): string {
  if (status === 'completed') return 'bg-muted-foreground/30';
  if (priority === 'urgent' || priority === 'high')
    return 'bg-purple-400 shadow-[0_0_6px_oklch(0.638_0.2_310/0.5)]';
  return 'bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]';
}

function docDotColor(created_at: string, document_type: string): string {
  const age = Date.now() - new Date(created_at).getTime();
  const days = age / 86400000;
  if (document_type === 'important')
    return 'bg-purple-400 shadow-[0_0_6px_oklch(0.638_0.2_310/0.5)]';
  if (days < 7) return 'bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]';
  return 'bg-muted-foreground/30';
}

// ============================================
// Config per code
// ============================================

const CONFIG = {
  my_tasks: {
    title: 'My Tasks',
    icon: CheckCircle2,
    emptyMessage: 'Nessun task assegnato',
    countLabel: (n: number) => `${n} task`,
    linkText: 'Vedi tutti',
    linkHref: '/tasks',
  },
  my_documents: {
    title: 'My Documents',
    icon: FileText,
    emptyMessage: 'Nessun documento',
    countLabel: (n: number) => `${n} documenti`,
    linkText: 'Vedi tutte',
    linkHref: '/documents',
  },
} as const;

// ============================================
// Sub-components
// ============================================

function Skeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-muted" />
          <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function ListWidget({ code }: { code: string }) {
  const cfg = code in CONFIG ? CONFIG[code as keyof typeof CONFIG] : CONFIG.my_tasks;
  const Icon = cfg.icon;

  const { data, loading, error, refetch } = useWidgetData<TaskListData | DocumentListData>(code);

  const items = data?.items ?? [];

  const footer = data ? (
    <>
      <span>{cfg.countLabel(items.length)}</span>
      <a href={cfg.linkHref} className="text-primary hover:underline">
        {cfg.linkText} &rarr;
      </a>
    </>
  ) : undefined;

  return (
    <WidgetWrapper title={cfg.title} icon={Icon} footer={footer}>
      {loading && <Skeleton />}

      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-4">
          <AlertCircle size={22} className="text-destructive" />
          <span className="text-xs text-destructive">{error}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
          >
            <RefreshCw size={12} /> Riprova
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <Inbox size={28} className="text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">{cfg.emptyMessage}</span>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => {
            const isTask = 'status' in item;
            const dotCls = isTask
              ? taskDotColor((item as TaskItem).status, (item as TaskItem).priority)
              : docDotColor(
                  (item as DocumentItem).created_at,
                  (item as DocumentItem).document_type
                );
            const completed = isTask && (item as TaskItem).status === 'completed';
            const dateStr = isTask
              ? formatDate((item as TaskItem).due_date)
              : formatDate((item as DocumentItem).created_at);

            return (
              <div
                key={item.id}
                className="flex items-start gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted/50"
              >
                <div className="mt-1.5 flex-shrink-0">
                  <div className={`h-2 w-2 rounded-full ${dotCls}`} />
                </div>
                <span
                  className={`flex-1 text-[13px] leading-tight ${
                    completed ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}
                >
                  {item.title}
                </span>
                <span
                  className="flex-shrink-0 text-[10px] text-muted-foreground"
                  style={{ fontFamily: 'var(--font-jetbrains, JetBrains Mono, monospace)' }}
                >
                  {dateStr}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}
