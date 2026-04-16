'use client';

import { CheckCircle, Circle, Clock, ExternalLink, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useLearningPathDetail } from '@/lib/hooks/use-governance-queries';

interface LearningPathDetailProps {
  pathId: string;
}

export function LearningPathDetail({ pathId }: LearningPathDetailProps) {
  const { data: path, isLoading, isError } = useLearningPathDetail(pathId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Card>
          <CardContent className="pt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !path) {
    return <p className="text-sm text-destructive">Impossibile caricare il learning path.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold leading-snug">{path.title}</h2>
          <Button size="sm">Iscriviti</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {path.skill_area && <Badge variant="secondary">{path.skill_area}</Badge>}
          {path.provider_name && (
            <span className="text-sm text-muted-foreground">{path.provider_name}</span>
          )}
          {path.duration_hours != null && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {path.duration_hours}h totali
            </span>
          )}
          {path.enrollment_count != null && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {path.enrollment_count} iscritti
            </span>
          )}
        </div>
        {path.description && <p className="text-sm text-muted-foreground">{path.description}</p>}
      </div>

      {/* Course sequence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Corsi in sequenza ({path.courses?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!path.courses?.length ? (
            <p className="text-sm text-muted-foreground">Nessun corso associato.</p>
          ) : (
            <ol className="space-y-3">
              {path.courses.map((course, idx) => {
                const completionRate =
                  course.completion_rate != null
                    ? parseFloat(String(course.completion_rate))
                    : null;
                return (
                  <li key={course.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                        {completionRate === 100 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      {idx < path.courses.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-3 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{course.course_title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {course.is_mandatory && (
                            <Badge variant="outline" className="text-xs">
                              Obbligatorio
                            </Badge>
                          )}
                          {course.duration_hours != null && (
                            <span className="text-xs text-muted-foreground">
                              {course.duration_hours}h
                            </span>
                          )}
                        </div>
                      </div>
                      {completionRate != null && completionRate > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress value={completionRate} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {Math.round(completionRate)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* ESCO Skills gained */}
      {path.esco_skills && path.esco_skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competenze ESCO acquisite</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {path.esco_skills.map((skill) => (
                <a
                  key={skill.id}
                  href={skill.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-accent transition-colors"
                >
                  {skill.title}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
