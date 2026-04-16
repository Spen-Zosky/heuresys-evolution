'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Globe, Search, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface EscoResult {
  uri?: string;
  id?: string;
  title: string;
  preferredLabel?: string;
  description?: string;
  type?: string;
  conceptType?: string;
  iscoGroup?: string;
  skillType?: string;
  [key: string]: unknown;
}

const typeColors: Record<string, string> = {
  skill: 'bg-blue-100 text-blue-800',
  competence: 'bg-purple-100 text-purple-800',
  occupation: 'bg-green-100 text-green-800',
  knowledge: 'bg-orange-100 text-orange-800',
};

export default function EscoExplorerPage() {
  const t = useTranslations('admin.talent.escoExplorer');
  const tCommon = useTranslations('common');
  const [results, setResults] = useState<EscoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const typeParam = searchType !== 'all' ? `&type=${searchType}` : '';
      const response = await apiClient.get<{
        data: { items?: EscoResult[]; results?: EscoResult[] } | EscoResult[];
      }>(
        `/api/v1/hr-intelligence/skills/search?q=${encodeURIComponent(query)}${typeParam}&limit=50`
      );
      const raw = response.data;
      let items: EscoResult[];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items =
          ((raw as Record<string, unknown>).items as EscoResult[]) ||
          ((raw as Record<string, unknown>).results as EscoResult[]) ||
          ((raw as Record<string, unknown>).skills as EscoResult[]) ||
          ((raw as Record<string, unknown>).occupations as EscoResult[]) ||
          [];
      } else {
        items = Array.isArray(response) ? (response as unknown as EscoResult[]) : [];
      }
      setResults(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella ricerca ESCO');
    } finally {
      setLoading(false);
    }
  }, [query, searchType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            ESCO Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Esplora la tassonomia europea delle competenze, abilita e occupazioni
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca competenze, abilita, occupazioni..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
              </div>
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tipi</SelectItem>
                  <SelectItem value="skill">Competenze</SelectItem>
                  <SelectItem value="occupation">Occupazioni</SelectItem>
                  <SelectItem value="knowledge">Conoscenze</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                <Search className="h-4 w-4 mr-2" />
                Cerca
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {hasSearched && (
        <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Risultati</p>
              <p className="text-2xl font-bold">{results.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Competenze</p>
              <p className="text-2xl font-bold">
                {results.filter((r) => (r.type || r.conceptType) === 'skill').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Occupazioni</p>
              <p className="text-2xl font-bold">
                {results.filter((r) => (r.type || r.conceptType) === 'occupation').length}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Ricerca in corso...</div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={handleSearch}>
                  Riprova
                </Button>
              </div>
            ) : !hasSearched ? (
              <div className="p-8 text-center text-muted-foreground">
                Inserisci un termine e clicca &quot;Cerca&quot; per esplorare la tassonomia ESCO
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nessun risultato trovato per &quot;{query}&quot;
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => {
                    const resType = r.type || r.conceptType || r.skillType || 'unknown';
                    return (
                      <TableRow key={r.uri || r.id || idx}>
                        <TableCell className="font-medium">{r.preferredLabel || r.title}</TableCell>
                        <TableCell>
                          <Badge className={typeColors[resType] || 'bg-gray-100 text-gray-800'}>
                            {resType}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {r.description || '-'}
                        </TableCell>
                        <TableCell>
                          {r.uri ? (
                            <a
                              href={r.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
