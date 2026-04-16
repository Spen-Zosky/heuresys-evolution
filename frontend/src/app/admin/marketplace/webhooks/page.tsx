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
  Webhook,
  MoreHorizontal,
  Trash2,
  Send,
  Loader2,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  PluginWebhook,
  PluginWebhookDelivery,
  PluginInstallation,
  OffsetMeta,
  CreatePluginWebhookRequest,
  WebhookDeliveryStatus,
} from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// CONSTANTS
// ============================================

const AVAILABLE_EVENTS = [
  'plugin.installed',
  'plugin.uninstalled',
  'plugin.enabled',
  'plugin.disabled',
  'plugin.updated',
  'employee.created',
  'employee.updated',
  'employee.terminated',
  'goal.created',
  'goal.completed',
  'review.submitted',
  'course.enrolled',
  'course.completed',
];

// TODO: add entity type 'webhook_deliveries' to /api/v1/config/statuses and convert to useStatusConfig
const DELIVERY_STATUS_CONFIG: Record<
  WebhookDeliveryStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'In attesa', variant: 'outline' },
  success: { label: 'Consegnato', variant: 'default' },
  failed: { label: 'Fallito', variant: 'destructive' },
  retrying: { label: 'Nuovo tentativo', variant: 'secondary' },
};

// ============================================
// TYPES
// ============================================

interface WebhooksState {
  webhooks: PluginWebhook[];
  meta: OffsetMeta | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function WebhooksPage() {
  const t = useTranslations('admin.marketplace.webhooks');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<WebhooksState>({
    webhooks: [],
    meta: null,
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [installations, setInstallations] = useState<PluginInstallation[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PluginWebhook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deliveriesWebhook, setDeliveriesWebhook] = useState<PluginWebhook | null>(null);
  const [deliveries, setDeliveries] = useState<PluginWebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Create form
  const [newWebhook, setNewWebhook] = useState<CreatePluginWebhookRequest>({
    plugin_installation_id: '',
    url: '',
    events: [],
    description: '',
  });

  // Fetch installations
  const fetchInstallations = useCallback(async () => {
    try {
      const result = await api.marketplace.getInstallations({ status: 'active', limit: 100 });
      setInstallations(result.installations);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch webhooks
  const fetchWebhooks = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.marketplace.getWebhooks({ limit: 100 });
      setState({
        webhooks: result.webhooks,
        meta: result.meta,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento webhooks',
      }));
    }
  }, []);

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  // Handle create
  const handleCreate = useCallback(async () => {
    if (!newWebhook.url || !newWebhook.plugin_installation_id || newWebhook.events.length === 0)
      return;

    setCreating(true);
    try {
      await api.marketplace.createWebhook(newWebhook);
      setShowCreateDialog(false);
      setNewWebhook({ plugin_installation_id: '', url: '', events: [], description: '' });
      fetchWebhooks();
    } catch (err) {
      console.error('Create webhook failed:', err);
    } finally {
      setCreating(false);
    }
  }, [newWebhook, fetchWebhooks]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await api.marketplace.deleteWebhook(deleteTarget.id);
      setDeleteTarget(null);
      fetchWebhooks();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchWebhooks]);

  // Handle toggle active
  const handleToggle = useCallback(
    async (webhook: PluginWebhook) => {
      try {
        await api.marketplace.updateWebhook(webhook.id, { is_active: !webhook.is_active });
        fetchWebhooks();
      } catch (err) {
        console.error('Toggle failed:', err);
      }
    },
    [fetchWebhooks]
  );

  // Handle test
  const handleTest = useCallback(async (webhookId: string) => {
    setTesting(webhookId);
    try {
      await api.marketplace.testWebhook(webhookId);
    } catch (err) {
      console.error('Test failed:', err);
    } finally {
      setTesting(null);
    }
  }, []);

  // Fetch deliveries
  const fetchDeliveries = useCallback(async (webhook: PluginWebhook) => {
    setDeliveriesWebhook(webhook);
    setDeliveriesLoading(true);
    try {
      const result = await api.marketplace.getWebhookDeliveries(webhook.id, { limit: 20 });
      setDeliveries(result.deliveries);
    } catch (err) {
      console.error('Fetch deliveries failed:', err);
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }, []);

  // Toggle event selection
  const toggleEvent = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  // Filter by search
  const filteredWebhooks = state.webhooks.filter((wh) => {
    if (!searchInput) return true;
    const search = searchInput.toLowerCase();
    return (
      wh.url.toLowerCase().includes(search) ||
      (wh.plugin_name || '').toLowerCase().includes(search) ||
      (wh.description || '').toLowerCase().includes(search)
    );
  });

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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
            <Webhook className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Webhooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura notifiche webhook per i plugin installati
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Webhook
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
                    placeholder="Cerca per URL, plugin, descrizione..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchWebhooks}
                className="shrink-0"
                aria-label="Aggiorna webhooks"
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
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : state.error ? (
          <ApiError message={state.error} onRetry={fetchWebhooks} />
        ) : filteredWebhooks.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Webhook className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nessun webhook</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchInput
                    ? 'Nessun risultato per la ricerca corrente'
                    : 'Configura un webhook per ricevere notifiche dagli eventi dei plugin'}
                </p>
                {!searchInput && (
                  <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Webhook
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{filteredWebhooks.length} webhook</CardTitle>
              <CardDescription>Endpoint per la ricezione di eventi dai plugin</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Plugin</TableHead>
                      <TableHead>Eventi</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Creato il</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWebhooks.map((webhook) => (
                      <TableRow key={webhook.id} className="group">
                        <TableCell>
                          <div className="max-w-[300px]">
                            <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                              {webhook.url}
                            </code>
                            {webhook.description && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {webhook.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{webhook.plugin_name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.slice(0, 2).map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event}
                              </Badge>
                            ))}
                            {webhook.events.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{webhook.events.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={webhook.is_active}
                              onCheckedChange={() => handleToggle(webhook)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {webhook.is_active ? 'Attivo' : 'Disattivo'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(webhook.created_at)}
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
                              <DropdownMenuItem onClick={() => handleTest(webhook.id)}>
                                <Send className="h-4 w-4 mr-2" />
                                {testing === webhook.id ? 'Invio...' : 'Test'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => fetchDeliveries(webhook)}>
                                <History className="h-4 w-4 mr-2" />
                                Storico Consegne
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(webhook)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Elimina
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

      {/* Create Webhook Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Nuovo Webhook</DialogTitle>
            <DialogDescription>
              Configura un endpoint per ricevere notifiche sugli eventi dei plugin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plugin *</label>
              <Select
                value={newWebhook.plugin_installation_id || 'none'}
                onValueChange={(v) =>
                  setNewWebhook((prev) => ({
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
              <label className="text-sm font-medium">URL Endpoint *</label>
              <Input
                placeholder="https://example.com/webhooks/heuresys"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook((prev) => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Eventi * ({newWebhook.events.length} selezionati)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                {AVAILABLE_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWebhook.events.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded border-muted-foreground/30"
                    />
                    <span className="text-xs">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrizione</label>
              <Textarea
                placeholder="Descrizione opzionale del webhook..."
                value={newWebhook.description || ''}
                onChange={(e) =>
                  setNewWebhook((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Annulla
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating ||
                !newWebhook.url ||
                !newWebhook.plugin_installation_id ||
                newWebhook.events.length === 0
              }
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crea Webhook
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Webhook</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare il webhook per {deleteTarget?.url}? Non riceverai piu
              notifiche per gli eventi configurati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries Dialog */}
      <Dialog
        open={!!deliveriesWebhook}
        onOpenChange={(open) => {
          if (!open) {
            setDeliveriesWebhook(null);
            setDeliveries([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Storico Consegne</DialogTitle>
            <DialogDescription>Ultime consegne per {deliveriesWebhook?.url}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {deliveriesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[80px]" />
                  </div>
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-center py-6">
                <History className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Nessuna consegna registrata</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stato</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead>Durata</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => {
                      const statusConfig = DELIVERY_STATUS_CONFIG[delivery.status];
                      return (
                        <TableRow key={delivery.id}>
                          <TableCell>
                            <Badge variant={statusConfig.variant} className="text-xs">
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <code>{delivery.event_type}</code>
                          </TableCell>
                          <TableCell className="text-xs">
                            {delivery.response_status ? (
                              <span
                                className={
                                  delivery.response_status < 400 ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                {delivery.response_status}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {delivery.duration_ms ? `${delivery.duration_ms}ms` : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(delivery.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeliveriesWebhook(null);
                setDeliveries([]);
              }}
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
