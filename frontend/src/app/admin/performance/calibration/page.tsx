'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Scale, Search, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
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

interface CalibrationSession {
  id: string;
  name: string;
  status: string;
  review_cycle: string;
  review_cycle_id?: string;
  scheduled_date: string;
  participant_count?: number;
  created_at?: string;
  [key: string]: unknown;
}

export default function CalibrationPage() {
  const t = useTranslations('admin.performance.calibration');
  const tCommon = useTranslations('common');
  const { getStatusConfig } = useStatusConfig('calibration');
  const [sessions, setSessions] = useState<CalibrationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data:
          | { items?: CalibrationSession[]; sessions?: CalibrationSession[] }
          | CalibrationSession[];
      }>('/api/v1/calibration-sessions');
      const raw = response.data;
      let items: CalibrationSession[];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items =
          ((raw as Record<string, unknown>).items as CalibrationSession[]) ||
          ((raw as Record<string, unknown>).sessions as CalibrationSession[]) ||
          [];
      } else {
        items = Array.isArray(response) ? (response as unknown as CalibrationSession[]) : [];
      }
      setSessions(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Errore nel caricamento sessioni di calibrazione'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = sessions.filter((s) => {
    const matchSearch =
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.review_cycle?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(sessions.map((s) => s.status).filter(Boolean))];

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
            <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Sessioni di Calibrazione
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestione sessioni di calibrazione performance
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale Sessioni</p>
            <p className="text-2xl font-bold">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">In Corso</p>
            <p className="text-2xl font-bold">
              {sessions.filter((s) => s.status === 'in_progress').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completate</p>
            <p className="text-2xl font-bold">
              {sessions.filter((s) => s.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pianificate</p>
            <p className="text-2xl font-bold">
              {sessions.filter((s) => s.status === 'scheduled').length}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca sessione..."
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
        <Button
          variant="outline"
          size="icon"
          onClick={fetchData}
          aria-label="Aggiorna calibrazione"
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
                Nessuna sessione di calibrazione trovata
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ciclo di Revisione</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Partecipanti</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.review_cycle || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusConfig(s.status).className}>
                          {getStatusConfig(s.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {s.scheduled_date
                            ? new Date(s.scheduled_date as string).toLocaleDateString('it-IT')
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>{s.participant_count ?? '-'}</TableCell>
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
