'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Database, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface MigrationTable {
  name: string;
  table_name?: string;
  status: string;
  rows_migrated?: number;
  rows_total?: number;
  progress?: number;
  last_sync?: string;
  errors?: number;
  [key: string]: unknown;
}

interface MigrationStatus {
  status: string;
  overall_progress?: number;
  tables?: MigrationTable[];
  items?: MigrationTable[];
  started_at?: string;
  completed_at?: string;
  total_tables?: number;
  migrated_tables?: number;
  [key: string]: unknown;
}

// TODO: add entity type 'sap_migration' to /api/v1/config/statuses and convert to useStatusConfig
const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-800',
  not_started: 'bg-gray-100 text-gray-800',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

export default function SapMigrationPage() {
  const t = useTranslations('admin.settings.sapMigration');
  const tCommon = useTranslations('common');
  const [migration, setMigration] = useState<MigrationStatus | null>(null);
  const [tables, setTables] = useState<MigrationTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: MigrationStatus } | MigrationStatus>(
        '/api/v1/sap-migration/status'
      );
      const raw = (response as { data: MigrationStatus }).data || response;
      setMigration(raw as MigrationStatus);
      const tableList = (raw as MigrationStatus).tables || (raw as MigrationStatus).items || [];
      setTables(Array.isArray(tableList) ? tableList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento stato migrazione SAP');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const overallProgress =
    migration?.overall_progress ||
    (tables.length > 0
      ? Math.round((tables.filter((t) => t.status === 'completed').length / tables.length) * 100)
      : 0);

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
            <Database className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Migrazione SAP
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stato della migrazione dati da SAP HR
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna Stato
        </Button>
      </motion.div>

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
      ) : (
        <>
          <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Stato Generale</p>
                <Badge
                  className={`mt-1 ${statusColors[migration?.status || ''] || 'bg-gray-100 text-gray-800'}`}
                >
                  {migration?.status?.replace(/_/g, ' ') || 'N/A'}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Progresso</p>
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold">{overallProgress}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Tabelle Totali</p>
                <p className="text-2xl font-bold">{migration?.total_tables || tables.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Migrate</p>
                <p className="text-2xl font-bold text-green-600">
                  {migration?.migrated_tables ||
                    tables.filter((t) => t.status === 'completed').length}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="p-0">
                {tables.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nessun dettaglio tabella disponibile
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tabella</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Righe Migrate</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Errori</TableHead>
                        <TableHead>Ultimo Sync</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.map((t, idx) => {
                        const tableName = t.table_name || t.name;
                        const progress =
                          t.progress ||
                          (t.rows_total
                            ? Math.round(((t.rows_migrated || 0) / t.rows_total) * 100)
                            : 0);
                        return (
                          <TableRow key={tableName || idx}>
                            <TableCell className="font-medium font-mono text-sm">
                              {tableName}
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1">
                                <StatusIcon status={t.status} />
                                <Badge
                                  className={statusColors[t.status] || 'bg-gray-100 text-gray-800'}
                                >
                                  {t.status?.replace(/_/g, ' ') || '-'}
                                </Badge>
                              </span>
                            </TableCell>
                            <TableCell>
                              {t.rows_migrated !== undefined
                                ? `${t.rows_migrated}/${t.rows_total || '?'}`
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 w-24">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-xs">{progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {t.errors ? (
                                <Badge className="bg-red-100 text-red-800">{t.errors}</Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.last_sync ? new Date(t.last_sync).toLocaleString('it-IT') : '-'}
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
        </>
      )}
    </motion.div>
  );
}
