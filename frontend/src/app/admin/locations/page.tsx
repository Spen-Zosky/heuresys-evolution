'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  MapPin,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  Building2,
  Users,
  Globe,
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
import type { Location } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface LocationsState {
  locations: Location[];
  loading: boolean;
  error: string | null;
}

export default function LocationsPage() {
  const t = useTranslations('admin.locations');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<LocationsState>({
    locations: [],
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [types, setTypes] = useState<string[]>([]);

  const fetchLocations = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      const locationType = typeFilter === 'all' ? undefined : typeFilter;

      const result = await api.locations.getLocations({
        is_active: isActive,
        location_type: locationType,
        search: searchInput || undefined,
        limit: 200,
      });

      setState({
        locations: result,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento sedi',
      }));
    }
  }, [statusFilter, typeFilter, searchInput]);

  const fetchTypes = useCallback(async () => {
    try {
      const result = await api.locations.getLocationTypes();
      setTypes(result);
    } catch {
      // Ignore - types are optional
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchTypes();
  }, [fetchLocations, fetchTypes]);

  const filteredLocations = state.locations.filter((loc) => {
    if (!searchInput) return true;
    const search = searchInput.toLowerCase();
    return (
      loc.name.toLowerCase().includes(search) ||
      loc.code.toLowerCase().includes(search) ||
      loc.city?.toLowerCase().includes(search)
    );
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare "${name}"?`)) return;
    try {
      await api.locations.deleteLocation(id);
      fetchLocations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  };

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
        <ApiError message={state.error} onRetry={fetchLocations} />
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
            <MapPin className="h-6 w-6" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Link href="/admin/locations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('newLocation')}
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
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('stats.total')}</p>
                  <p className="text-2xl font-bold">{state.locations.length}</p>
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
                  <p className="text-sm text-muted-foreground">{t('stats.active')}</p>
                  <p className="text-2xl font-bold">
                    {state.locations.filter((l) => l.is_active).length}
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
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('stats.totalCapacity')}</p>
                  <p className="text-2xl font-bold">
                    {state.locations.reduce((sum, l) => sum + (l.capacity_headcount || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tCommon('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tCommon('searchPlaceholder')}
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
              onClick={fetchLocations}
              aria-label="Aggiorna sedi"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('title')} ({filteredLocations.length})
          </CardTitle>
          <CardDescription>{t('listDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.code')}</TableHead>
                  <TableHead>{t('fields.name')}</TableHead>
                  <TableHead>{t('fields.type')}</TableHead>
                  <TableHead>{t('fields.city')}</TableHead>
                  <TableHead className="text-center">{t('fields.capacity')}</TableHead>
                  <TableHead>{t('fields.status')}</TableHead>
                  <TableHead className="text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {tCommon('noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-mono text-sm">{loc.code}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/locations/${loc.id}`}
                          className="font-medium hover:underline"
                        >
                          {loc.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {loc.location_type && <Badge variant="outline">{loc.location_type}</Badge>}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          {loc.city || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{loc.capacity_headcount || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={loc.is_active ? 'default' : 'secondary'}>
                          {loc.is_active ? 'Attivo' : 'Inattivo'}
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
                              <Link href={`/admin/locations/${loc.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                {tCommon('view')}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/locations/${loc.id}/edit`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {tCommon('edit')}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(loc.id, loc.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {tCommon('delete')}
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
