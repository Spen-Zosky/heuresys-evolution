'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileCheck, Search, RefreshCw, AlertCircle, Building2, Users } from 'lucide-react';
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

interface Certification {
  id: string;
  name: string;
  issuing_organization?: string;
  validity_months?: number;
  is_active?: boolean;
  holder_count?: number | string;
  [key: string]: unknown;
}

export default function CertificationsPage() {
  const t = useTranslations('admin.certifications');
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchCertifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ data: Certification[] } | Certification[]>(
        '/api/v1/certifications'
      );
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setCertifications(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertifications();
  }, [fetchCertifications]);

  const filtered = certifications.filter(
    (c) =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.issuing_organization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      {/* Filters */}
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
        <Button
          variant="outline"
          size="icon"
          onClick={fetchCertifications}
          aria-label="Aggiorna certificazioni"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">{t('loading')}</div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={fetchCertifications}>
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
                    <TableHead>{t('columns.issuer')}</TableHead>
                    <TableHead>Validità</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Titolari</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {c.issuing_organization || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.validity_months != null ? `${c.validity_months} mesi` : '-'}
                      </TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Inattivo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {c.holder_count ?? 0}
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
