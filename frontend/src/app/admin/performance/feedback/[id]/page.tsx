'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Award, ArrowLeft, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { apiClient } from '@/lib/api/client';

interface FeedbackDetail {
  id: string;
  tenant_id: string;
  from_employee_id?: string;
  to_employee_id?: string;
  feedback_type?: string;
  status?: string;
  content?: string;
  rating?: number;
  is_anonymous?: boolean;
  created_at: string;
  updated_at: string;
  from_employee_name?: string;
  to_employee_name?: string;
}

export default function FeedbackDetailPage() {
  const t = useTranslations('admin.performance.feedback');
  const tCommon = useTranslations('common');
  const params = useParams();
  const id = params.id as string;

  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: FeedbackDetail }>(`/api/v1/feedback/${id}`);
      setFeedback(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento feedback');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchFeedback} />
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="p-6">
        <ApiError message="Feedback non trovato" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/feedback">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Award className="h-6 w-6" />
              Dettaglio Feedback
            </h1>
            <p className="text-muted-foreground">
              {feedback.feedback_type || 'Feedback'}
              {feedback.is_anonymous ? ' (Anonimo)' : ''}
            </p>
          </div>
        </div>
        {feedback.status && (
          <Badge variant={feedback.status === 'completed' ? 'default' : 'secondary'}>
            {feedback.status === 'completed'
              ? 'Completato'
              : feedback.status === 'pending'
                ? 'In attesa'
                : feedback.status === 'draft'
                  ? 'Bozza'
                  : feedback.status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contenuto</CardTitle>
              <CardDescription>Testo del feedback</CardDescription>
            </CardHeader>
            <CardContent>
              {feedback.content ? (
                <p className="whitespace-pre-wrap">{feedback.content}</p>
              ) : (
                <p className="text-muted-foreground">Nessun contenuto disponibile</p>
              )}
            </CardContent>
          </Card>

          {feedback.rating != null && (
            <Card>
              <CardHeader>
                <CardTitle>Valutazione</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{feedback.rating}/5</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Persone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Da</p>
                  <p className="font-medium">
                    {feedback.is_anonymous ? 'Anonimo' : feedback.from_employee_name || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">A</p>
                  <p className="font-medium">{feedback.to_employee_name || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informazioni Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Creato</p>
                  <p>{new Date(feedback.created_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{feedback.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
