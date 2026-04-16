'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const categoryStyles: Record<string, string> = {
  core: 'bg-blue-100 text-blue-800 border-blue-200',
  support: 'bg-amber-100 text-amber-800 border-amber-200',
  management: 'bg-purple-100 text-purple-800 border-purple-200',
};

const categoryLabels: Record<string, string> = {
  core: 'Core',
  support: 'Support',
  management: 'Management',
};

interface ProcessCategoryBadgeProps {
  category: string;
  className?: string;
}

export function ProcessCategoryBadge({ category, className }: ProcessCategoryBadgeProps) {
  const style = categoryStyles[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  const label = categoryLabels[category] || category;

  return (
    <Badge variant="outline" className={cn(style, className)}>
      {label}
    </Badge>
  );
}
