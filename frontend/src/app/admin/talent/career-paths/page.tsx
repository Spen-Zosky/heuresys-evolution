'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Search, RefreshCw, AlertCircle, Building2, Layers } from 'lucide-react';
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

interface CareerPath {
  id: string;
  name: string;
  title?: string;
  levels: number | string;
  levels_count?: number;
  roles: string | string[];
  roles_count?: number;
  department: string;
  department_name?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}

export default function CareerPathsPage() {
  const t = useTranslations('admin.talent.careerPaths');
  const tCommon = useTranslations('common');
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        data:
          | { items?: CareerPath[]; paths?: CareerPath[]; career_paths?: CareerPath[] }
          | CareerPath[];
      }>('/api/v1/career-paths');
      const raw = response.data;
      let items: CareerPath[];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items =
          ((raw as Record<string, unknown>).items as CareerPath[]) ||
          ((raw as Record<string, unknown>).paths as CareerPath[]) ||
          ((raw as Record<string, unknown>).career_paths as CareerPath[]) ||
          [];
      } else {
        items = Array.isArray(response) ? (response as unknown as CareerPath[]) : [];
      }
      setPaths(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento percorsi di carriera');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = paths.filter((p) => {
    if (!search) return true;
    const name = p.name || p.title || '';
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.department?.toLowerCase().includes(search.toLowerCase()) ||
      p.department_name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const departments = [
    ...new Set(paths.map((p) => p.department_name || p.department).filter(Boolean)),
  ];

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
            <GitBranch className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Percorsi di Carriera
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Definizione e gestione dei percorsi di crescita professionale
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Totale Percorsi</p>
            <p className="text-2xl font-bold">{paths.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Dipartimenti</p>
            <p className="text-2xl font-bold">{departments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Livelli Medi</p>
            <p className="text-2xl font-bold">
              {paths.length > 0
                ? Math.round(
                    paths.reduce((s, p) => s + (Number(p.levels_count || p.levels) || 0), 0) /
                      paths.length
                  )
                : 0}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca percorso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchData}
          aria-label="Aggiorna percorsi carriera"
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
                Nessun percorso di carriera trovato
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Livelli</TableHead>
                    <TableHead>Ruoli</TableHead>
                    <TableHead>Dipartimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name || p.title}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3 text-muted-foreground" />
                          {p.levels_count || p.levels || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {Array.isArray(p.roles) ? (
                          p.roles.map((r, i) => (
                            <Badge key={i} variant="outline" className="mr-1 mb-1">
                              {r}
                            </Badge>
                          ))
                        ) : (
                          <span>{p.roles_count || p.roles || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {p.department_name || p.department || '-'}
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
