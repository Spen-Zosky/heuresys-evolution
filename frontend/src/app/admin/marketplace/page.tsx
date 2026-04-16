'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Store,
  Search,
  Filter,
  RefreshCw,
  Star,
  Download,
  Sparkles,
  LayoutGrid,
  LayoutList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import type {
  Plugin,
  PluginCategory as PluginCategoryType,
  OffsetMeta,
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

interface MarketplaceState {
  plugins: Plugin[];
  meta: OffsetMeta | null;
  loading: boolean;
  error: string | null;
}

type ViewMode = 'grid' | 'list';

// ============================================
// PAGE COMPONENT
// ============================================

export default function MarketplacePage() {
  const t = useTranslations('admin.marketplace');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<MarketplaceState>({
    plugins: [],
    meta: null,
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pricingFilter, setPricingFilter] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [categories, setCategories] = useState<PluginCategoryType[]>([]);

  const limit = 12;

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const result = await api.marketplace.getCategories();
      setCategories(result);
    } catch {
      // Ignore category fetch errors
    }
  }, []);

  // Fetch plugins
  const fetchPlugins = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.marketplace.getPlugins({
        search: activeSearch || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        pricing_model: pricingFilter !== 'all' ? (pricingFilter as PricingModel) : undefined,
        limit,
        offset,
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
  }, [activeSearch, categoryFilter, pricingFilter, offset]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  // Handle search submit
  const handleSearch = useCallback(() => {
    setActiveSearch(searchInput);
    setOffset(0);
  }, [searchInput]);

  // Handle category change
  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setOffset(0);
  };

  // Handle pricing change
  const handlePricingChange = (value: string) => {
    setPricingFilter(value);
    setOffset(0);
  };

  // Pagination helpers
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = state.meta ? Math.ceil(state.meta.total / limit) : 1;

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  const handleNextPage = () => {
    if (state.meta && offset + limit < state.meta.total) {
      setOffset((prev) => prev + limit);
    }
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
  const renderRating = (rating: number, count: number) => (
    <div className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      <span className="text-sm font-medium">{Number(rating || 0).toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({Number(count || 0)})</span>
    </div>
  );

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Page Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Store className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Plugin Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Esplora e installa plugin per estendere la piattaforma
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/marketplace/installed">
            <Download className="h-4 w-4 mr-2" />
            Plugin Installati
          </Link>
        </Button>
      </motion.div>

      {/* Filters Card */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca plugin per nome, descrizione..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch}>Cerca</Button>
              </div>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.name}
                      {cat.plugin_count !== undefined && (
                        <span className="text-muted-foreground ml-1">({cat.plugin_count})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Pricing Filter */}
              <Select value={pricingFilter} onValueChange={handlePricingChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Prezzo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i prezzi</SelectItem>
                  {Object.entries(PRICING_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  aria-label="Grid view"
                  className="rounded-none"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  aria-label="Grid view"
                  className="rounded-none"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>

              {/* Refresh */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchPlugins}
                className="shrink-0"
                aria-label="Aggiorna marketplace"
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
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-[140px]" />
                          <Skeleton className="h-3 w-[100px]" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <div className="flex justify-between">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[300px]" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        ) : state.error ? (
          <ApiError message={state.error} onRetry={fetchPlugins} />
        ) : state.plugins.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center text-center">
                <Store className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nessun plugin trovato</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeSearch || categoryFilter !== 'all' || pricingFilter !== 'all'
                    ? 'Prova a modificare i filtri di ricerca'
                    : 'Non ci sono plugin disponibili al momento'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.plugins.map((plugin) => (
              <Link key={plugin.id} href={`/admin/marketplace/${plugin.id}`}>
                <Card className="group hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                        {plugin.icon_url ? (
                          <img
                            src={plugin.icon_url}
                            alt={plugin.name}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          plugin.name[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                          {plugin.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {plugin.publisher_name} &middot; v{plugin.latest_version || '1.0.0'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {plugin.short_description || plugin.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {plugin.category_name && (
                        <Badge variant="secondary" className="text-xs">
                          {plugin.category_name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {formatPrice(plugin)}
                      </Badge>
                      {plugin.featured && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Sparkles className="h-3 w-3 text-yellow-500" />
                          In evidenza
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="flex items-center justify-between w-full">
                      {renderRating(plugin.avg_rating, plugin.total_ratings)}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Download className="h-3 w-3" />
                        {(plugin.total_installations || 0).toLocaleString()}
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {state.meta?.total || state.plugins.length} plugin
                  </CardTitle>
                  <CardDescription>
                    Pagina {currentPage} di {totalPages}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {state.plugins.map((plugin) => (
                  <Link
                    key={plugin.id}
                    href={`/admin/marketplace/${plugin.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                      {plugin.icon_url ? (
                        <img
                          src={plugin.icon_url}
                          alt={plugin.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        plugin.name[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">
                          {plugin.name}
                        </p>
                        {plugin.featured && (
                          <Sparkles className="h-4 w-4 text-yellow-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {plugin.short_description || plugin.description}
                      </p>
                    </div>
                    {plugin.category_name && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {plugin.category_name}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs shrink-0">
                      {formatPrice(plugin)}
                    </Badge>
                    <div className="shrink-0">
                      {renderRating(plugin.avg_rating, plugin.total_ratings)}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Download className="h-3 w-3" />
                      {(plugin.total_installations || 0).toLocaleString()}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Pagination */}
      {!state.loading && state.meta && state.meta.total > limit && (
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {offset + 1}-{Math.min(offset + limit, state.meta.total)} di{' '}
            {state.meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={offset <= 0}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={offset + limit >= state.meta.total}
            >
              Successivo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
