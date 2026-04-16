'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Target, Search, RefreshCw, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
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
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

interface OKR {
  id: string;
  objective: string;
  owner_id: string;
  owner_name?: string;
  overall_progress: number;
  status: string;
  period_end: string;
  key_results_count?: number;
  type?: string;
  [key: string]: unknown;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value || 0, 0), 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function OKRsPage() {
  const t = useTranslations('admin.performance.okrs');
  const tCommon = useTranslations('common');
  const { getStatusConfig } = useStatusConfig('okrs');
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: { items?: OKR[]; okrs?: OKR[] } | OKR[] }>(
        '/api/v1/okrs'
      );
      const raw = response.data;
      let items: OKR[];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items =
          ((raw as Record<string, unknown>).items as OKR[]) ||
          ((raw as Record<string, unknown>).okrs as OKR[]) ||
          [];
      } else {
        items = Array.isArray(response) ? (response as unknown as OKR[]) : [];
      }
      setOkrs(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento OKR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = okrs.filter((o) => {
    const matchSearch =
      !search ||
      o.objective?.toLowerCase().includes(search.toLowerCase()) ||
      o.owner_id?.toLowerCase().includes(search.toLowerCase()) ||
      o.owner_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(okrs.map((o) => o.status).filter(Boolean))];
  const avgProgress =
    okrs.length > 0
      ? Math.round(okrs.reduce((sum, o) => sum + (o.overall_progress || 0), 0) / okrs.length)
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
            <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            OKR - Objectives & Key Results
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestione obiettivi e risultati chiave
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale OKR</p>
            <p className="text-2xl font-bold">{okrs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Progresso Medio</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <TrendingUp className="h-5 w-5 text-primary" />
              {avgProgress}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">On Track</p>
            <p className="text-2xl font-bold text-green-600">
              {okrs.filter((o) => o.status === 'on_track').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">A Rischio</p>
            <p className="text-2xl font-bold text-yellow-600">
              {okrs.filter((o) => o.status === 'at_risk').length}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca OKR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtra per stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchData} aria-label="Aggiorna OKR">
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
              <div className="p-8 text-center text-muted-foreground">Nessun OKR trovato</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-48">Progresso</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Scadenza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.objective}</TableCell>
                      <TableCell>{o.owner_name || o.owner_id || '-'}</TableCell>
                      <TableCell>
                        <ProgressBar value={o.overall_progress} />
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusConfig(o.status).className}>
                          {getStatusConfig(o.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {o.period_end ? new Date(o.period_end).toLocaleDateString('it-IT') : '-'}
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
