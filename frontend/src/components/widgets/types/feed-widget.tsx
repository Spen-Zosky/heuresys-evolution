'use client';

import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import { Bell, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

// ============================================
// Types
// ============================================

interface FeedItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface FeedData {
  items: FeedItem[];
  unread: number;
}

// ============================================
// Helpers
// ============================================

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ora';
    if (mins < 60) return `${mins}m fa`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h fa`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}g fa`;
    return `${Math.floor(days / 7)}sett fa`;
  } catch {
    return '';
  }
}

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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <Inbox size={28} className="text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground">Nessuna notifica</span>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function FeedWidget({ code }: { code: string }) {
  const { data, loading, error, refetch } = useWidgetData<FeedData>(code);

  const footer = data ? (
    <>
      <span>{data.unread} non lette</span>
      <a href="/notifications" className="text-primary hover:underline">
        Vedi tutte &rarr;
      </a>
    </>
  ) : undefined;

  return (
    <WidgetWrapper title="Notifiche" icon={Bell} footer={footer}>
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

      {!loading && !error && (!data || data.items.length === 0) && <EmptyState />}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {data.items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-start gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted/50"
              style={{
                animation: `slideInLeft 0.3s ease-out ${idx * 0.06}s both`,
              }}
            >
              {/* Status dot */}
              <div className="mt-1.5 flex-shrink-0">
                <div
                  className={`h-2 w-2 rounded-full ${
                    item.is_read
                      ? 'bg-muted-foreground/30'
                      : 'bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]'
                  }`}
                />
              </div>

              {/* Text */}
              <span className="flex-1 text-[13px] leading-tight text-foreground">{item.title}</span>

              {/* Timestamp */}
              <span
                className="flex-shrink-0 text-[10px] text-muted-foreground"
                style={{ fontFamily: 'var(--font-jetbrains, JetBrains Mono, monospace)' }}
              >
                {relativeTime(item.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Inline keyframes for slide animation */}
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </WidgetWrapper>
  );
}
