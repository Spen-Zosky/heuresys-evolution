'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Key,
  MoreHorizontal,
  Copy,
  ShieldOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Clock,
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
import type {
  PluginApiKey,
  PluginInstallation,
  OffsetMeta,
  CreatePluginApiKeyRequest,
} from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface ApiKeysState {
  keys: PluginApiKey[];
  meta: OffsetMeta | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function ApiKeysPage() {
  const t = useTranslations('admin.marketplace.apiKeys');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<ApiKeysState>({
    keys: [],
    meta: null,
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [installations, setInstallations] = useState<PluginInstallation[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PluginApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Create form
  const [newKey, setNewKey] = useState<CreatePluginApiKeyRequest>({
    plugin_installation_id: '',
    name: '',
    scopes: [],
  });

  // Fetch installations for the select
  const fetchInstallations = useCallback(async () => {
    try {
      const result = await api.marketplace.getInstallations({ status: 'active', limit: 100 });
      setInstallations(result.installations);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch API keys
  const fetchKeys = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.marketplace.getApiKeys({ limit: 100 });
      setState({
        keys: result.api_keys,
        meta: result.meta,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento chiavi API',
      }));
    }
  }, []);

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Handle create
  const handleCreate = useCallback(async () => {
    if (!newKey.name || !newKey.plugin_installation_id) return;

    setCreating(true);
    try {
      const result = await api.marketplace.createApiKey(newKey);
      setNewKeyResult(result.key);
      setShowKey(true);
      setNewKey({ plugin_installation_id: '', name: '', scopes: [] });
      fetchKeys();
    } catch (err) {
      console.error('Create API key failed:', err);
    } finally {
      setCreating(false);
    }
  }, [newKey, fetchKeys]);

  // Handle revoke
  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return;

    setRevoking(true);
    try {
      await api.marketplace.revokeApiKey(revokeTarget.id);
      setRevokeTarget(null);
      fetchKeys();
    } catch (err) {
      console.error('Revoke failed:', err);
    } finally {
      setRevoking(false);
    }
  }, [revokeTarget, fetchKeys]);

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback
    });
  };

  // Filter by search
  const filteredKeys = state.keys.filter((key) => {
    if (!searchInput) return true;
    const search = searchInput.toLowerCase();
    return (
      key.name.toLowerCase().includes(search) ||
      (key.plugin_name || '').toLowerCase().includes(search) ||
      key.key_prefix.toLowerCase().includes(search)
    );
  });

  // Format date
  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string | undefined) => {
    if (!date) return 'Mai';
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            <Key className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Chiavi API
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestisci le chiavi API per i plugin installati
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuova Chiave
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
                    placeholder="Cerca per nome, plugin, prefisso..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchKeys}
                className="shrink-0"
                aria-label="Aggiorna chiavi API"
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
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : state.error ? (
          <ApiError message={state.error} onRetry={fetchKeys} />
        ) : filteredKeys.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Key className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nessuna chiave API</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchInput
                    ? 'Nessun risultato per la ricerca corrente'
                    : 'Crea una chiave API per integrare i plugin con servizi esterni'}
                </p>
                {!searchInput && (
                  <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuova Chiave
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {filteredKeys.length} chiav{filteredKeys.length === 1 ? 'e' : 'i'} API
              </CardTitle>
              <CardDescription>
                Le chiavi API permettono l&apos;accesso programmatico ai plugin
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Plugin</TableHead>
                      <TableHead>Prefisso</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Ultimo utilizzo</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead>Creata il</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeys.map((key) => (
                      <TableRow key={key.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{key.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{key.plugin_name || '-'}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {key.key_prefix}...
                          </code>
                        </TableCell>
                        <TableCell>
                          {key.is_active && !key.revoked_at ? (
                            <Badge variant="default" className="bg-green-500 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Attiva
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Revocata
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(key.last_used_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.expires_at ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(key.expires_at)}
                            </div>
                          ) : (
                            'Nessuna'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(key.created_at)}
                        </TableCell>
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
                              <DropdownMenuItem onClick={() => copyToClipboard(key.key_prefix)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copia Prefisso
                              </DropdownMenuItem>
                              {key.scopes.length > 0 && (
                                <DropdownMenuItem disabled>
                                  <Eye className="h-4 w-4 mr-2" />
                                  {key.scopes.length} scope
                                </DropdownMenuItem>
                              )}
                              {key.is_active && !key.revoked_at && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setRevokeTarget(key)}
                                  >
                                    <ShieldOff className="h-4 w-4 mr-2" />
                                    Revoca
                                  </DropdownMenuItem>
                                </>
                              )}
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

      {/* Create API Key Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setNewKeyResult(null);
            setShowKey(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{newKeyResult ? 'Chiave API Creata' : 'Nuova Chiave API'}</DialogTitle>
            <DialogDescription>
              {newKeyResult
                ? 'Copia la chiave ora. Non sara possibile visualizzarla di nuovo.'
                : 'Crea una nuova chiave API per un plugin installato.'}
            </DialogDescription>
          </DialogHeader>

          {newKeyResult ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Chiave API</label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    type={showKey ? 'text' : 'password'}
                    value={newKeyResult}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy"
                    onClick={() => copyToClipboard(newKeyResult)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-destructive">
                  Salva questa chiave in un luogo sicuro. Non sara possibile recuperarla.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  placeholder="es. Integrazione CRM"
                  value={newKey.name}
                  onChange={(e) => setNewKey((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Plugin *</label>
                <Select
                  value={newKey.plugin_installation_id || 'none'}
                  onValueChange={(v) =>
                    setNewKey((prev) => ({
                      ...prev,
                      plugin_installation_id: v === 'none' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona plugin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleziona...</SelectItem>
                    {installations.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.plugin_name || inst.plugin_slug || inst.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Scadenza</label>
                <Input
                  type="date"
                  value={newKey.expires_at ? newKey.expires_at.split('T')[0] : ''}
                  onChange={(e) =>
                    setNewKey((prev) => ({
                      ...prev,
                      expires_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : undefined,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Lascia vuoto per nessuna scadenza</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {newKeyResult ? (
              <Button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewKeyResult(null);
                  setShowKey(false);
                }}
              >
                Chiudi
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creating}
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newKey.name || !newKey.plugin_installation_id}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creazione...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea Chiave
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoca Chiave API</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler revocare la chiave &quot;{revokeTarget?.name}&quot;? I servizi che
              utilizzano questa chiave perderanno l&apos;accesso immediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoca...
                </>
              ) : (
                <>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Revoca
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
