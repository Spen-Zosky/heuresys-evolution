'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillProfileCardProps {
  skillName: string;
  skillType?: string;
  proficiencyLevel: number;
  verified: boolean;
  escoLinked?: boolean;
}

const skillTypeBadgeStyles: Record<string, string> = {
  knowledge: 'bg-blue-100 text-blue-800 border-blue-200',
  skill: 'bg-green-100 text-green-800 border-green-200',
  competence: 'bg-purple-100 text-purple-800 border-purple-200',
  transversal: 'bg-amber-100 text-amber-800 border-amber-200',
};

const skillTypeLabels: Record<string, string> = {
  knowledge: 'Conoscenza',
  skill: 'Competenza',
  competence: 'Abilita',
  transversal: 'Trasversale',
};

export function SkillProfileCard({
  skillName,
  skillType,
  proficiencyLevel,
  verified,
  escoLinked,
}: SkillProfileCardProps) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-sm truncate">{skillName}</p>
              {verified && (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200 text-xs shrink-0"
                >
                  Verificata
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {skillType && (
                <Badge
                  variant="outline"
                  className={cn('text-xs', skillTypeBadgeStyles[skillType] || '')}
                >
                  {skillTypeLabels[skillType] || skillType}
                </Badge>
              )}
              {escoLinked && (
                <Badge variant="secondary" className="text-xs">
                  ESCO
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-4 w-4',
                  i < proficiencyLevel
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
