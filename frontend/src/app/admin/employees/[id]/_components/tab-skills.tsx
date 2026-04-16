'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api/client';

interface TabSkillsProps {
  employeeId: string;
}

export function TabSkills({ employeeId }: TabSkillsProps) {
  const [skills, setSkills] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [skillsRes, certsRes] = await Promise.allSettled([
          apiClient.get<any>(`/api/v1/employee-skill-profiles/${employeeId}`),
          apiClient.get<any>(`/api/v1/certifications/employee/${employeeId}`),
        ]);

        if (skillsRes.status === 'fulfilled') {
          const d = skillsRes.value.data;
          const items = Array.isArray(d) ? d : d?.skills || d?.items || [];
          setSkills(items);
        }

        if (certsRes.status === 'fulfilled') {
          const d = certsRes.value.data;
          const items = Array.isArray(d) ? d : d?.items || [];
          setCertifications(items);
        }

        if (skillsRes.status === 'rejected' && certsRes.status === 'rejected') {
          setError('Impossibile caricare competenze e certificazioni');
        }
      } catch {
        setError('Impossibile caricare i dati');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Competenze</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && skills.length === 0 && certifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Competenze</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Competenze</CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna competenza registrata</p>
          ) : (
            <div className="space-y-4">
              {skills.map((s: any, i: number) => {
                const score = Number(s.compositeScore ?? s.proficiency_level ?? s.level ?? 0);
                const name = s.skillNameIt || s.skillName || s.skill_name || s.name || 'Competenza';
                const group = s.skillGroup || s.skill_category;
                return (
                  <div key={s.id || i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{score.toFixed(1)}/5</span>
                    </div>
                    <Progress value={(score / 5) * 100} />
                    {group && <span className="text-xs text-muted-foreground">{group}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {certifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna certificazione registrata</p>
          ) : (
            <div className="space-y-3">
              {certifications.map((c: any, i: number) => {
                const issuer = c.issuer || c.issuing_organization;
                const expiry = c.expiryDate || c.expiry_date;
                return (
                  <div
                    key={c.id || i}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {c.name || c.certification_name || 'Certificazione'}
                      </p>
                      {issuer && <p className="text-xs text-muted-foreground">{issuer}</p>}
                      {expiry && (
                        <p className="text-xs text-muted-foreground">
                          Scadenza: {new Date(expiry).toLocaleDateString('it-IT')}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        c.status === 'active' || c.status === 'valid'
                          ? 'default'
                          : c.status === 'expired'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {c.status === 'active' || c.status === 'valid'
                        ? 'Valida'
                        : c.status === 'expired'
                          ? 'Scaduta'
                          : c.status || 'N/D'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
