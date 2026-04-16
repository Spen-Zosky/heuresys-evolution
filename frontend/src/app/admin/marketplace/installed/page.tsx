'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Store,
  ArrowLeft,
  Search,
  RefreshCw,
  Settings,
  Trash2,
  MoreHorizontal,
  Eye,
  Webhook,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Download,
  Power,
  PowerOff,
  ArrowUpCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { PluginInstallation, OffsetMeta, InstallationStatus } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface InstalledState {
  installations: PluginInstallation[];
  meta: OffsetMeta | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function InstalledPluginsPage() {
  const t = useTranslations('admin.marketplace.installed');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<InstalledState>({
    installations: [],
    meta: null,
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [uninstallTarget, setUninstallTarget] = useState<PluginInstallation | null>(null);
  const [uninstalling, setUninstalling] = useState(false);

  // Fetch installations
  const fetchInstallations = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.marketplace.getInstallations({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });
      setState({
        installations: result.installations,
        meta: result.meta,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento plugin installati',
      }));
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  // Handle uninstall
  const handleUninstall = useCallback(async () => {
    if (!uninstallTarget) return;

    setUninstalling(true);
    try {
      await api.marketplace.uninstallPlugin(uninstallTarget.id);
      setUninstallTarget(null);
      fetchInstallations();
    } catch (err) {
      console.error('Uninstall failed:', err);
    } finally {
      setUninstalling(false);
    }
  }, [uninstallTarget, fetchInstallations]);

  // Handle enable/disable
  const handleToggleStatus = useCallback(
    async (inst: PluginInstallation) => {
      try {
        if (inst.status === 'active') {
          await api.marketplace.disableInstallation(inst.id);
        } else if (inst.status === 'disabled') {
          await api.marketplace.enableInstallation(inst.id);
        }
        fetchInstallations();
      } catch (err) {
        console.error('Toggle status failed:', err);
      }
    },
    [fetchInstallations]
  );

  // Filter by search
  const filteredInstallations = state.installations.filter((inst) => {
    if (!searchInput) return true;
    const search = searchInput.toLowerCase();
    return (
      (inst.plugin_name || '').toLowerCase().includes(search) ||
      (inst.installed_version || '').toLowerCase().includes(search) ||
      (inst.publisher_name || '').toLowerCase().includes(search)
    );
  });

  // Status badge
  const getStatusBadge = (status: InstallationStatus) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Attivo
          </Badge>
        );
      case 'disabled':
        return (
          <Badge variant="secondary" className="gap-1">
            <PowerOff className="h-3 w-3" />
            Disabilitato
          </Badge>
        );
      case 'pending_update':
        return (
          <Badge variant="secondary" className="gap-1">
            <ArrowUpCircle className="h-3 w-3" />
            Aggiornamento
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Errore
          </Badge>
        );
      case 'uninstalling':
        return (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Disinstallazione
          </Badge>
        );
      case 'uninstalled':
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Disinstallato
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Check if update is available
  const hasUpdate = (inst: PluginInstallation) => {
    return inst.latest_version && inst.installed_version !== inst.latest_version;
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Back navigation */}
      <motion.div variants={staggerItem}>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/marketplace">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna al Marketplace
          </Link>
        </Button>
      </motion.div>

      {/* Page Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Download className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Plugin Installati
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestisci i plugin installati nel tuo tenant
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/marketplace">
            <Store className="h-4 w-4 mr-2" />
            Esplora Marketplace
          </Link>
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca plugin installati..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Attivi</SelectItem>
                  <SelectItem value="disabled">Disabilitati</SelectItem>
                  <SelectItem value="all">Tutti</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchInstallations}
                className="shrink-0"
                aria-label="Aggiorna plugin installati"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results */}
      <motion.div variants={staggerItem}>
        {state.loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : state.error ? (
          <ApiError message={state.error} onRetry={fetchInstallations} />
        ) : filteredInstallations.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Download className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nessun plugin installato</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchInput
                    ? 'Nessun risultato per la ricerca corrente'
                    : 'Esplora il marketplace per trovare plugin utili'}
                </p>
                {!searchInput && (
                  <Button asChild className="mt-4">
                    <Link href="/admin/marketplace">
                      <Store className="h-4 w-4 mr-2" />
                      Vai al Marketplace
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {filteredInstallations.length} plugin installat
                {filteredInstallations.length === 1 ? 'o' : 'i'}
              </CardTitle>
              <CardDescription>Gestisci configurazione e stato dei plugin</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plugin</TableHead>
                      <TableHead>Versione</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Installato da</TableHead>
                      <TableHead>Installato il</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInstallations.map((inst) => (
                      <TableRow key={inst.id} className="group">
                        <TableCell>
                          <Link
                            href={`/admin/marketplace/${inst.plugin_id}`}
                            className="flex items-center gap-3 hover:text-primary transition-colors"
                          >
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                              {inst.icon_url ? (
                                <img
                                  src={inst.icon_url}
                                  alt={inst.plugin_name || ''}
                                  className="h-9 w-9 rounded-lg object-cover"
                                />
                              ) : (
                                (inst.plugin_name || 'P')[0].toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{inst.plugin_name}</p>
                              {inst.short_description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                  {inst.short_description}
                                </p>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              v{inst.installed_version}
                            </code>
                            {hasUpdate(inst) && (
                              <Badge variant="outline" className="text-xs gap-1 text-blue-600">
                                <ArrowUpCircle className="h-3 w-3" />v{inst.latest_version}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(inst.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm">{inst.installed_by_name || '-'}</span>
                        </TableCell>
                        <TableCell>{formatDate(inst.installed_at)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="More options"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/marketplace/${inst.plugin_id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Dettagli
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <Settings className="h-4 w-4 mr-2" />
                                Configurazione
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/marketplace/installed/${inst.id}/webhooks`}>
                                  <Webhook className="h-4 w-4 mr-2" />
                                  Webhooks
                                </Link>
                              </DropdownMenuItem>
                              {inst.status === 'active' && (
                                <DropdownMenuItem onClick={() => handleToggleStatus(inst)}>
                                  <PowerOff className="h-4 w-4 mr-2" />
                                  Disabilita
                                </DropdownMenuItem>
                              )}
                              {inst.status === 'disabled' && (
                                <DropdownMenuItem onClick={() => handleToggleStatus(inst)}>
                                  <Power className="h-4 w-4 mr-2" />
                                  Abilita
                                </DropdownMenuItem>
                              )}
                              {hasUpdate(inst) && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      await api.marketplace.updateInstallationVersion(inst.id);
                                      fetchInstallations();
                                    } catch (err) {
                                      console.error('Update failed:', err);
                                    }
                                  }}
                                >
                                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                                  Aggiorna a v{inst.latest_version}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setUninstallTarget(inst)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Disinstalla
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Uninstall Confirmation Dialog */}
      <Dialog open={!!uninstallTarget} onOpenChange={(open) => !open && setUninstallTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disinstalla Plugin</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler disinstallare {uninstallTarget?.plugin_name}? Questa azione
              rimuovera il plugin e le sue configurazioni dal tenant.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUninstallTarget(null)}
              disabled={uninstalling}
            >
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleUninstall} disabled={uninstalling}>
              {uninstalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disinstallazione...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disinstalla
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
