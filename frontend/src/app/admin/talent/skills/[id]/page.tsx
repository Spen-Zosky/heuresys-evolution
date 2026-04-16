'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Award, ArrowLeft, Calendar, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { Skill } from '@/lib/api/types';

export default function SkillDetailPage() {
  const t = useTranslations('admin.talent.skills');
  const tCommon = useTranslations('common');
  const params = useParams();
  const id = params.id as string;

  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkill = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.skills.getSkillById(id);
      setSkill(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento competenza');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSkill();
  }, [fetchSkill]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchSkill} />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="p-6">
        <ApiError message="Competenza non trovata" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/skills">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Award className="h-6 w-6" />
              {skill.name}
            </h1>
            <p className="text-muted-foreground">
              {skill.category || 'Competenza'}
              {skill.skill_type ? ` - ${skill.skill_type}` : ''}
            </p>
          </div>
        </div>
        <Badge variant={skill.is_active ? 'default' : 'secondary'}>
          {skill.is_active ? 'Attiva' : 'Inattiva'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dettagli</CardTitle>
              <CardDescription>Informazioni sulla competenza</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {skill.description ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Descrizione</p>
                  <p className="whitespace-pre-wrap">{skill.description}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Nessuna descrizione disponibile</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Categoria</p>
                  <p className="font-medium">{skill.category || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tipo</p>
                  <p className="font-medium">{skill.skill_type || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {skill.esco_uri && (
            <Card>
              <CardHeader>
                <CardTitle>Riferimento ESCO</CardTitle>
                <CardDescription>
                  Collegamento alla tassonomia europea delle competenze
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={skill.esco_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {skill.esco_uri}
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Creata</p>
                  <p>{new Date(skill.created_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Aggiornata</p>
                  <p>{new Date(skill.updated_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{skill.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
