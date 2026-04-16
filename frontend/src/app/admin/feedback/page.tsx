'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, AlertCircle, Star, Calendar, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

interface ContinuousFeedback {
  id: string;
  from_employee_name?: string;
  to_employee_name?: string;
  feedback_type?: string;
  message?: string;
  rating?: number;
  created_at?: string;
  [key: string]: unknown;
}

interface Review360 {
  id: string;
  employee_name?: string;
  review_cycle?: string;
  status?: string;
  avg_score?: number;
  reviewers_count?: number;
  due_date?: string;
  [key: string]: unknown;
}

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

export default function FeedbackPage() {
  const t = useTranslations('admin.feedback');
  const [continuousFeedback, setContinuousFeedback] = useState<ContinuousFeedback[]>([]);
  const [reviews360, setReviews360] = useState<Review360[]>([]);
  const [loadingCF, setLoadingCF] = useState(true);
  const [loading360, setLoading360] = useState(true);
  const [errorCF, setErrorCF] = useState<string | null>(null);
  const [error360, setError360] = useState<string | null>(null);

  const fetchContinuousFeedback = useCallback(async () => {
    setLoadingCF(true);
    setErrorCF(null);
    try {
      const data = await apiClient.get<
        { data: ContinuousFeedback[] | { items: ContinuousFeedback[] } } | ContinuousFeedback[]
      >('/api/v1/continuous-feedback');
      const raw = Array.isArray(data) ? data : data.data;
      const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && 'items' in raw
          ? (raw as { items: ContinuousFeedback[] }).items
          : [];
      setContinuousFeedback(Array.isArray(list) ? list : []);
    } catch (err) {
      setErrorCF(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoadingCF(false);
    }
  }, []);

  const fetchReviews360 = useCallback(async () => {
    setLoading360(true);
    setError360(null);
    try {
      const data = await apiClient.get<
        { data: Review360[] | { items: Review360[] } } | Review360[]
      >('/api/v1/360-reviews');
      const raw = Array.isArray(data) ? data : data.data;
      const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && 'items' in raw
          ? (raw as { items: Review360[] }).items
          : [];
      setReviews360(Array.isArray(list) ? list : []);
    } catch (err) {
      setError360(err instanceof Error ? err.message : t('loadError360'));
    } finally {
      setLoading360(false);
    }
  }, []);

  useEffect(() => {
    fetchContinuousFeedback();
    fetchReviews360();
  }, [fetchContinuousFeedback, fetchReviews360]);

  const renderStars = (rating?: number) => {
    if (!rating) return '-';
    return (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
          />
        ))}
      </span>
    );
  };

  const renderTableContent = (
    loading: boolean,
    error: string | null,
    onRetry: () => void,
    content: React.ReactNode
  ) => {
    if (loading) return <div className="p-8 text-center text-muted-foreground">{t('loading')}</div>;
    if (error) {
      return (
        <div className="p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={onRetry}>
            Riprova
          </Button>
        </div>
      );
    }
    return content;
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem}>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={staggerItem}>
        <Tabs defaultValue="continuous">
          <TabsList>
            <TabsTrigger value="continuous">{t('tabs.continuous')}</TabsTrigger>
            <TabsTrigger value="360">{t('tabs.reviews360')}</TabsTrigger>
          </TabsList>

          <TabsContent value="continuous" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {renderTableContent(
                  loadingCF,
                  errorCF,
                  fetchContinuousFeedback,
                  continuousFeedback.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">{t('noFeedback')}</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Da</TableHead>
                          <TableHead>A</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Messaggio</TableHead>
                          <TableHead>Valutazione</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {continuousFeedback.map((fb) => (
                          <TableRow key={fb.id}>
                            <TableCell>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {fb.from_employee_name || '-'}
                              </span>
                            </TableCell>
                            <TableCell>{fb.to_employee_name || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{fb.feedback_type || '-'}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{fb.message || '-'}</TableCell>
                            <TableCell>{renderStars(fb.rating)}</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {fb.created_at
                                  ? new Date(fb.created_at).toLocaleDateString('it-IT')
                                  : '-'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="360" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {renderTableContent(
                  loading360,
                  error360,
                  fetchReviews360,
                  reviews360.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">{t('noReviews')}</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dipendente</TableHead>
                          <TableHead>Ciclo</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead>Punteggio Medio</TableHead>
                          <TableHead>Revisori</TableHead>
                          <TableHead>Scadenza</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviews360.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.employee_name || '-'}</TableCell>
                            <TableCell>{r.review_cycle || '-'}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  statusColor[r.status || ''] || 'bg-gray-100 text-gray-800'
                                }
                              >
                                {r.status || 'n/a'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.avg_score != null ? r.avg_score.toFixed(1) : '-'}
                            </TableCell>
                            <TableCell>{r.reviewers_count ?? '-'}</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {r.due_date
                                  ? new Date(r.due_date).toLocaleDateString('it-IT')
                                  : '-'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
