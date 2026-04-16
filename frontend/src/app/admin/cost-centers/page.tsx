'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CircleDollarSign,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { CostCenter } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

interface CostCentersState {
  costCenters: CostCenter[];
  loading: boolean;
  error: string | null;
}

const formatCurrency = (amount: number | null | undefined) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
};

export default function CostCentersPage() {
  const t = useTranslations('admin.costCenters');
  const [state, setState] = useState<CostCentersState>({
    costCenters: [],
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [types, setTypes] = useState<string[]>([]);

  const fetchCostCenters = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      const costType = typeFilter === 'all' ? undefined : typeFilter;

      const result = await api.costCenters.getCostCenters({
        is_active: isActive,
        cost_center_type: costType,
        search: searchInput || undefined,
        limit: 200,
      });

      setState({
        costCenters: result,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : t('loadError'),
      }));
    }
  }, [statusFilter, typeFilter, searchInput]);

  const fetchTypes = useCallback(async () => {
    try {
      const result = await api.costCenters.getCostCenterTypes();
      setTypes(result);
    } catch {
      // Ignore - types are optional
    }
  }, []);

  useEffect(() => {
    fetchCostCenters();
    fetchTypes();
  }, [fetchCostCenters, fetchTypes]);

  const filteredCostCenters = state.costCenters.filter((cc) => {
    if (!searchInput) return true;
    const search = searchInput.toLowerCase();
    return (
      cc.name.toLowerCase().includes(search) ||
      cc.code.toLowerCase().includes(search) ||
      cc.org_unit_name?.toLowerCase().includes(search)
    );
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare "${name}"?`)) return;
    try {
      await api.costCenters.deleteCostCenter(id);
      fetchCostCenters();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  };

  const totalBudget = state.costCenters.reduce((sum, cc) => sum + (cc.budget_annual_eur || 0), 0);

  if (state.loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="p-6">
        <ApiError message={state.error} onRetry={fetchCostCenters} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CircleDollarSign className="h-6 w-6" />
            Centri di Costo
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Link href="/admin/cost-centers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Centro
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <CircleDollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Totale Centri</p>
                  <p className="text-2xl font-bold">{state.costCenters.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Centri Attivi</p>
                  <p className="text-2xl font-bold">
                    {state.costCenters.filter((cc) => cc.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Budget Totale</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="{t('searchPlaceholder')}"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attivo</SelectItem>
                <SelectItem value="inactive">Inattivo</SelectItem>
              </SelectContent>
            </Select>
            {types.length > 0 && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tipi</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={fetchCostCenters}
              aria-label="Aggiorna centri costo"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Centri di Costo ({filteredCostCenters.length})</CardTitle>
          <CardDescription>Lista dei centri di costo aziendali</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unità Org.</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCostCenters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t('noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCostCenters.map((cc) => (
                    <TableRow key={cc.id}>
                      <TableCell className="font-mono text-sm">{cc.code}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/cost-centers/${cc.id}`}
                          className="font-medium hover:underline"
                        >
                          {cc.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {cc.cost_center_type && (
                          <Badge variant="outline">{cc.cost_center_type}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{cc.org_unit_name || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {cc.budget_annual_eur ? formatCurrency(cc.budget_annual_eur) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cc.is_active ? 'default' : 'secondary'}>
                          {cc.is_active ? 'Attivo' : 'Inattivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More options">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/cost-centers/${cc.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizza
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/cost-centers/${cc.id}/edit`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifica
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(cc.id, cc.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
