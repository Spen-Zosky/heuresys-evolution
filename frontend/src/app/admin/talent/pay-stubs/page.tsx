'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Search, RefreshCw, AlertCircle, Calendar, User, DollarSign } from 'lucide-react';
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
import { useStatusConfig } from '@/lib/hooks/use-entity-config';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface PayStub {
  id: string;
  employee: string;
  employee_name?: string;
  first_name?: string;
  last_name?: string;
  period: string;
  month?: string;
  year?: number;
  gross_amount?: number;
  net_amount?: number;
  amount: number;
  currency?: string;
  status: string;
  issue_date?: string;
  [key: string]: unknown;
}

function formatCurrency(amount: number | undefined, currency?: string): string {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount);
}

export default function PayStubsPage() {
  const t = useTranslations('admin.talent.payStubs');
  const tCommon = useTranslations('common');
  const { getStatusConfig } = useStatusConfig('pay_stubs');
  const [payStubs, setPayStubs] = useState<PayStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data: { items?: PayStub[]; pay_stubs?: PayStub[] } | PayStub[];
      }>('/api/v1/pay-stubs');
      const raw = response.data;
      let items: PayStub[];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items =
          ((raw as Record<string, unknown>).items as PayStub[]) ||
          ((raw as Record<string, unknown>).pay_stubs as PayStub[]) ||
          ((raw as Record<string, unknown>).payStubs as PayStub[]) ||
          [];
      } else {
        items = Array.isArray(response) ? (response as unknown as PayStub[]) : [];
      }
      setPayStubs(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento cedolini');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = payStubs.filter((p) => {
    const empName =
      p.employee_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.employee || '';
    const matchSearch =
      !search ||
      empName.toLowerCase().includes(search.toLowerCase()) ||
      p.period?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(payStubs.map((p) => p.status).filter(Boolean))];
  const totalAmount = payStubs.reduce((sum, p) => sum + (p.net_amount || p.amount || 0), 0);

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
            <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Cedolini
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestione cedolini e buste paga</p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale Cedolini</p>
            <p className="text-2xl font-bold">{payStubs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Importo Totale</p>
            <p className="text-xl font-bold flex items-center gap-1">
              <DollarSign className="h-5 w-5 text-primary" />
              {formatCurrency(totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pagati</p>
            <p className="text-2xl font-bold text-green-600">
              {payStubs.filter((p) => p.status === 'paid').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">In Elaborazione</p>
            <p className="text-2xl font-bold text-blue-600">
              {payStubs.filter((p) => p.status === 'processed' || p.status === 'pending').length}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per dipendente o periodo..."
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
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchData} aria-label="Aggiorna cedolini">
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
              <div className="p-8 text-center text-muted-foreground">Nessun cedolino trovato</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Importo Netto</TableHead>
                    <TableHead>Stato</TableHead>
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
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {p.period || (p.month && p.year ? `${p.month}/${p.year}` : '-')}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(p.net_amount || p.amount, p.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusConfig(p.status).className}>
                          {getStatusConfig(p.status).label}
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
