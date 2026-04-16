'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Circle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// Footer Component
// ============================================================================
interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const t = useTranslations('footer');

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'h-8 bg-card border-t border-border',
        'flex items-center justify-between px-4',
        'text-xs text-muted-foreground',
        className
      )}
      role="contentinfo"
    >
      {/* Left: Status */}
      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-default">
                <Circle className="h-2 w-2 fill-success text-success" aria-hidden="true" />
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

      {/* Center: Copyright (hidden on mobile) */}
      <div className="hidden md:block">
        <span>
          &copy; {currentYear} Heuresys. {t('allRightsReserved')}
        </span>
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
