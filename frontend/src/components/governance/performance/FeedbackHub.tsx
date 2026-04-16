'use client';

import { useState } from 'react';
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
import { MessageSquarePlus, ThumbsUp, Wrench, RefreshCw, Users } from 'lucide-react';
import { useContinuousFeedback } from '@/lib/hooks/use-governance-queries';
import type { FeedbackType } from '@/lib/api/endpoints/governance';

const FEEDBACK_TYPE_CONFIG: Record<
  FeedbackType,
  { label: string; icon: React.ElementType; color: string }
> = {
  praise: { label: 'Riconoscimento', icon: ThumbsUp, color: 'text-green-600' },
  constructive: { label: 'Costruttivo', icon: Wrench, color: 'text-amber-600' },
  developmental: { label: 'Sviluppo', icon: RefreshCw, color: 'text-blue-600' },
  '360': { label: '360°', icon: Users, color: 'text-purple-600' },
};

export function FeedbackHub() {
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading } = useContinuousFeedback(
    typeFilter !== 'all' ? { feedback_type: typeFilter as FeedbackType } : undefined
  );

  const feedbacks = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground mr-auto">{feedbacks.length} feedback</p>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Tipo feedback" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {(Object.keys(FEEDBACK_TYPE_CONFIG) as FeedbackType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {FEEDBACK_TYPE_CONFIG[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 gap-1.5">
          <MessageSquarePlus className="h-4 w-4" />
          Dai feedback
        </Button>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nessun feedback trovato
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb) => {
            const cfg = FEEDBACK_TYPE_CONFIG[fb.feedback_type] ?? FEEDBACK_TYPE_CONFIG.constructive;
            const FbIcon = cfg.icon;
            return (
              <div key={fb.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <FbIcon className={`h-4 w-4 ${cfg.color}`} />
                    <Badge variant="outline" className="text-xs">
                      {cfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(fb.created_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <p className="text-sm leading-relaxed line-clamp-3">{fb.content}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Da: {fb.is_anonymous ? 'Anonimo' : (fb.giver_name ?? '—')}</span>
                  <span>·</span>
                  <span>A: {fb.receiver_name ?? '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
