'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Heart, Search, RefreshCw, AlertCircle } from 'lucide-react';
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
import { useTranslations } from 'next-intl';

interface Benefit {
  id: string;
  benefit_name: string;
  benefit_type: string;
  description: string;
  monthly_cost: string;
  is_active: boolean;
  created_at: string;
  [key: string]: unknown;
}

export default function BenefitsPage() {
  const t = useTranslations('admin.compensation.benefits');
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: Benefit[] | { items: Benefit[] } }>(
        '/api/v1/benefits'
      );
      const raw = response.data;
      const items = Array.isArray(raw) ? raw : ((raw as { items: Benefit[] })?.items ?? []);
      setBenefits(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = benefits.filter(
    (b) =>
      !search ||
      b.benefit_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.benefit_type?.toLowerCase().includes(search.toLowerCase())
  );

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      health: 'Salute',
      dental: 'Dentale',
      vision: 'Vista',
      life: 'Vita',
      retirement: 'Pensione',
      other: 'Altro',
    };
    return map[type] || type;
  };

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
            <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale Benefits</p>
            <p className="text-2xl font-bold">{benefits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Attivi</p>
            <p className="text-2xl font-bold text-green-600">
              {benefits.filter((b) => b.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Costo Medio</p>
            <p className="text-2xl font-bold">
              {benefits.length > 0
                ? `${Math.round(benefits.reduce((s, b) => s + parseFloat(b.monthly_cost || '0'), 0) / benefits.length)} EUR`
                : 'N/D'}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="{t('searchPlaceholder')}"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" aria-label="Refresh" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">{t('loading')}</div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={fetchData}>
                  Riprova
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t('noResults')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Costo Mensile</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.benefit_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabel(b.benefit_type)}</Badge>
                      </TableCell>
                      <TableCell>{parseFloat(b.monthly_cost || '0').toFixed(2)} EUR</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            b.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {b.is_active ? 'Attivo' : 'Inattivo'}
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
