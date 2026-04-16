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
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  Code2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Image,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Plugin,
  PluginCategory,
  PluginStatus,
  OffsetMeta,
  CreatePluginRequest,
} from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG: Record<
  PluginStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof CheckCircle2;
  }
> = {
  draft: { label: 'Bozza', variant: 'outline', icon: Edit },
  pending_review: { label: 'In Revisione', variant: 'secondary', icon: Clock },
  published: { label: 'Pubblicato', variant: 'default', icon: CheckCircle2 },
  suspended: { label: 'Sospeso', variant: 'destructive', icon: XCircle },
  deprecated: { label: 'Deprecato', variant: 'outline', icon: AlertCircle },
};

// ============================================
// TYPES
// ============================================

interface DeveloperState {
  plugins: Plugin[];
  meta: OffsetMeta | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function DeveloperPortalPage() {
  const t = useTranslations('admin.marketplace.developer');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<DeveloperState>({
    plugins: [],
    meta: null,
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categories, setCategories] = useState<PluginCategory[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plugin | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New plugin form
  const [newPlugin, setNewPlugin] = useState<CreatePluginRequest>({
    name: '',
    slug: '',
    short_description: '',
    description: '',
  });

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const result = await api.marketplace.getCategories();
      setCategories(result);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch plugins
  const fetchPlugins = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.marketplace.getMyPlugins({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });
      setState({
        plugins: result.plugins,
        meta: result.meta,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento plugin',
      }));
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  // Handle create
  const handleCreate = useCallback(async () => {
    if (!newPlugin.name || !newPlugin.slug) return;

    setCreating(true);
    try {
      await api.marketplace.createPlugin(newPlugin);
      setShowCreateDialog(false);
      setNewPlugin({ name: '', slug: '', short_description: '', description: '' });
      fetchPlugins();
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setCreating(false);
    }
  }, [newPlugin, fetchPlugins]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await api.marketplace.deletePlugin(deleteTarget.id);
      setDeleteTarget(null);
      fetchPlugins();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchPlugins]);

  // Handle submit for review
  const handleSubmitForReview = useCallback(
    async (plugin: Plugin) => {
      try {
        await api.marketplace.submitPluginForReview({
          plugin_id: plugin.id,
          version: plugin.latest_version || '1.0.0',
        });
        fetchPlugins();
      } catch (err) {
        console.error('Submit for review failed:', err);
      }
    },
    [fetchPlugins]
  );

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setNewPlugin((prev) => ({ ...prev, name, slug }));
  };

  // Filter by search
  const filteredPlugins = state.plugins.filter((p) => {
    if (!searchInput) return true;
    const search = searchInput.toLowerCase();
    return (
      p.name.toLowerCase().includes(search) ||
      (p.slug || '').toLowerCase().includes(search) ||
      (p.short_description || '').toLowerCase().includes(search)
    );
  });

  // Status badge
  const getStatusBadge = (status: PluginStatus) => {
    const config = STATUS_CONFIG[status] || {
      label: status,
      variant: 'outline' as const,
      icon: AlertCircle,
    };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
            <Code2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Portale Developer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestisci e pubblica i tuoi plugin</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Plugin
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
                    placeholder="Cerca i tuoi plugin..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="draft">Bozze</SelectItem>
                  <SelectItem value="pending_review">In Revisione</SelectItem>
                  <SelectItem value="published">Pubblicati</SelectItem>
                  <SelectItem value="suspended">Sospesi</SelectItem>
                  <SelectItem value="deprecated">Deprecati</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchPlugins}
                className="shrink-0"
                aria-label="Aggiorna plugin sviluppatore"
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
          <ApiError message={state.error} onRetry={fetchPlugins} />
        ) : filteredPlugins.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Code2 className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nessun plugin</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchInput
                    ? 'Nessun risultato per la ricerca corrente'
                    : 'Crea il tuo primo plugin per iniziare'}
                </p>
                {!searchInput && (
                  <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Plugin
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{filteredPlugins.length} plugin</CardTitle>
              <CardDescription>Gestisci i plugin del tuo tenant</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plugin</TableHead>
                      <TableHead>Versione</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Installazioni</TableHead>
                      <TableHead>Valutazione</TableHead>
                      <TableHead>Aggiornato</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlugins.map((plugin) => (
                      <TableRow key={plugin.id} className="group">
                        <TableCell>
                          <Link
                            href={`/admin/marketplace/${plugin.id}`}
                            className="flex items-center gap-3 hover:text-primary transition-colors"
                          >
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                              {plugin.icon_url ? (
                                <img
                                  src={plugin.icon_url}
                                  alt={plugin.name}
                                  className="h-9 w-9 rounded-lg object-cover"
                                />
                              ) : (
                                plugin.name[0].toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{plugin.name}</p>
                              {plugin.short_description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                  {plugin.short_description}
                                </p>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            v{plugin.latest_version || '1.0.0'}
                          </code>
                        </TableCell>
                        <TableCell>{getStatusBadge(plugin.status)}</TableCell>
                        <TableCell className="text-sm">
                          {(plugin.total_installations || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {Number(plugin.avg_rating) > 0
                            ? Number(plugin.avg_rating).toFixed(1)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(plugin.updated_at)}
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
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/marketplace/${plugin.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Dettagli
                                </Link>
                              </DropdownMenuItem>
                              {plugin.screenshot_urls && plugin.screenshot_urls.length > 0 && (
                                <DropdownMenuItem disabled>
                                  <Image className="h-4 w-4 mr-2" />
                                  {plugin.screenshot_urls.length} Screenshot
                                </DropdownMenuItem>
                              )}
                              {plugin.status === 'draft' && (
                                <DropdownMenuItem onClick={() => handleSubmitForReview(plugin)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Invia per Revisione
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {plugin.status === 'draft' && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(plugin)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Elimina
                                </DropdownMenuItem>
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

      {/* Create Plugin Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuovo Plugin</DialogTitle>
            <DialogDescription>
              Crea un nuovo plugin. Potrai modificarlo e aggiungere dettagli prima di inviarlo per
              la revisione.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                placeholder="Il Mio Plugin"
                value={newPlugin.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug *</label>
              <Input
                placeholder="il-mio-plugin"
                value={newPlugin.slug}
                onChange={(e) => setNewPlugin((prev) => ({ ...prev, slug: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Identificatore univoco, usato negli URL
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrizione breve</label>
              <Input
                placeholder="Una breve descrizione del plugin..."
                value={newPlugin.short_description || ''}
                onChange={(e) =>
                  setNewPlugin((prev) => ({ ...prev, short_description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select
                value={newPlugin.category_id || 'none'}
                onValueChange={(v) =>
                  setNewPlugin((prev) => ({ ...prev, category_id: v === 'none' ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrizione</label>
              <Textarea
                placeholder="Descrizione completa del plugin..."
                value={newPlugin.description || ''}
                onChange={(e) => setNewPlugin((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
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
              disabled={creating || !newPlugin.name || !newPlugin.slug}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crea Plugin
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
            <DialogTitle>Elimina Plugin</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare {deleteTarget?.name}? Questa azione e irreversibile e
              cancellera tutti i dati associati.
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
    </motion.div>
  );
}
