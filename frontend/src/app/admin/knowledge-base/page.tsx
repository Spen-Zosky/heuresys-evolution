'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { RefreshCw, BookOpen, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  author_name?: string;
  author_id?: string;
  status?: string;
  views_count?: number;
  likes_count?: number;
  tags?: string[];
  summary?: string;
  created_at: string;
  updated_at?: string;
  published_at?: string;
}

export default function KnowledgeBasePage() {
  const t = useTranslations('admin.knowledgeBase');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/knowledge-base');
      const items =
        response.data?.articles || response.data?.items || response.data || response.articles || [];
      setData(Array.isArray(items) ? items : []);
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'published':
      case 'pubblicato':
        return <Badge className="bg-green-100 text-green-800">Pubblicato</Badge>;
      case 'draft':
      case 'bozza':
        return <Badge className="bg-yellow-100 text-yellow-800">Bozza</Badge>;
      case 'archived':
      case 'archiviato':
        return <Badge variant="secondary">Archiviato</Badge>;
      case 'review':
      case 'in_review':
        return <Badge className="bg-blue-100 text-blue-800">In Revisione</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredData = data.filter((article) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      article.title?.toLowerCase().includes(term) ||
      article.category?.toLowerCase().includes(term) ||
      article.author_name?.toLowerCase().includes(term) ||
      article.tags?.some((t) => t.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{tCommon('loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> {tCommon('retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" /> {tCommon('refresh')}
          </Button>
          <Button size="sm" onClick={() => toast.info(tCommon('featureInDevelopment'))}>
            <Plus className="h-4 w-4 mr-2" /> {t('newArticle')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tCommon('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">
          {filteredData.length} {t('articles')}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('articles')} ({filteredData.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{tCommon('noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.title')}</TableHead>
                  <TableHead>{t('fields.category')}</TableHead>
                  <TableHead>{t('fields.author')}</TableHead>
                  <TableHead>{t('fields.views')}</TableHead>
                  <TableHead>{t('fields.status')}</TableHead>
                  <TableHead>{t('fields.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="font-medium max-w-[300px]">
                      <div>
                        <p className="truncate">{article.title}</p>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {article.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{article.category || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>{article.author_name || 'N/A'}</TableCell>
                    <TableCell>{article.views_count ?? 0}</TableCell>
                    <TableCell>{getStatusBadge(article.status)}</TableCell>
                    <TableCell>{formatDate(article.published_at || article.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
