'use client';

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: 'critical' | 'warning' | 'info';
}

const config = {
  critical: {
    icon: AlertTriangle,
    className: 'bg-destructive text-destructive-foreground',
  },
  warning: {
    icon: AlertCircle,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  info: {
    icon: Info,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
} as const;

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const { icon: Icon, className } = config[severity];
  return (
    <Badge className={cn('gap-1', className)}>
      <span className="flex items-center">
        <Icon className="h-3 w-3" />
      </span>
      {severity}
    </Badge>
  );
}
