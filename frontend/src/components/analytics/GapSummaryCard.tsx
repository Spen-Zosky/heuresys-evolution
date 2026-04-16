'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Award, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import type { OrgUnitSkillGap } from '@/lib/hooks/use-org-queries';

interface GapSummaryCardProps {
  gaps: OrgUnitSkillGap[];
}

export function GapSummaryCard({ gaps }: GapSummaryCardProps) {
  const totalSkills = gaps.length;
  const coveredSkills = gaps.filter((g) => g.gapLevel === 0).length;
  const gapCount = totalSkills - coveredSkills;
  const coveragePercent = totalSkills > 0 ? Math.round((coveredSkills / totalSkills) * 100) : 100;
  const criticalGaps = gaps.filter((g) => g.isMandatory && g.gapLevel > 0).length;

  const kpis = [
    {
      label: 'Competenze richieste',
      value: totalSkills,
      icon: Award,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Coperte',
      value: coveredSkills,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Gap rilevati',
      value: gapCount,
      icon: AlertCircle,
      color: gapCount > 0 ? 'text-red-600' : 'text-green-600',
      bg: gapCount > 0 ? 'bg-red-50' : 'bg-green-50',
    },
    {
      label: 'Copertura',
      value: `${coveragePercent}%`,
      icon: TrendingUp,
      color:
        coveragePercent >= 70
          ? 'text-green-600'
          : coveragePercent >= 30
            ? 'text-yellow-600'
            : 'text-red-600',
      bg:
        coveragePercent >= 70
          ? 'bg-green-50'
          : coveragePercent >= 30
            ? 'bg-yellow-50'
            : 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {criticalGaps > 0 && (
        <p className="text-sm text-red-600 font-medium">
          {criticalGaps} competenz
          {criticalGaps === 1 ? 'a obbligatoria mancante' : 'e obbligatorie mancanti'}
        </p>
      )}
    </div>
  );
}
