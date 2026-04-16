'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Crown, Search, RefreshCw, AlertCircle, Users, ShieldCheck } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface SuccessionPlan {
  id: string;
  position: string;
  position_title?: string;
  incumbent: string;
  incumbent_name?: string;
  incumbents?: number;
  successors: number | string[];
  successors_count?: number;
  readiness: string;
  readiness_level?: string;
  risk_level?: string;
  status?: string;
  [key: string]: unknown;
}

const readinessColors: Record<string, string> = {
  ready_now: 'bg-green-100 text-green-800',
  ready_1_year: 'bg-blue-100 text-blue-800',
  ready_2_years: 'bg-yellow-100 text-yellow-800',
  developing: 'bg-orange-100 text-orange-800',
  not_ready: 'bg-red-100 text-red-800',
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
};

const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function SuccessionPlanningPage() {
  const t = useTranslations('admin.talent.succession');
  const tCommon = useTranslations('common');
  const [plans, setPlans] = useState<SuccessionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [readinessFilter, setReadinessFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data: Array<{
          id: string;
          role_name: string;
          department: string;
          current_incumbent_id: string;
          current_incumbent_name: string;
          criticality_level: string;
          succession_status: string;
          candidate_count: number;
          impact_if_vacant: string;
          time_to_fill_estimate: string;
        }>;
      }>('/api/v1/succession/critical-roles');
      const raw = response.data;
      let rawRows: typeof response.data;
      if (Array.isArray(raw)) {
        rawRows = raw;
      } else if (raw && typeof raw === 'object') {
        rawRows =
          ((raw as Record<string, unknown>).items as typeof response.data) ||
          ((raw as Record<string, unknown>).plans as typeof response.data) ||
          ((raw as Record<string, unknown>).critical_roles as typeof response.data) ||
          [];
      } else {
        rawRows = [];
      }
      const items: SuccessionPlan[] = (Array.isArray(rawRows) ? rawRows : []).map((r) => ({
        id: r.id,
        position: r.role_name,
        position_title: r.role_name,
        incumbent: r.current_incumbent_name || '-',
        incumbent_name: r.current_incumbent_name,
        successors: Number(r.candidate_count) || 0,
        successors_count: Number(r.candidate_count) || 0,
        readiness: r.succession_status || '',
        readiness_level: r.succession_status,
        risk_level:
          r.criticality_level === 'Critical' ? 'critical' : r.criticality_level?.toLowerCase(),
        status: r.succession_status,
      }));
      setPlans(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento piani di successione');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = plans.filter((p) => {
    const matchSearch =
      !search ||
      p.position?.toLowerCase().includes(search.toLowerCase()) ||
      p.position_title?.toLowerCase().includes(search.toLowerCase()) ||
      p.incumbent?.toLowerCase().includes(search.toLowerCase()) ||
      p.incumbent_name?.toLowerCase().includes(search.toLowerCase());
    const readiness = p.readiness || p.readiness_level || '';
    const matchReadiness = readinessFilter === 'all' || readiness === readinessFilter;
    return matchSearch && matchReadiness;
  });

  const readinessValues = [
    ...new Set(plans.map((p) => p.readiness || p.readiness_level).filter(Boolean)),
  ] as string[];
  const totalSuccessors = plans.reduce((sum, p) => {
    const count =
      typeof p.successors === 'number'
        ? p.successors
        : p.successors_count || (Array.isArray(p.successors) ? p.successors.length : 0);
    return sum + count;
  }, 0);

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
            <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Pianificazione Successione
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestione piani di successione per posizioni chiave
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Piani Attivi</p>
            <p className="text-2xl font-bold">{plans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Successori Totali</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Users className="h-5 w-5 text-primary" />
              {totalSuccessors}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pronti Ora</p>
            <p className="text-2xl font-bold text-green-600">
              {
                plans.filter(
                  (p) =>
                    (p.readiness || p.readiness_level) === 'ready_now' ||
                    (p.readiness || p.readiness_level) === 'high'
                ).length
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Alto Rischio</p>
            <p className="text-2xl font-bold text-red-600">
              {plans.filter((p) => p.risk_level === 'high' || p.risk_level === 'critical').length}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca posizione o incumbent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={readinessFilter} onValueChange={setReadinessFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtra per readiness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i livelli</SelectItem>
            {readinessValues.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">
                {r.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchData} aria-label="Aggiorna successione">
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
                Nessun piano di successione trovato
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Posizione</TableHead>
                    <TableHead>Incumbent</TableHead>
                    <TableHead>Successori</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Rischio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const readiness = p.readiness || p.readiness_level || '';
                    const successorCount =
                      typeof p.successors === 'number'
                        ? p.successors
                        : p.successors_count ||
                          (Array.isArray(p.successors) ? p.successors.length : 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.position_title || p.position}
                        </TableCell>
                        <TableCell>{p.incumbent_name || p.incumbent || '-'}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {successorCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={readinessColors[readiness] || 'bg-gray-100 text-gray-800'}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {readiness.replace(/_/g, ' ') || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.risk_level ? (
                            <Badge
                              className={riskColors[p.risk_level] || 'bg-gray-100 text-gray-800'}
                            >
                              {p.risk_level}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
