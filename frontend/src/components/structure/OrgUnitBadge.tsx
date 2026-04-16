'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const orgTypeStyles: Record<string, string> = {
  company: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  division: 'bg-purple-100 text-purple-800 border-purple-200',
  direction: 'bg-violet-100 text-violet-800 border-violet-200',
  department: 'bg-blue-100 text-blue-800 border-blue-200',
  office: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  unit: 'bg-amber-100 text-amber-800 border-amber-200',
  team: 'bg-green-100 text-green-800 border-green-200',
  group: 'bg-teal-100 text-teal-800 border-teal-200',
};

const orgTypeLabels: Record<string, string> = {
  company: 'Azienda',
  division: 'Divisione',
  direction: 'Direzione',
  department: 'Dipartimento',
  office: 'Ufficio',
  unit: 'Unità',
  team: 'Team',
  group: 'Gruppo',
};

interface OrgUnitBadgeProps {
  orgType: string;
}

export function OrgUnitBadge({ orgType }: OrgUnitBadgeProps) {
  const type = orgType?.toLowerCase() || '';
  return (
    <Badge variant="outline" className={cn(orgTypeStyles[type] || '')}>
      {orgTypeLabels[type] || orgType || '–'}
    </Badge>
  );
}
