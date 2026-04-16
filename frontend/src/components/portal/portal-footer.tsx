'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Circle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// PortalFooter — Fixed bottom footer for Employee Portal
// ============================================================================

export function PortalFooter() {
  const t = useTranslations('footer');

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'h-8 bg-card border-t border-border',
        'flex items-center justify-between px-4',
        'text-xs text-muted-foreground'
      )}
      role="contentinfo"
    >
      {/* Left: Status + Version */}
      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-default">
                <Circle
                  className="h-2 w-2 fill-success text-success animate-pulse"
                  aria-hidden="true"
                />
                <span>{t('operatingSystem')}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('allServicesActive')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <span className="hidden sm:inline text-muted-foreground/60">|</span>

        <span className="hidden sm:inline">v2.0.0</span>
      </div>

      {/* Center: Powered by + Copyright */}
      <div className="hidden md:flex items-baseline gap-1.5">
        <span className="text-[11px] text-muted-foreground/70">{t('poweredBy')}</span>
        <span className="text-[13px] font-bold" style={{ fontFamily: "'Exo 2', sans-serif" }}>
          <span className="text-primary">Heures</span>
          <span style={{ color: 'hsl(271 81% 56%)' }}>y</span>
          <span className="text-primary">s</span>
        </span>
        <span className="text-muted-foreground/60">|</span>
        <span className="text-[11px]">&copy; 2026 {t('allRightsReserved')}</span>
      </div>

      {/* Right: Support */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => window.open('mailto:support@heuresys.com', '_blank')}
        >
          <HelpCircle className="h-3 w-3 mr-1" aria-hidden="true" />
          {t('support')}
        </Button>
      </div>
    </footer>
  );
}
