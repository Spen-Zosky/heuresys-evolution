'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, Search, RefreshCw, AlertCircle, Calendar, User, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface SkillProfile {
  id: string;
  employee: string;
  employee_name?: string;
  first_name?: string;
  last_name?: string;
  skills_count: number;
  total_skills?: number;
  last_update: string;
  updated_at?: string;
  overall_score?: number;
  completeness?: number;
  [key: string]: unknown;
}

function CompletenessBadge({ value }: { value: number | undefined }) {
  if (value === undefined || value === null) return <span>-</span>;
  const pct = Math.round(value);
  const color =
    pct >= 80
      ? 'bg-green-100 text-green-800'
      : pct >= 50
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800';
  return <Badge className={color}>{pct}%</Badge>;
}

export default function SkillProfilesPage() {
  const t = useTranslations('admin.talent.skillProfiles');
  const tCommon = useTranslations('common');
  const [profiles, setProfiles] = useState<SkillProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data: Array<{
          employee_id: string;
          first_name: string;
          last_name: string;
          full_name: string;
          job_title: string;
          skill_summary: {
            total_skills: number;
            verified_skills: number;
            pending_skills: number;
            avg_composite_score: number;
            last_updated: string;
          };
        }>;
      }>('/api/v1/talent/skill-profiles');
      const raw = response.data;
      let items: SkillProfile[];
      if (Array.isArray(raw)) {
        items = raw.map((p) => ({
          id: p.employee_id,
          employee: p.full_name || `${p.first_name} ${p.last_name}`,
          employee_name: p.full_name || `${p.first_name} ${p.last_name}`,
          first_name: p.first_name,
          last_name: p.last_name,
          skills_count: p.skill_summary?.total_skills ?? 0,
          total_skills: p.skill_summary?.total_skills ?? 0,
          last_update: p.skill_summary?.last_updated ?? '',
          overall_score: p.skill_summary?.avg_composite_score ?? 0,
          completeness:
            p.skill_summary?.total_skills > 0
              ? Math.round((p.skill_summary.verified_skills / p.skill_summary.total_skills) * 100)
              : 0,
        }));
      } else if (raw && typeof raw === 'object') {
        const arr =
          ((raw as Record<string, unknown>).items as typeof response.data) ||
          ((raw as Record<string, unknown>).profiles as typeof response.data) ||
          [];
        items = (Array.isArray(arr) ? arr : []).map((p) => ({
          id: p.employee_id,
          employee: p.full_name || `${p.first_name} ${p.last_name}`,
          employee_name: p.full_name || `${p.first_name} ${p.last_name}`,
          first_name: p.first_name,
          last_name: p.last_name,
          skills_count: p.skill_summary?.total_skills ?? 0,
          total_skills: p.skill_summary?.total_skills ?? 0,
          last_update: p.skill_summary?.last_updated ?? '',
          overall_score: p.skill_summary?.avg_composite_score ?? 0,
          completeness:
            p.skill_summary?.total_skills > 0
              ? Math.round((p.skill_summary.verified_skills / p.skill_summary.total_skills) * 100)
              : 0,
        }));
      } else {
        items = [];
      }
      setProfiles(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento profili competenze');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const empName =
      p.employee_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.employee || '';
    return empName.toLowerCase().includes(search.toLowerCase());
  });

  const avgSkills =
    profiles.length > 0
      ? Math.round(
          profiles.reduce((s, p) => s + (p.skills_count || p.total_skills || 0), 0) /
            profiles.length
        )
      : 0;

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Profili Competenze
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Panoramica delle competenze per dipendente
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Profili Totali</p>
            <p className="text-2xl font-bold">{profiles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Competenze Medie</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Sparkles className="h-5 w-5 text-primary" />
              {avgSkills}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Profili Completi (&gt;80%)</p>
            <p className="text-2xl font-bold text-green-600">
              {profiles.filter((p) => (p.completeness || 0) >= 80).length}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca dipendente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchData}
          aria-label="Aggiorna profili competenze"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Caricamento...</div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={fetchData}>
                  Riprova
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nessun profilo competenze trovato
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Competenze</TableHead>
                    <TableHead>Completezza</TableHead>
                    <TableHead>Ultimo Aggiornamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {p.employee_name ||
                            `${p.first_name || ''} ${p.last_name || ''}`.trim() ||
                            p.employee ||
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.skills_count || p.total_skills || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <CompletenessBadge value={p.completeness} />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {p.last_update || p.updated_at
                            ? new Date(p.last_update || p.updated_at!).toLocaleDateString('it-IT')
                            : '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
