'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Building2, RefreshCw, AlertCircle, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface TenantRow {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
  employee_count?: number;
  user_count?: number;
}

export default function TenantsPage() {
  const router = useRouter();
  const t = useTranslations('platform.tenants');
  const tCommon = useTranslations('common');
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.tenants.getTenants({ limit: 100 });
      const data = result as unknown;
      const list = Array.isArray(data) ? data : (data as Record<string, unknown>).items || data;
      setTenants(list as unknown as TenantRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento tenant');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const filtered = tenants.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase())
  );

  if (error && tenants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchTenants}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {tCommon('refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchTenants} title={tCommon('refresh')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </motion.div>

      <motion.div variants={staggerItem}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tCommon('searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.name')}</TableHead>
                    <TableHead>{t('fields.code')}</TableHead>
                    <TableHead>{t('fields.status')}</TableHead>
                    <TableHead>{t('fields.employees')}</TableHead>
                    <TableHead>{t('fields.users')}</TableHead>
                    <TableHead>{t('fields.createdAt')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/platform/tenants/${tenant.id}`)}
                    >
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {tenant.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tenant.status === 'active'
                              ? 'default'
                              : tenant.status === 'suspended'
                                ? 'destructive'
                                : tenant.status === 'pending'
                                  ? 'outline'
                                  : 'secondary'
                          }
                        >
                          {tenant.status === 'active'
                            ? tCommon('active')
                            : tenant.status === 'inactive'
                              ? tCommon('inactive')
                              : tenant.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{tenant.employee_count ?? '-'}</TableCell>
                      <TableCell className="tabular-nums">{tenant.user_count ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(tenant.created_at).toLocaleDateString('it-IT')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {tCommon('noResults')}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
