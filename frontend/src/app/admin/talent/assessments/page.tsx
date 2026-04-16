'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Search, RefreshCw, AlertCircle, Calendar, User } from 'lucide-react';
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

interface SkillAssessment {
  id: string;
  employee: string;
  employee_name?: string;
  first_name?: string;
  last_name?: string;
  skill: string;
  skill_name?: string;
  score: number;
  max_score?: number;
  date: string;
  assessment_date?: string;
  assessor: string;
  assessor_name?: string;
  status?: string;
  [key: string]: unknown;
}

function ScoreBadge({ score, max }: { score: number; max?: number }) {
  const maxVal = max || 5;
  const pct = (score / maxVal) * 100;
  const color =
    pct >= 80
      ? 'bg-green-100 text-green-800'
      : pct >= 60
        ? 'bg-blue-100 text-blue-800'
        : pct >= 40
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-red-100 text-red-800';
  return (
    <Badge className={color}>
      {score}/{maxVal}
    </Badge>
  );
}

export default function SkillAssessmentsPage() {
  const t = useTranslations('admin.talent.assessments');
  const tCommon = useTranslations('common');
  const [assessments, setAssessments] = useState<SkillAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data: { items?: SkillAssessment[]; assessments?: SkillAssessment[] } | SkillAssessment[];
      }>('/api/v1/skill-assessments');
      const raw = response.data;
      let items: SkillAssessment[];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items =
          ((raw as Record<string, unknown>).items as SkillAssessment[]) ||
          ((raw as Record<string, unknown>).assessments as SkillAssessment[]) ||
          [];
      } else {
        items = Array.isArray(response) ? (response as unknown as SkillAssessment[]) : [];
      }
      setAssessments(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Errore nel caricamento valutazioni competenze'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = assessments.filter((a) => {
    if (!search) return true;
    const empName =
      a.employee_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.employee || '';
    const skillName = a.skill_name || a.skill || '';
    return (
      empName.toLowerCase().includes(search.toLowerCase()) ||
      skillName.toLowerCase().includes(search.toLowerCase())
    );
  });

  const avgScore =
    assessments.length > 0
      ? (assessments.reduce((sum, a) => sum + (a.score || 0), 0) / assessments.length).toFixed(1)
      : '0';

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
            <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Valutazione Competenze
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Valutazioni delle competenze dei dipendenti
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale Valutazioni</p>
            <p className="text-2xl font-bold">{assessments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Punteggio Medio</p>
            <p className="text-2xl font-bold">{avgScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Competenze Valutate</p>
            <p className="text-2xl font-bold">
              {new Set(assessments.map((a) => a.skill_name || a.skill)).size}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per dipendente o competenza..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchData}
          aria-label="Aggiorna valutazioni talento"
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
                Nessuna valutazione trovata
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Competenza</TableHead>
                    <TableHead>Punteggio</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valutatore</TableHead>
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
                      <TableCell>{a.skill_name || a.skill || '-'}</TableCell>
                      <TableCell>
                        <ScoreBadge score={a.score} max={a.max_score} />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {a.date || a.assessment_date
                            ? new Date(a.date || a.assessment_date!).toLocaleDateString('it-IT')
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>{a.assessor_name || a.assessor || '-'}</TableCell>
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
