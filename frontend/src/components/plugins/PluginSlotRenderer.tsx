'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { PluginUISlot } from '@/lib/api/types';

interface PluginSlotRendererProps {
  slotName: string;
  className?: string;
}

/**
 * PluginSlotRenderer
 *
 * Renders UI extension slots registered by plugins.
 * Each slot is loaded and rendered as a sandboxed iframe
 * to isolate plugin code from the main application.
 * Returns null if no slots are available for the given name.
 */
export function PluginSlotRenderer({ slotName, className }: PluginSlotRendererProps) {
  const [slots, setSlots] = useState<PluginUISlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      try {
        const result = await api.marketplace.getPluginUISlots(slotName);
        if (!cancelled) {
          setSlots(result.filter((s) => s.enabled));
        }
      } catch {
        // Silently fail - plugin slots are optional
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [slotName]);

  if (loading) {
    return (
      <div className={className}>
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (slots.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {slots
        .sort((a, b) => a.priority - b.priority)
        .map((slot) => (
          <Card key={slot.id} className="overflow-hidden">
            <CardHeader className="py-2 px-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-normal text-muted-foreground">
                  {slot.plugin_name}
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  Plugin
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                src={slot.component_path}
                sandbox="allow-scripts allow-same-origin"
                title={`${slot.plugin_name} - ${slot.slot_name}`}
                className="w-full border-0"
                style={{ minHeight: '120px' }}
              />
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
