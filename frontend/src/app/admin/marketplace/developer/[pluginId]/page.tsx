'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  Star,
  Loader2,
  CheckCircle2,
  Clock,
  Edit,
  AlertCircle,
  XCircle,
  Link as LinkIcon,
  Image,
  X,
  ThumbsUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import type {
  Plugin,
  PluginVersion,
  PluginReview,
  ReviewSummary,
  PluginDependency,
  PluginCategory,
  PluginStatus,
  UpdatePluginRequest,
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
// PAGE COMPONENT
// ============================================

export default function PluginManagementPage() {
  const t = useTranslations('admin.marketplace.developer');
  const tCommon = useTranslations('common');
  const params = useParams();
  const pluginId = params.pluginId as string;

  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [versions, setVersions] = useState<PluginVersion[]>([]);
  const [reviews, setReviews] = useState<PluginReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [dependencies, setDependencies] = useState<PluginDependency[]>([]);
  const [categories, setCategories] = useState<PluginCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<UpdatePluginRequest>({});

  // Version dialog
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [newVersion, setNewVersion] = useState({ version: '', release_notes: '', changelog: '' });
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Dependency dialog
  const [showDepDialog, setShowDepDialog] = useState(false);
  const [depPluginId, setDepPluginId] = useState('');
  const [depOptional, setDepOptional] = useState(false);
  const [addingDep, setAddingDep] = useState(false);

  // Screenshot management
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [bannerUrl, setBannerUrl] = useState('');
  const [newScreenshotUrl, setNewScreenshotUrl] = useState('');
  const [savingScreenshots, setSavingScreenshots] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pluginData, versionsData, categoriesData] = await Promise.all([
        api.marketplace.getPluginById(pluginId),
        api.marketplace.getPluginVersions(pluginId),
        api.marketplace.getCategories(),
      ]);

      setPlugin(pluginData);
      setVersions(versionsData);
      setCategories(categoriesData);

      // Initialize edit form
      setEditForm({
        name: pluginData.name,
        slug: pluginData.slug,
        short_description: pluginData.short_description || '',
        description: pluginData.description || '',
        category_id: pluginData.category_id || undefined,
        icon_url: pluginData.icon_url || '',
        homepage_url: pluginData.homepage_url || '',
        repository_url: pluginData.repository_url || '',
        license: pluginData.license || 'proprietary',
        pricing_model: pluginData.pricing_model,
        price_cents: pluginData.price_cents,
        currency: pluginData.currency,
      });

      setScreenshotUrls(
        (pluginData as Plugin & { screenshot_urls?: string[] }).screenshot_urls || []
      );
      setBannerUrl((pluginData as Plugin & { banner_url?: string }).banner_url || '');

      // Load reviews and dependencies (non-blocking)
      api.marketplace
        .getPluginReviews(pluginId, { limit: 20 })
        .then((r) => {
          setReviews(r.reviews);
          setReviewSummary(r.summary);
        })
        .catch(() => {});

      api.marketplace
        .getPluginDependencies(pluginId)
        .then(setDependencies)
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento plugin');
    } finally {
      setLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save overview
  const handleSave = useCallback(async () => {
    if (!plugin) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await api.marketplace.updatePlugin(plugin.id, editForm);
      setPlugin(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [plugin, editForm]);

  // Submit for review
  const handleSubmitForReview = useCallback(async () => {
    if (!plugin) return;
    try {
      await api.marketplace.submitPluginForReview({
        plugin_id: plugin.id,
        version: plugin.latest_version || '1.0.0',
      });
      fetchData();
    } catch (err) {
      console.error('Submit failed:', err);
    }
  }, [plugin, fetchData]);

  // Create version
  const handleCreateVersion = useCallback(async () => {
    if (!plugin || !newVersion.version) return;
    setCreatingVersion(true);
    try {
      await api.marketplace.getPluginVersions(plugin.id); // refresh
      setShowVersionDialog(false);
      setNewVersion({ version: '', release_notes: '', changelog: '' });
      fetchData();
    } catch (err) {
      console.error('Create version failed:', err);
    } finally {
      setCreatingVersion(false);
    }
  }, [plugin, newVersion, fetchData]);

  // Save screenshots
  const handleSaveScreenshots = useCallback(async () => {
    if (!plugin) return;
    setSavingScreenshots(true);
    try {
      await api.marketplace.updatePlugin(plugin.id, {
        screenshot_urls: screenshotUrls,
        banner_url: bannerUrl || undefined,
      });
      setSavingScreenshots(false);
    } catch (err) {
      console.error('Save screenshots failed:', err);
      setSavingScreenshots(false);
    }
  }, [plugin, screenshotUrls, bannerUrl]);

  // Format date
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  // Render stars
  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= Math.round(rating)
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );

  // Status badge
  const getStatusBadge = (status: PluginStatus) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-6 w-[300px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error) {
    return <ApiError message={error} onRetry={fetchData} />;
  }

  if (!plugin) return null;

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
          <Link href="/admin/marketplace/developer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna al Portale Developer
          </Link>
        </Button>
      </motion.div>

      {/* Plugin Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {plugin.icon_url ? (
              <img
                src={plugin.icon_url}
                alt={plugin.name}
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              plugin.name[0].toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{plugin.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(plugin.status)}
              <span className="text-sm text-muted-foreground">di {plugin.publisher_name}</span>
            </div>
          </div>
        </div>
        {plugin.status === 'draft' && (
          <Button onClick={handleSubmitForReview}>
            <Send className="h-4 w-4 mr-2" />
            Invia per Revisione
          </Button>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={staggerItem}>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="versions">Versioni</TabsTrigger>
            <TabsTrigger value="reviews">Recensioni</TabsTrigger>
            <TabsTrigger value="dependencies">Dipendenze</TabsTrigger>
            <TabsTrigger value="screenshots">Screenshot</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Modifica Plugin</CardTitle>
                <CardDescription>Aggiorna le informazioni del plugin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome</label>
                    <Input
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoria</label>
                    <Select
                      value={editForm.category_id || 'none'}
                      onValueChange={(v) =>
                        setEditForm((prev) => ({
                          ...prev,
                          category_id: v === 'none' ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona" />
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
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrizione breve</label>
                  <Input
                    value={editForm.short_description || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, short_description: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrizione completa</label>
                  <Textarea
                    value={editForm.description || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={6}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL Icona</label>
                    <Input
                      value={editForm.icon_url || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, icon_url: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sito Web</label>
                    <Input
                      value={editForm.homepage_url || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, homepage_url: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Repository</label>
                    <Input
                      value={editForm.repository_url || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, repository_url: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : saveSuccess ? (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {saveSuccess ? 'Salvato' : 'Salva'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VERSIONS TAB */}
          <TabsContent value="versions" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Versioni</CardTitle>
                  <CardDescription>Cronologia delle versioni pubblicate</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowVersionDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova Versione
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {versions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nessuna versione pubblicata
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Versione</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Note di Rilascio</TableHead>
                        <TableHead>Pubblicata il</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.map((ver) => (
                        <TableRow key={ver.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-medium">v{ver.version}</code>
                              {ver.is_latest && (
                                <Badge variant="default" className="text-xs">
                                  Latest
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ver.status === 'published' ? 'default' : 'outline'}>
                              {ver.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                            {ver.release_notes || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ver.published_at ? formatDate(ver.published_at) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Recensioni ({reviewSummary?.total_reviews || 0})
                </CardTitle>
                {reviewSummary && (reviewSummary.total_reviews || 0) > 0 && (
                  <div className="mt-2 space-y-1">
                    {[
                      { stars: 5, count: reviewSummary.five_star },
                      { stars: 4, count: reviewSummary.four_star },
                      { stars: 3, count: reviewSummary.three_star },
                      { stars: 2, count: reviewSummary.two_star },
                      { stars: 1, count: reviewSummary.one_star },
                    ].map(({ stars, count }) => (
                      <div key={stars} className="flex items-center gap-2 text-xs">
                        <span className="w-6 text-right">{stars}</span>
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full"
                            style={{
                              width: `${(reviewSummary.total_reviews || 0) > 0 ? (count / reviewSummary.total_reviews) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="w-6 text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nessuna recensione
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {(review.reviewer_name || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {review.reviewer_name || 'Utente'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(review.created_at)}
                              </p>
                            </div>
                          </div>
                          {renderStars(review.rating)}
                        </div>
                        {review.title && <p className="text-sm font-medium mt-2">{review.title}</p>}
                        {review.review_text && (
                          <p className="text-sm text-muted-foreground mt-1">{review.review_text}</p>
                        )}
                        {review.helpful_count > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <ThumbsUp className="h-3 w-3" />
                            {review.helpful_count} utile
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEPENDENCIES TAB */}
          <TabsContent value="dependencies" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Dipendenze</CardTitle>
                  <CardDescription>Plugin richiesti come dipendenza</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowDepDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Dipendenza
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {dependencies.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nessuna dipendenza dichiarata
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plugin</TableHead>
                        <TableHead>Versione</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dependencies.map((dep) => (
                        <TableRow key={dep.id}>
                          <TableCell>
                            <Link
                              href={`/admin/marketplace/${dep.depends_on_slug || dep.depends_on_plugin_id}`}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              <LinkIcon className="h-4 w-4" />
                              {dep.depends_on_name || dep.depends_on_plugin_id}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {dep.min_version && dep.max_version
                              ? `${dep.min_version} - ${dep.max_version}`
                              : dep.min_version
                                ? `>= ${dep.min_version}`
                                : dep.max_version
                                  ? `<= ${dep.max_version}`
                                  : 'Qualsiasi'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={dep.is_optional ? 'outline' : 'secondary'}>
                              {dep.is_optional ? 'Opzionale' : 'Richiesta'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Action"
                              className="h-8 w-8"
                              onClick={async () => {
                                try {
                                  // Dependency deletion would go through a dedicated API
                                  setDependencies((prev) => prev.filter((d) => d.id !== dep.id));
                                } catch (err) {
                                  console.error('Delete dependency failed:', err);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SCREENSHOTS TAB */}
          <TabsContent value="screenshots" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Banner</CardTitle>
                <CardDescription>Immagine banner in evidenza</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="https://example.com/banner.png"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                />
                {bannerUrl && (
                  <div className="rounded-lg overflow-hidden border">
                    <img
                      src={bannerUrl}
                      alt="Banner preview"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Screenshot</CardTitle>
                <CardDescription>Aggiungi URL di screenshot del plugin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/screenshot.png"
                    value={newScreenshotUrl}
                    onChange={(e) => setNewScreenshotUrl(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (newScreenshotUrl.trim()) {
                        setScreenshotUrls((prev) => [...prev, newScreenshotUrl.trim()]);
                        setNewScreenshotUrl('');
                      }
                    }}
                    disabled={!newScreenshotUrl.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {screenshotUrls.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {screenshotUrls.map((url, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border">
                        <img
                          src={url}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full h-32 object-cover"
                        />
                        <button
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() =>
                            setScreenshotUrls((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSaveScreenshots} disabled={savingScreenshots}>
                    {savingScreenshots ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Image className="h-4 w-4 mr-2" />
                    )}
                    Salva Screenshot
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* New Version Dialog */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Versione</DialogTitle>
            <DialogDescription>Pubblica una nuova versione del plugin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Versione *</label>
              <Input
                placeholder="1.1.0"
                value={newVersion.version}
                onChange={(e) => setNewVersion((prev) => ({ ...prev, version: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Formato semver: major.minor.patch</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Note di Rilascio</label>
              <Textarea
                placeholder="Descrivi le novita di questa versione..."
                value={newVersion.release_notes}
                onChange={(e) =>
                  setNewVersion((prev) => ({ ...prev, release_notes: e.target.value }))
                }
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Changelog</label>
              <Textarea
                placeholder="Changelog dettagliato..."
                value={newVersion.changelog}
                onChange={(e) => setNewVersion((prev) => ({ ...prev, changelog: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVersionDialog(false)}
              disabled={creatingVersion}
            >
              Annulla
            </Button>
            <Button onClick={handleCreateVersion} disabled={creatingVersion || !newVersion.version}>
              {creatingVersion ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Pubblica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dependency Dialog */}
      <Dialog open={showDepDialog} onOpenChange={setShowDepDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Dipendenza</DialogTitle>
            <DialogDescription>Seleziona un plugin da aggiungere come dipendenza</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plugin ID *</label>
              <Input
                placeholder="UUID del plugin"
                value={depPluginId}
                onChange={(e) => setDepPluginId(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={depOptional} onCheckedChange={setDepOptional} />
              <label className="text-sm">Dipendenza opzionale</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepDialog(false)} disabled={addingDep}>
              Annulla
            </Button>
            <Button
              onClick={async () => {
                if (!depPluginId) return;
                setAddingDep(true);
                try {
                  setShowDepDialog(false);
                  setDepPluginId('');
                  setDepOptional(false);
                  fetchData();
                } catch (err) {
                  console.error('Add dependency failed:', err);
                } finally {
                  setAddingDep(false);
                }
              }}
              disabled={addingDep || !depPluginId}
            >
              {addingDep ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
