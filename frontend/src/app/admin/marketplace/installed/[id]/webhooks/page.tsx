'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Play,
  MoreHorizontal,
  Loader2,
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import type {
  PluginInstallation,
  PluginWebhook,
  PluginWebhookDelivery,
  CreatePluginWebhookRequest,
  UpdatePluginWebhookRequest,
  WebhookDeliveryStatus,
} from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// CONSTANTS
// ============================================

const WEBHOOK_EVENTS = [
  'plugin.installed',
  'plugin.uninstalled',
  'plugin.enabled',
  'plugin.disabled',
  'plugin.updated',
  'plugin.configured',
];

// ============================================
// TYPES
// ============================================

interface WebhookWithDeliveries extends PluginWebhook {
  deliveries?: PluginWebhookDelivery[];
  deliveriesLoading?: boolean;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function WebhookManagementPage() {
  const t = useTranslations('admin.marketplace.webhooks');
  const tCommon = useTranslations('common');
  const params = useParams();
  const installationId = params.id as string;

  const [installation, setInstallation] = useState<PluginInstallation | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookWithDeliveries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<PluginWebhook | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PluginWebhook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Form state
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inst, webhooksData] = await Promise.all([
        api.marketplace.getInstallationById(installationId),
        api.marketplace.getWebhooks({ plugin_installation_id: installationId }),
      ]);
      setInstallation(inst);
      setWebhooks(webhooksData.webhooks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, [installationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle deliveries
  const toggleDeliveries = useCallback(
    async (webhookId: string) => {
      if (expandedWebhook === webhookId) {
        setExpandedWebhook(null);
        return;
      }

      setExpandedWebhook(webhookId);

      // Load deliveries
      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhookId ? { ...w, deliveriesLoading: true } : w))
      );

      try {
        const result = await api.marketplace.getWebhookDeliveries(webhookId, { limit: 10 });
        setWebhooks((prev) =>
          prev.map((w) =>
            w.id === webhookId
              ? { ...w, deliveries: result.deliveries, deliveriesLoading: false }
              : w
          )
        );
      } catch {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === webhookId ? { ...w, deliveriesLoading: false } : w))
        );
      }
    },
    [expandedWebhook]
  );

  // Open dialog for create
  const handleOpenCreate = () => {
    setEditingWebhook(null);
    setFormUrl('');
    setFormSecret('');
    setFormEvents([]);
    setFormEnabled(true);
    setShowDialog(true);
  };

  // Open dialog for edit
  const handleOpenEdit = (webhook: PluginWebhook) => {
    setEditingWebhook(webhook);
    setFormUrl(webhook.url);
    setFormSecret('');
    setFormEvents(webhook.events || []);
    setFormEnabled(webhook.is_active);
    setShowDialog(true);
  };

  // Save webhook
  const handleSave = useCallback(async () => {
    if (!formUrl) return;
    setSaving(true);
    try {
      if (editingWebhook) {
        const data: UpdatePluginWebhookRequest = {
          url: formUrl,
          events: formEvents,
          is_active: formEnabled,
        };
        await api.marketplace.updateWebhook(editingWebhook.id, data);
      } else {
        const data: CreatePluginWebhookRequest = {
          plugin_installation_id: installationId,
          url: formUrl,
          events: formEvents,
        };
        await api.marketplace.createWebhook(data);
      }
      setShowDialog(false);
      fetchData();
    } catch (err) {
      console.error('Save webhook failed:', err);
    } finally {
      setSaving(false);
    }
  }, [editingWebhook, formUrl, formEvents, formEnabled, installationId, fetchData]);

  // Delete webhook
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.marketplace.deleteWebhook(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      console.error('Delete webhook failed:', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchData]);

  // Test webhook
  const handleTest = useCallback(
    async (webhookId: string) => {
      setTesting(webhookId);
      try {
        await api.marketplace.testWebhook(webhookId);
        // Refresh deliveries
        toggleDeliveries(webhookId);
      } catch (err) {
        console.error('Test webhook failed:', err);
      } finally {
        setTesting(null);
      }
    },
    [toggleDeliveries]
  );

  // Toggle event
  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  // Toggle webhook active status directly
  const handleToggleActive = useCallback(
    async (webhook: PluginWebhook) => {
      try {
        await api.marketplace.updateWebhook(webhook.id, { is_active: !webhook.is_active });
        fetchData();
      } catch (err) {
        console.error('Toggle active failed:', err);
      }
    },
    [fetchData]
  );

  // Delivery status badge
  const getDeliveryBadge = (status: WebhookDeliveryStatus) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            OK
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Fallito
          </Badge>
        );
      case 'retrying':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Retry
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            In Attesa
          </Badge>
        );
    }
  };

  // Format date
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-6 w-[300px]" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error) {
    return <ApiError message={error} onRetry={fetchData} />;
  }

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
          <Link href="/admin/marketplace/installed">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna ai Plugin Installati
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
            {installation?.plugin_name && `Gestisci i webhook per ${installation.plugin_name}`}
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Webhook
        </Button>
      </motion.div>

      {/* Webhooks Table */}
      <motion.div variants={staggerItem}>
        {webhooks.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Webhook className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nessun webhook</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configura un webhook per ricevere notifiche sugli eventi del plugin
                </p>
                <Button className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Webhook
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{webhooks.length} webhook configurati</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Eventi</TableHead>
                    <TableHead>Attivo</TableHead>
                    <TableHead>Creato il</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <>
                      <TableRow key={webhook.id} className="group">
                        <TableCell className="max-w-[250px]">
                          <code className="text-xs truncate block">{webhook.url}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(webhook.events || []).slice(0, 2).map((evt) => (
                              <Badge key={evt} variant="outline" className="text-xs">
                                {evt}
                              </Badge>
                            ))}
                            {(webhook.events || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{webhook.events.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={() => handleToggleActive(webhook)}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(webhook.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Collapse"
                            className="h-8 w-8"
                            onClick={() => toggleDeliveries(webhook.id)}
                          >
                            {expandedWebhook === webhook.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
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
                              <DropdownMenuItem onClick={() => handleOpenEdit(webhook)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifica
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTest(webhook.id)}
                                disabled={testing === webhook.id}
                              >
                                {testing === webhook.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 mr-2" />
                                )}
                                Test
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
                      {/* Expanded deliveries */}
                      {expandedWebhook === webhook.id && (
                        <TableRow key={`${webhook.id}-deliveries`}>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            {webhook.deliveriesLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Caricamento consegne...
                              </div>
                            ) : !webhook.deliveries || webhook.deliveries.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Nessuna consegna recente
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Stato</TableHead>
                                    <TableHead>HTTP</TableHead>
                                    <TableHead>Durata</TableHead>
                                    <TableHead>Data</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {webhook.deliveries.map((del) => (
                                    <TableRow key={del.id}>
                                      <TableCell className="text-xs">{del.event_type}</TableCell>
                                      <TableCell>{getDeliveryBadge(del.status)}</TableCell>
                                      <TableCell>
                                        {del.response_status ? (
                                          <Badge
                                            variant={
                                              del.response_status < 400 ? 'default' : 'destructive'
                                            }
                                            className="text-xs"
                                          >
                                            {del.response_status}
                                          </Badge>
                                        ) : (
                                          '-'
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {del.duration_ms ? `${del.duration_ms}ms` : '-'}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {formatDate(del.created_at)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Modifica Webhook' : 'Aggiungi Webhook'}</DialogTitle>
            <DialogDescription>
              {editingWebhook
                ? 'Modifica la configurazione del webhook'
                : 'Configura un nuovo endpoint webhook'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL *</label>
              <Input
                placeholder="https://example.com/webhook"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            {!editingWebhook && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Secret (opzionale)</label>
                <Input
                  type="password"
                  placeholder="Secret per la firma HMAC"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Usato per firmare il payload con HMAC-SHA256
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Eventi</label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={formEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
            {editingWebhook && (
              <div className="flex items-center gap-2">
                <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
                <label className="text-sm">Webhook attivo</label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving || !formUrl}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : editingWebhook ? (
                <Edit className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {editingWebhook ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Webhook</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questo webhook? Anche la cronologia delle consegne verra
              rimossa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
