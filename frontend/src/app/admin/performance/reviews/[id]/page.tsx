'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ClipboardList, ArrowLeft, Calendar, User, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { PerformanceReview } from '@/lib/api/types';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

function RatingStars({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
        />
      ))}
      <span className="ml-2 font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function ReviewDetailPage() {
  const t = useTranslations('admin.performance.reviews');
  const tCommon = useTranslations('common');
  const { getStatusConfig } = useStatusConfig('reviews');
  const params = useParams();
  const id = params.id as string;

  const [review, setReview] = useState<PerformanceReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.performanceReviews.getReviewById(id);
      setReview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento valutazione');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchReview} />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-6">
        <ApiError message="Valutazione non trovata" />
      </div>
    );
  }

  const status = getStatusConfig(review.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/reviews">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Valutazione Performance
            </h1>
            <p className="text-muted-foreground">
              {review.employee_name || 'Dipendente'} &mdash; {review.review_type}
            </p>
          </div>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ratings */}
          <Card>
            <CardHeader>
              <CardTitle>Valutazioni</CardTitle>
              <CardDescription>Punteggi assegnati</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Valutazione Complessiva</p>
                  <RatingStars rating={review.overall_rating} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Raggiungimento Obiettivi</p>
                  <RatingStars rating={review.goal_achievement_rating} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Competenze</p>
                  <RatingStars rating={review.competency_rating} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summaries */}
          {(review.manager_summary || review.employee_summary) && (
            <Card>
              <CardHeader>
                <CardTitle>Commenti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {review.manager_summary && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Commento del Manager
                    </p>
                    <p className="whitespace-pre-wrap">{review.manager_summary}</p>
                  </div>
                )}
                {review.employee_summary && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Autovalutazione Dipendente
                    </p>
                    <p className="whitespace-pre-wrap">{review.employee_summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* People */}
          <Card>
            <CardHeader>
              <CardTitle>Persone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Dipendente</p>
                  <p className="font-medium">{review.employee_name || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Valutatore</p>
                  <p className="font-medium">{review.reviewer_name || '-'}</p>
                </div>
              </div>
              {review.department_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Dipartimento</p>
                  <p className="font-medium">{review.department_name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Period */}
          <Card>
            <CardHeader>
              <CardTitle>Periodo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Da</p>
                  <p>{new Date(review.period_start).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">A</p>
                  <p>{new Date(review.period_end).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">{review.review_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Creata</p>
                <p>{new Date(review.created_at).toLocaleDateString('it-IT')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{review.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
