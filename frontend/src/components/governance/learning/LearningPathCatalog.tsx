'use client';

import { useState } from 'react';
import { BookOpen, Clock, Star, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useLearningPaths } from '@/lib/hooks/use-governance-queries';
import type { LearningPath } from '@/lib/api/endpoints/governance';
import Link from 'next/link';

export function LearningPathCatalog() {
  const [search, setSearch] = useState('');
  const [skillArea, setSkillArea] = useState<string>('all');

  const { data, isLoading } = useLearningPaths({
    status: 'published',
    search: search || undefined,
    skill_area: skillArea !== 'all' ? skillArea : undefined,
    limit: 50,
  });

  const paths: LearningPath[] = data?.items ?? [];

  // Collect unique skill areas from results for filter dropdown
  const skillAreas = Array.from(
    new Set(paths.map((p) => p.skill_area).filter((a): a is string => Boolean(a)))
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Cerca learning path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={skillArea} onValueChange={setSkillArea}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Area skill" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le aree</SelectItem>
            {skillAreas.map((area) => (
              <SelectItem key={area} value={area}>
                {area}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!paths.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nessun learning path trovato.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <Link
              key={path.id}
              href={`/company-pet/governance/learning/paths/${path.id}`}
              className="group block"
            >
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
                      {path.title}
                    </CardTitle>
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  </div>
                  {path.skill_area && (
                    <Badge variant="secondary" className="w-fit text-xs">
                      {path.skill_area}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {path.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{path.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {path.duration_hours != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {path.duration_hours}h
                      </span>
                    )}
                    {path.enrollment_count != null && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {path.enrollment_count}
                      </span>
                    )}
                    {path.avg_rating != null && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {parseFloat(String(path.avg_rating)).toFixed(1)}
                      </span>
                    )}
                  </div>
                  {path.provider_name && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {path.provider_name}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
