'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { RefreshCw, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ChatSession {
  id: string;
  title: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
  user_name?: string;
}

export default function AiChatPage() {
  const t = useTranslations('admin.ai.chat');
  const [data, setData] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/ai-chat/sessions');
      const items =
        response.data?.sessions || response.data?.items || response.data || response.sessions || [];
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

  const getStatusBadge = (isArchived: boolean) => {
    if (isArchived) {
      return <Badge variant="outline">Archiviata</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Attiva</Badge>;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
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
        <h1 className="text-2xl font-bold">{t('title')}</h1>
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
            <MessageSquare className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sessionsCount', { count: data.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noSessions')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.topic')}</TableHead>
                  <TableHead>{t('columns.user')}</TableHead>
                  <TableHead>{t('columns.messages')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead>{t('columns.createdAt')}</TableHead>
                  <TableHead>{t('columns.updatedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.title || 'Senza titolo'}</TableCell>
                    <TableCell>{session.user_name || 'N/A'}</TableCell>
                    <TableCell>{session.message_count ?? 'N/A'}</TableCell>
                    <TableCell>{getStatusBadge(session.is_archived)}</TableCell>
                    <TableCell>{formatDate(session.created_at)}</TableCell>
                    <TableCell>{formatDate(session.updated_at)}</TableCell>
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
