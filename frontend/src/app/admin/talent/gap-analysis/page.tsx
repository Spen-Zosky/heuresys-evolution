'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Search, RefreshCw, AlertCircle, User, Briefcase } from 'lucide-react';
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

interface GapAnalysis {
  id: string;
  employee: string;
  employee_name?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  role_name?: string;
  target_role?: string;
  score: number;
  match_score?: number;
  gaps_count: number;
  gaps?: string[];
  strengths_count?: number;
  status?: string;
  [key: string]: unknown;
}

function MatchBadge({ score }: { score: number }) {
  const pct = Math.round(score);
  const color =
    pct >= 80
      ? 'bg-green-100 text-green-800'
      : pct >= 60
        ? 'bg-blue-100 text-blue-800'
        : pct >= 40
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-red-100 text-red-800';
  return <Badge className={color}>{pct}%</Badge>;
}

export default function GapAnalysisPage() {
  const t = useTranslations('admin.talent.gapAnalysis');
  const tCommon = useTranslations('common');
  const [analyses, setAnalyses] = useState<GapAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Gap analysis backend is on-demand (POST-based).
      // Fetch the talent skill-profiles list and derive a gap overview
      // showing employees with their skill completeness as a proxy for gap data.
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
          };
        }>;
      }>('/api/v1/talent/skill-profiles');
      const raw = response.data;
      const profiles = Array.isArray(raw) ? raw : [];
      const items: GapAnalysis[] = profiles.map((p) => {
        const total = p.skill_summary?.total_skills ?? 0;
        const verified = p.skill_summary?.verified_skills ?? 0;
        const pending = p.skill_summary?.pending_skills ?? 0;
        const avgScore = p.skill_summary?.avg_composite_score ?? 0;
        const matchPct = total > 0 ? Math.round((verified / total) * 100) : 0;
        return {
          id: p.employee_id,
          employee: p.full_name || `${p.first_name} ${p.last_name}`,
          employee_name: p.full_name || `${p.first_name} ${p.last_name}`,
          first_name: p.first_name,
          last_name: p.last_name,
          role: p.job_title || '-',
          role_name: p.job_title,
          score: avgScore,
          match_score: matchPct,
          gaps_count: pending,
          strengths_count: verified,
          status: matchPct >= 80 ? 'aligned' : matchPct >= 50 ? 'partial' : 'gap',
        };
      });
      setAnalyses(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento analisi gap');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = analyses.filter((a) => {
    if (!search) return true;
    const empName =
      a.employee_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.employee || '';
    const role = a.role_name || a.role || a.target_role || '';
    return (
      empName.toLowerCase().includes(search.toLowerCase()) ||
      role.toLowerCase().includes(search.toLowerCase())
    );
  });

  const avgScore =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((sum, a) => sum + (a.match_score || a.score || 0), 0) / analyses.length
        )
      : 0;
  const totalGaps = analyses.reduce((sum, a) => sum + (a.gaps_count || 0), 0);

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
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Analisi Gap Competenze
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analisi dei gap tra competenze attuali e richieste per ruolo
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Analisi Totali</p>
            <p className="text-2xl font-bold">{analyses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Match Medio</p>
            <p className="text-2xl font-bold">{avgScore}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Gap Totali</p>
            <p className="text-2xl font-bold text-orange-600">{totalGaps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Allineati (&gt;80%)</p>
            <p className="text-2xl font-bold text-green-600">
              {analyses.filter((a) => (a.match_score || a.score || 0) >= 80).length}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per dipendente o ruolo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} aria-label="Aggiorna analisi gap">
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
                Nessuna analisi gap trovata
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {a.employee_name ||
                            `${a.first_name || ''} ${a.last_name || ''}`.trim() ||
                            a.employee ||
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          {a.role_name || a.role || a.target_role || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <MatchBadge score={a.match_score || a.score || 0} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-orange-700">
                          {a.gaps_count ?? 0} gap
                        </Badge>
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
