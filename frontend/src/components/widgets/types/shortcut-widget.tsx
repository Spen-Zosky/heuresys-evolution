'use client';

import { useLocale } from 'next-intl';
import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import {
  Zap,
  User,
  Gem,
  TrendingUp,
  Target,
  BookOpen,
  GitBranch,
  Bot,
  AlertCircle,
  Inbox,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ShortcutLink {
  label: string;
  labelEn?: string;
  icon: string;
  path: string;
}

interface ShortcutData {
  links: ShortcutLink[];
}

// ============================================
// Icon map
// ============================================

const iconMap: Record<string, LucideIcon> = {
  User,
  Gem,
  TrendingUp,
  Target,
  BookOpen,
  GitBranch,
  Bot,
  Zap,
};

function resolveIcon(name: string): LucideIcon {
  return iconMap[name] ?? Zap;
}

// ============================================
// Sub-components
// ============================================

function Skeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-8 w-24 animate-pulse rounded-[10px] bg-muted" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <Inbox size={28} className="text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground">Nessun collegamento rapido</span>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function ShortcutWidget({ code }: { code: string }) {
  const { data, loading, error, refetch } = useWidgetData<ShortcutData>(code);
  const locale = useLocale();

  const links = data?.links ?? [];
  const widgetTitle = locale === 'en' ? 'Quick Links' : 'Link Rapidi';

  return (
    <WidgetWrapper title={widgetTitle} icon={Zap}>
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

      {!loading && !error && links.length === 0 && <EmptyState />}

      {!loading && !error && links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const LinkIcon = resolveIcon(link.icon);
            return (
              <a
                key={link.path}
                href={link.path}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-primary/10 bg-primary/4 px-3 py-1.5 text-[12px] font-medium text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/10 hover:shadow-sm"
              >
                <LinkIcon size={13} />
                <span>{(locale === 'en' ? link.labelEn : link.label) || link.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}
