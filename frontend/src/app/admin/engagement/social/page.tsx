'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { RefreshCw, MessageCircle, Heart, ThumbsUp, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SocialPost {
  id: string;
  author_id?: string;
  author_name?: string;
  author_avatar?: string;
  content: string;
  type?: string;
  reactions_count?: number;
  comments_count?: number;
  shares_count?: number;
  likes_count?: number;
  created_at: string;
  updated_at?: string;
  tags?: string[];
  pinned?: boolean;
}

export default function SocialPage() {
  const t = useTranslations('admin.engagement.social');
  const [data, setData] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/social/feed');
      const items =
        response.data?.posts ||
        response.data?.feed ||
        response.data?.items ||
        response.data ||
        response.posts ||
        [];
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours < 1) return 'Poco fa';
      if (diffHours < 24) return `${diffHours}h fa`;
      if (diffDays < 7) return `${diffDays}g fa`;
      return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getTypeBadge = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'announcement':
        return <Badge className="bg-blue-100 text-blue-800">Annuncio</Badge>;
      case 'achievement':
        return <Badge className="bg-green-100 text-green-800">Traguardo</Badge>;
      case 'recognition':
        return <Badge className="bg-purple-100 text-purple-800">Riconoscimento</Badge>;
      case 'discussion':
        return <Badge variant="outline">Discussione</Badge>;
      default:
        return type ? <Badge variant="outline">{type}</Badge> : null;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">t('loading')</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Social</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> {t('retry')}
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
            <MessageCircle className="h-6 w-6" /> Social Feed
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center py-8">{t('noResults')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((post) => (
            <Card key={post.id} className={post.pinned ? 'border-primary' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {(post.author_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{post.author_name || 'Utente'}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(post.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {post.pinned && <Badge>Fissato</Badge>}
                    {getTypeBadge(post.type)}
                  </div>
                </div>

                <p className="text-sm leading-relaxed mb-4">{post.content}</p>

                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {post.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-6 text-sm text-muted-foreground border-t pt-3">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" /> {post.likes_count ?? post.reactions_count ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" /> {post.comments_count ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-4 w-4" /> {post.reactions_count ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="h-4 w-4" /> {post.shares_count ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
