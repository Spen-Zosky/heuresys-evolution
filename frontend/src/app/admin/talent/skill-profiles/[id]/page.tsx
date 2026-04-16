'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface ApiResponse {
  data?: { data?: Record<string, unknown> } & Record<string, unknown>;
}

export default function DetailPage() {
  const t = useTranslations('admin.talent.skillProfiles');
  const tCommon = useTranslations('common');
  const params = useParams();
  const id = params?.id as string;
  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response: ApiResponse = await apiClient.get(`/api/v1/employee-skill-profiles/${id}`);
      const result = response.data?.data || response.data || null;
      setItem(result as Record<string, unknown> | null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <div className="p-6">
        <p>Caricamento...</p>
      </div>
    );
  if (error)
    return (
      <div className="p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  if (!item)
    return (
      <div className="p-6">
        <p>Profilo Competenze non trovato</p>
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/talent/skill-profiles">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Indietro
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {String(item.name || item.title || 'Profilo Competenze')}
        </h1>
        {item.status ? <Badge>{String(item.status as string)}</Badge> : null}
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          {Object.entries(item)
            .filter(([k]) => k !== 'id')
            .map(([key, value]) => (
              <div key={key} className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-medium">
                  {value != null ? String(value as string) : '—'}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
