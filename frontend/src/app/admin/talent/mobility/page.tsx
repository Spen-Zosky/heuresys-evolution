'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRightLeft,
  Search,
  RefreshCw,
  AlertCircle,
  Calendar,
  User,
  Building2,
} from 'lucide-react';
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

interface MobilityRecord {
  id: string;
  employee: string;
  employee_name?: string;
  first_name?: string;
  last_name?: string;
  from_position?: string;
  to_position?: string;
  from_department?: string;
  to_org_unit?: string;
  type?: string;
  status: string;
  effective_date?: string;
  date?: string;
  reason?: string;
  [key: string]: unknown;
}

const typeColors: Record<string, string> = {
  lateral: 'bg-blue-100 text-blue-800',
  promotion: 'bg-green-100 text-green-800',
  transfer: 'bg-purple-100 text-purple-800',
  rotation: 'bg-cyan-100 text-cyan-800',
  demotion: 'bg-orange-100 text-orange-800',
};

export default function InternalMobilityPage() {
  const t = useTranslations('admin.talent.mobility');
  const tCommon = useTranslations('common');
  const { getStatusConfig } = useStatusConfig('mobility');
  const [records, setRecords] = useState<MobilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data: Array<{
          id: string;
          title: string;
          department: string;
          department_name: string;
          status: string;
          work_type: string;
          job_level: string;
          hiring_manager_name: string;
          posted_at: string;
          created_at: string;
          applications_count: number;
          location: string;
          team: string;
        }>;
      }>('/api/v1/internal-mobility/jobs');
      const raw = response.data;
      let rawRows: typeof response.data;
      if (Array.isArray(raw)) {
        rawRows = raw;
      } else if (raw && typeof raw === 'object') {
        rawRows =
          ((raw as Record<string, unknown>).items as typeof response.data) ||
          ((raw as Record<string, unknown>).records as typeof response.data) ||
          ((raw as Record<string, unknown>).jobs as typeof response.data) ||
          [];
      } else {
        rawRows = [];
      }
      const items: MobilityRecord[] = (Array.isArray(rawRows) ? rawRows : []).map((j) => ({
        id: j.id,
        employee: j.hiring_manager_name || '-',
        employee_name: j.hiring_manager_name,
        from_department: j.department_name || j.department,
        to_org_unit: j.location || j.team || '-',
        from_position: j.title,
        to_position: j.job_level || '-',
        type: j.work_type || 'lateral',
        status: j.status || 'draft',
        effective_date: j.posted_at || j.created_at,
      }));
      setRecords(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento mobilita interna');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = records.filter((r) => {
    const empName =
      r.employee_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.employee || '';
    const matchSearch =
      !search ||
      empName.toLowerCase().includes(search.toLowerCase()) ||
      r.from_department?.toLowerCase().includes(search.toLowerCase()) ||
      r.to_org_unit?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(records.map((r) => r.status).filter(Boolean))];

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
            <ArrowRightLeft className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Mobilita Interna
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestione trasferimenti, promozioni e rotazioni interne
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale Movimenti</p>
            <p className="text-2xl font-bold">{records.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">In Attesa</p>
            <p className="text-2xl font-bold text-yellow-600">
              {records.filter((r) => r.status === 'pending').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approvati</p>
            <p className="text-2xl font-bold text-green-600">
              {records.filter((r) => r.status === 'approved' || r.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Promozioni</p>
            <p className="text-2xl font-bold">
              {records.filter((r) => r.type === 'promotion').length}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca dipendente o dipartimento..."
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
        <Button variant="outline" size="icon" onClick={fetchData} aria-label="Aggiorna mobilità">
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
                Nessun movimento di mobilita trovato
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Da</TableHead>
                    <TableHead>A</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {r.employee_name ||
                            `${r.first_name || ''} ${r.last_name || ''}`.trim() ||
                            r.employee ||
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {r.from_department || r.from_position || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {r.to_org_unit || r.to_position || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {r.type ? (
                          <Badge className={typeColors[r.type] || 'bg-gray-100 text-gray-800'}>
                            {r.type}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusConfig(r.status).className}>
                          {getStatusConfig(r.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {r.effective_date || r.date
                            ? new Date(r.effective_date || r.date!).toLocaleDateString('it-IT')
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
