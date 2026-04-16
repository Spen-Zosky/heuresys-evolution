'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, MessageSquare, ClipboardCheck } from 'lucide-react';
import { api } from '@/lib/api';

const REVIEW_STATUS_LABELS: Record<string, { it: string; en: string }> = {
  completed: { it: 'Completato', en: 'Completed' },
  in_progress: { it: 'In Corso', en: 'In Progress' },
  draft: { it: 'Bozza', en: 'Draft' },
  pending: { it: 'In Attesa', en: 'Pending' },
  cancelled: { it: 'Annullato', en: 'Cancelled' },
};

const REVIEW_TYPE_LABELS: Record<string, { it: string; en: string }> = {
  annual: { it: 'Annuale', en: 'Annual' },
  quarterly: { it: 'Trimestrale', en: 'Quarterly' },
  semi_annual: { it: 'Semestrale', en: 'Semi-Annual' },
  probation: { it: 'Periodo di Prova', en: 'Probation' },
  '360': { it: '360°', en: '360°' },
};

interface TabProps {
  employeeId: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('it-IT');
}

function normalizeArray(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if ('items' in obj && Array.isArray(obj.items)) return obj.items as any[];
    if ('continuous' in obj && Array.isArray(obj.continuous)) {
      const cont = obj.continuous as any[];
      const f360 = Array.isArray(obj.feedback_360) ? (obj.feedback_360 as any[]) : [];
      return [...cont, ...f360];
    }
    if ('data' in obj) return normalizeArray(obj.data);
  }
  return [];
}

function renderStars(rating: unknown): React.ReactNode {
  const num = Number(rating || 0);
  const stars = Math.round(Math.min(5, Math.max(0, num)));
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
      <span className="ml-1 text-sm text-muted-foreground">{num ? num.toFixed(1) : '-'}</span>
    </span>
  );
}

const reviewStatusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};

const checkInStatusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  missed: 'bg-orange-100 text-orange-800',
};

export function TabPerformance({ employeeId }: TabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const localizeStatus = (s: string) => REVIEW_STATUS_LABELS[s]?.[isEn ? 'en' : 'it'] || s;
  const localizeType = (t: string) => REVIEW_TYPE_LABELS[t]?.[isEn ? 'en' : 'it'] || t;
  const [reviews, setReviews] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAll = async () => {
      const errs: Record<string, string> = {};

      // Reviews
      try {
        const result = await api.performanceReviews.getReviews({ employee_id: employeeId });
        setReviews(normalizeArray(result));
      } catch {
        errs.reviews = 'Dati non disponibili';
      }

      // Check-ins
      try {
        const result = await api.checkIns.getCheckIns({ employee_id: employeeId });
        setCheckIns(normalizeArray(result));
      } catch {
        errs.checkIns = 'Dati non disponibili';
      }

      // Feedback
      try {
        const result = await api.feedback.getFeedback({ employee_id: employeeId });
        setFeedbackList(normalizeArray(result));
      } catch {
        errs.feedback = 'Dati non disponibili';
      }

      setErrors(errs);
      setLoading(false);
    };
    fetchAll();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Valutazioni */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            {isEn ? 'Reviews' : 'Valutazioni'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.reviews ? (
            <p className="text-sm text-muted-foreground">{errors.reviews}</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isEn ? 'No reviews found' : 'Nessuna valutazione trovata'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{isEn ? 'Type' : 'Tipo'}</th>
                    <th className="pb-2 pr-4 font-medium">{isEn ? 'Period' : 'Periodo'}</th>
                    <th className="pb-2 pr-4 font-medium">{isEn ? 'Rating' : 'Valutazione'}</th>
                    <th className="pb-2 font-medium">{isEn ? 'Status' : 'Stato'}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => {
                    const status = String(r.status || 'draft');
                    return (
                      <tr key={String(r.id)} className="border-b last:border-0">
                        <td className="py-2 pr-4">{localizeType(String(r.review_type || '-'))}</td>
                        <td className="py-2 pr-4">
                          {formatDate(r.review_period_start as string)} -{' '}
                          {formatDate(r.review_period_end as string)}
                        </td>
                        <td className="py-2 pr-4">{renderStars(r.overall_rating)}</td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${reviewStatusColors[status] || 'bg-gray-100 text-gray-800'}`}
                          >
                            {localizeStatus(status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Check-in
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.checkIns ? (
            <p className="text-sm text-muted-foreground">{errors.checkIns}</p>
          ) : checkIns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isEn ? 'No check-ins found' : 'Nessun check-in trovato'}
            </p>
          ) : (
            <div className="space-y-3">
              {checkIns.slice(0, 10).map((c) => {
                const status = String(c.status || 'scheduled');
                const mood = c.employee_mood;
                return (
                  <div
                    key={String(c.id)}
                    className="flex items-start justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatDate(c.scheduled_date as string)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${checkInStatusColors[status] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {localizeStatus(status)}
                        </span>
                      </div>
                      {(c.employee_notes || c.manager_notes) && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {String(c.employee_notes || c.manager_notes).slice(0, 120)}
                          {String(c.employee_notes || c.manager_notes).length > 120 ? '...' : ''}
                        </p>
                      )}
                    </div>
                    {mood != null && (
                      <span className="text-sm font-medium text-muted-foreground" title="Umore">
                        {typeof mood === 'number' ? `${mood}/5` : String(mood)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4" />
            Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.feedback ? (
            <p className="text-sm text-muted-foreground">{errors.feedback}</p>
          ) : feedbackList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isEn ? 'No feedback found' : 'Nessun feedback trovato'}
            </p>
          ) : (
            <div className="space-y-3">
              {feedbackList.slice(0, 10).map((f, idx) => (
                <div key={String(f.id || idx)} className="border-b pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {String(f.feedback_type || f.type || 'Feedback')}
                    </span>
                    {f.rating != null && renderStars(f.rating)}
                  </div>
                  {(f.comments || f.content || f.message) && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {String(f.comments || f.content || f.message)}
                    </p>
                  )}
                  {f.created_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(f.created_at as string)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
