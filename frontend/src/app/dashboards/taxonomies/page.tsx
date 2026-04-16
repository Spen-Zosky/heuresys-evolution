'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import {
  Network,
  Search,
  BookOpen,
  Briefcase,
  Factory,
  Globe,
  AlertCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

type TabType = 'esco' | 'nace';

interface TaxonomyItem {
  code?: string;
  label?: string;
  name?: string;
  description?: string;
  uri?: string;
}

export default function TaxonomiesPage() {
  const t = useTranslations('dashboards');
  const [activeTab, setActiveTab] = useState<TabType>('esco');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const searchTaxonomies = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) return;
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const endpoint =
          activeTab === 'esco'
            ? `/api/v1/skills/esco/search?q=${encodeURIComponent(query)}&limit=20`
            : `/api/v1/taxonomies/nace?q=${encodeURIComponent(query)}&limit=20`;

        const res = await apiClient.get<{
          data: { results?: TaxonomyItem[]; items?: TaxonomyItem[] };
        }>(endpoint);
        setResults(res?.data?.results || res?.data?.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore nella ricerca');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [activeTab]
  );

  const handleSearch = () => {
    searchTaxonomies(searchQuery);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('taxonomies.title')} description={t('taxonomies.description')} />

      {/* Taxonomy Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={activeTab === 'esco' ? 'border-primary/30 shadow-sm' : ''}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <Badge variant={activeTab === 'esco' ? 'default' : 'outline'}>
                {activeTab === 'esco' ? 'Selezionato' : 'ESCO'}
              </Badge>
            </div>
            <CardTitle className="text-lg mt-2">ESCO - European Skills & Competences</CardTitle>
            <CardDescription>
              Classificazione europea di competenze, qualifiche e occupazioni. Collega il mondo
              dell&apos;istruzione e del lavoro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> Occupazioni
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> Competenze
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> EU Standard
              </span>
            </div>
            <Button
              variant={activeTab === 'esco' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveTab('esco');
                setResults([]);
                setSearched(false);
              }}
            >
              Esplora ESCO
            </Button>
          </CardContent>
        </Card>

        <Card className={activeTab === 'nace' ? 'border-primary/30 shadow-sm' : ''}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Factory className="h-5 w-5 text-green-600" />
              </div>
              <Badge variant={activeTab === 'nace' ? 'default' : 'outline'}>
                {activeTab === 'nace' ? 'Selezionato' : 'NACE'}
              </Badge>
            </div>
            <CardTitle className="text-lg mt-2">NACE - Economic Activities</CardTitle>
            <CardDescription>
              Classificazione statistica delle attivita economiche dell&apos;Unione Europea.
              Standard per la categorizzazione industriale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Factory className="h-3.5 w-3.5" /> Settori
              </span>
              <span className="flex items-center gap-1">
                <Network className="h-3.5 w-3.5" /> Classificazione
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> EU Standard
              </span>
            </div>
            <Button
              variant={activeTab === 'nace' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveTab('nace');
                setResults([]);
                setSearched(false);
              }}
            >
              Esplora NACE
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Cerca in {activeTab === 'esco' ? 'ESCO' : 'NACE'}
          </CardTitle>
          <CardDescription>
            Cerca competenze, occupazioni o attivita economiche per nome o codice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={
                activeTab === 'esco'
                  ? 'Es. "project management", "developer"...'
                  : 'Es. "manufacturing", "retail"...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searchQuery.length < 2 || loading}>
              <Search className="h-4 w-4 mr-2" />
              Cerca
            </Button>
          </div>

          {/* Results */}
          <div className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-6">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={handleSearch}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Riprova
                </Button>
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-border">
                {results.map((item, i) => (
                  <div
                    key={item.code || item.uri || i}
                    className="flex items-start gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Badge variant="outline" className="mt-0.5 shrink-0 font-mono">
                      {item.code || '-'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {item.label || item.name || 'N/D'}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            ) : searched ? (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessun risultato per &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Inserisci un termine di ricerca per iniziare</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
