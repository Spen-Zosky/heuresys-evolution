'use client';

import { Sparkles, AlertCircle } from 'lucide-react';
import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';

interface PlaceholderData {
  placeholder?: boolean;
  code?: string;
  metadata?: {
    code: string;
    name: string;
    description: string | null;
    widget_type: string;
    data_source_type: string;
    icon: string | null;
    functional_area_code: string | null;
    perspective_code: string | null;
  } | null;
  message?: string;
}

interface GenericPlaceholderProps {
  code: string;
  title?: string;
}

/**
 * Fallback widget renderer for codes in widget_catalog that don't yet have
 * a dedicated frontend implementation. Pulls real metadata from the catalog
 * via /api/v1/workspace/widget/:code/data and renders a coherent "coming soon"
 * card — no hardcoded placeholder text (P9).
 *
 * This component lets widget-factory reach 100% coverage of widget_catalog
 * while dedicated components are progressively added.
 */
export default function GenericPlaceholder({ code, title }: GenericPlaceholderProps) {
  const { data, loading, error } = useWidgetData<PlaceholderData>(code);

  const metadata = data?.metadata;
  const displayTitle = title || metadata?.name || code;
  const description = metadata?.description;
  const widgetType = metadata?.widget_type;
  const areaCode = metadata?.functional_area_code;

  return (
    <WidgetWrapper title={displayTitle} icon={Sparkles}>
      <div className="flex flex-col h-full justify-center items-center text-center py-6 px-4 gap-3">
        {loading ? (
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        ) : error || !metadata ? (
          <>
            <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
            <div className="text-xs text-muted-foreground">
              {error || data?.message || 'Widget non disponibile'}
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <Sparkles className="h-10 w-10 text-primary/70" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="text-sm font-medium">{displayTitle}</div>
            {description && (
              <div className="text-xs text-muted-foreground line-clamp-2 max-w-[220px]">
                {description}
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 mt-1">
              {widgetType && (
                <span className="rounded-full bg-muted px-2 py-0.5">{widgetType}</span>
              )}
              {areaCode && <span className="rounded-full bg-muted px-2 py-0.5">{areaCode}</span>}
            </div>
            <div className="text-[10px] text-muted-foreground/60 italic mt-1">In arrivo</div>
          </>
        )}
      </div>
    </WidgetWrapper>
  );
}
