'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Star,
  Download,
  Shield,
  Sparkles,
  ExternalLink,
  Tag,
  Loader2,
  ThumbsUp,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type {
  Plugin,
  PluginReview,
  ReviewSummary,
  PluginDependency,
  PricingModel,
} from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// CONSTANTS
// ============================================

const PRICING_LABELS: Record<PricingModel, string> = {
  free: 'Gratuito',
  freemium: 'Freemium',
  paid: 'A pagamento',
  subscription: 'Abbonamento',
  contact: 'Su richiesta',
};

// ============================================
// TYPES
// ============================================

interface PluginDetailState {
  plugin: Plugin | null;
  reviews: PluginReview[];
  summary: ReviewSummary | null;
  dependencies: PluginDependency[];
  loading: boolean;
  error: string | null;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function PluginDetailPage() {
  const t = useTranslations('admin.marketplace');
  const tCommon = useTranslations('common');
  const params = useParams();
  const pluginId = params.id as string;

  const [state, setState] = useState<PluginDetailState>({
    plugin: null,
    reviews: [],
    summary: null,
    dependencies: [],
    loading: true,
    error: null,
  });

  const [screenshotDialog, setScreenshotDialog] = useState<string | null>(null);

  const [installing, setInstalling] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Fetch plugin details
  const fetchPlugin = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [plugin, reviewsData, deps] = await Promise.all([
        api.marketplace.getPluginById(pluginId),
        api.marketplace.getPluginReviews(pluginId, { limit: 10 }).catch(() => ({
          reviews: [] as PluginReview[],
          summary: {
            total_reviews: 0,
            avg_rating: 0,
            five_star: 0,
            four_star: 0,
            three_star: 0,
            two_star: 0,
            one_star: 0,
          } as ReviewSummary,
          meta: { total: 0, limit: 10, offset: 0 },
        })),
        api.marketplace.getPluginDependencies(pluginId).catch(() => [] as PluginDependency[]),
      ]);
      setState({
        plugin,
        reviews: reviewsData.reviews,
        summary: reviewsData.summary,
        dependencies: deps,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento dettagli plugin',
      }));
    }
  }, [pluginId]);

  useEffect(() => {
    fetchPlugin();
  }, [fetchPlugin]);

  // Handle install
  const handleInstall = useCallback(async () => {
    if (!state.plugin) return;

    setInstalling(true);
    try {
      await api.marketplace.installPlugin({ plugin_id: state.plugin.id });
      setInstallSuccess(true);
    } catch (err) {
      console.error('Install failed:', err);
    } finally {
      setInstalling(false);
    }
  }, [state.plugin]);

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Format price
  const formatPrice = (plugin: Plugin) => {
    if (plugin.pricing_model === 'free') return 'Gratuito';
    if (plugin.pricing_model === 'contact') return 'Su richiesta';
    if (Number(plugin.price_cents) > 0) {
      const amount = (Number(plugin.price_cents) / 100).toFixed(2);
      return `${amount} ${plugin.currency || 'EUR'}`;
    }
    return PRICING_LABELS[plugin.pricing_model] || plugin.pricing_model;
  };

  // Render star rating
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

  if (state.loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-6 w-[200px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-16 w-16 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-6 w-[250px]" />
                    <Skeleton className="h-4 w-[180px]" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return <ApiError message={state.error} onRetry={fetchPlugin} />;
  }

  if (!state.plugin) {
    return null;
  }

  const { plugin, reviews, summary, dependencies } = state;
  const pluginWithExtras = plugin as Plugin & { screenshot_urls?: string[]; banner_url?: string };
  const avgRating = Number(summary?.avg_rating || plugin.avg_rating || 0);
  const totalReviews = summary?.total_reviews || plugin.total_ratings || 0;

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plugin Header */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
                    {plugin.icon_url ? (
                      <img
                        src={plugin.icon_url}
                        alt={plugin.name}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                    ) : (
                      plugin.name[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-semibold">{plugin.name}</h1>
                      {plugin.featured && <Sparkles className="h-5 w-5 text-yellow-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      di {plugin.publisher_name} &middot; v{plugin.latest_version || '1.0.0'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {plugin.category_name && (
                        <Badge variant="secondary">{plugin.category_name}</Badge>
                      )}
                      <Badge variant="outline">{formatPrice(plugin)}</Badge>
                      <div className="flex items-center gap-1">
                        {renderStars(avgRating)}
                        <span className="text-sm font-medium ml-1">{avgRating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">
                          ({totalReviews} recensioni)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Download className="h-4 w-4" />
                        {(plugin.total_installations || 0).toLocaleString()} installazioni
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Description */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descrizione</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {plugin.description || plugin.short_description}
                </p>

                {plugin.tags && plugin.tags.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="flex flex-wrap gap-2">
                      {plugin.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Banner Image */}
          {pluginWithExtras.banner_url && (
            <motion.div variants={staggerItem}>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={pluginWithExtras.banner_url}
                    alt={`${plugin.name} banner`}
                    className="w-full h-48 object-cover"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Screenshots */}
          {pluginWithExtras.screenshot_urls && pluginWithExtras.screenshot_urls.length > 0 && (
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Screenshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {pluginWithExtras.screenshot_urls.map((url, idx) => (
                      <button
                        key={idx}
                        className="shrink-0 rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => setScreenshotDialog(url)}
                      >
                        <img
                          src={url}
                          alt={`Screenshot ${idx + 1}`}
                          className="h-32 w-48 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Dependencies */}
          {dependencies.length > 0 && (
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dipendenze</CardTitle>
                  <CardDescription>Plugin richiesti per il funzionamento</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dependencies.map((dep) => (
                      <Link
                        key={dep.id}
                        href={`/admin/marketplace/${dep.depends_on_slug || dep.depends_on_plugin_id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {dep.depends_on_icon_url ? (
                            <img src={dep.depends_on_icon_url} alt="" className="h-6 w-6 rounded" />
                          ) : (
                            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {(dep.depends_on_name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium">
                            {dep.depends_on_name || dep.depends_on_plugin_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {dep.min_version && (
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">
                              &gt;= {dep.min_version}
                            </code>
                          )}
                          <Badge
                            variant={dep.is_optional ? 'outline' : 'secondary'}
                            className="text-xs"
                          >
                            {dep.is_optional ? 'Opzionale' : 'Richiesta'}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Permissions (from latest version) */}
          {plugin.permissions_required && plugin.permissions_required.length > 0 && (
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permessi Richiesti
                  </CardTitle>
                  <CardDescription>
                    Questo plugin richiede i seguenti permessi per funzionare
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plugin.permissions_required.map((perm) => (
                      <li key={perm} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <code className="text-xs bg-muted px-2 py-1 rounded">{perm}</code>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Reviews */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recensioni ({totalReviews})</CardTitle>
                {/* Rating breakdown */}
                {summary && totalReviews > 0 && (
                  <div className="mt-2 space-y-1">
                    {[
                      { stars: 5, count: summary.five_star },
                      { stars: 4, count: summary.four_star },
                      { stars: 3, count: summary.three_star },
                      { stars: 2, count: summary.two_star },
                      { stars: 1, count: summary.one_star },
                    ].map(({ stars, count }) => (
                      <div key={stars} className="flex items-center gap-2 text-xs">
                        <span className="w-6 text-right">{stars}</span>
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full"
                            style={{
                              width: `${totalReviews > 0 ? (count / totalReviews) * 100 : 0}%`,
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
                    Nessuna recensione ancora. Installa il plugin e lascia la tua!
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
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">
                                  {review.reviewer_name || 'Utente'}
                                </p>
                                {review.is_verified_install && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Verificato
                                  </Badge>
                                )}
                              </div>
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
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Install Action */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="p-6 space-y-4">
                <Button className="w-full" size="lg" onClick={() => setShowInstallDialog(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Installa Plugin
                </Button>

                <Separator />

                {/* Plugin Info */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Versione</span>
                    <span className="font-medium">{plugin.latest_version || '1.0.0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Autore</span>
                    <span className="font-medium">{plugin.publisher_name}</span>
                  </div>
                  {plugin.category_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Categoria</span>
                      <Badge variant="secondary" className="text-xs">
                        {plugin.category_name}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prezzo</span>
                    <span className="font-medium">{formatPrice(plugin)}</span>
                  </div>
                  {plugin.license && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Licenza</span>
                      <span className="font-medium">{plugin.license}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Aggiornato</span>
                    <span className="font-medium">{formatDate(plugin.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Installazioni</span>
                    <span className="font-medium">
                      {(plugin.total_installations || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {plugin.homepage_url && (
                  <>
                    <Separator />
                    <Button variant="outline" className="w-full" asChild>
                      <a href={plugin.homepage_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Sito Web
                      </a>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Release Notes */}
          {plugin.release_notes && (
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Note di Rilascio</CardTitle>
                  <CardDescription>v{plugin.latest_version}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {plugin.release_notes}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Screenshot Lightbox */}
      <Dialog open={!!screenshotDialog} onOpenChange={(open) => !open && setScreenshotDialog(null)}>
        <DialogContent className="sm:max-w-[800px] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Screenshot</DialogTitle>
            <DialogDescription>Anteprima screenshot plugin</DialogDescription>
          </DialogHeader>
          {screenshotDialog && (
            <img src={screenshotDialog} alt="Screenshot" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Install Dialog */}
      <Dialog
        open={showInstallDialog}
        onOpenChange={(open) => {
          setShowInstallDialog(open);
          if (!open) setInstallSuccess(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {installSuccess ? 'Plugin Installato' : `Installa ${plugin.name}`}
            </DialogTitle>
            <DialogDescription>
              {installSuccess
                ? `${plugin.name} v${plugin.latest_version || '1.0.0'} e stato installato con successo.`
                : `Confermi l'installazione di ${plugin.name} v${plugin.latest_version || '1.0.0'}?`}
            </DialogDescription>
          </DialogHeader>

          {!installSuccess &&
            plugin.permissions_required &&
            plugin.permissions_required.length > 0 && (
              <div className="py-2">
                <p className="text-sm font-medium mb-2">Permessi richiesti:</p>
                <ul className="space-y-1">
                  {plugin.permissions_required.map((perm) => (
                    <li
                      key={perm}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Shield className="h-3 w-3" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {!installSuccess && plugin.pricing_model !== 'free' && plugin.price_cents > 0 && (
            <div className="py-2">
              <p className="text-sm">
                <span className="font-medium">Costo:</span> {formatPrice(plugin)}
                {plugin.pricing_model === 'subscription' && '/mese'}
              </p>
            </div>
          )}

          <DialogFooter>
            {installSuccess ? (
              <>
                <Button variant="outline" onClick={() => setShowInstallDialog(false)}>
                  Chiudi
                </Button>
                <Button asChild>
                  <Link href="/admin/marketplace/installed">Vai ai Plugin Installati</Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowInstallDialog(false)}
                  disabled={installing}
                >
                  Annulla
                </Button>
                <Button onClick={handleInstall} disabled={installing}>
                  {installing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Installazione...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Conferma Installazione
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
