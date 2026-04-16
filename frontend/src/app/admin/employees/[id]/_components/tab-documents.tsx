'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

interface TabProps {
  employeeId: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('it-IT');
}

function normalizeArray(response: unknown): any[] {
  if (!response || typeof response !== 'object') return [];
  const resp = response as Record<string, unknown>;
  const data = resp.data ?? resp;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.documents)) return obj.documents as any[];
    if (Array.isArray(obj.items)) return obj.items as any[];
  }
  return [];
}

export function TabDocuments({ employeeId }: TabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const { getStatusConfig } = useStatusConfig('documents');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiClient.get(`/api/v1/employee-documents?employee_id=${employeeId}`);
        setDocuments(normalizeArray(result));
      } catch {
        setError('Impossibile caricare i documenti');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {isEn ? 'No documents found' : 'Nessun documento trovato'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          {isEn ? 'Documents' : 'Documenti'} ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">{isEn ? 'Title' : 'Titolo'}</th>
                <th className="pb-2 pr-4 font-medium">{isEn ? 'Type' : 'Tipo'}</th>
                <th className="pb-2 pr-4 font-medium">{isEn ? 'Status' : 'Stato'}</th>
                <th className="pb-2 pr-4 font-medium">File</th>
                <th className="pb-2 pr-4 font-medium">{isEn ? 'Created' : 'Creazione'}</th>
                <th className="pb-2 font-medium">{isEn ? 'Expiry' : 'Scadenza'}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => {
                const status = String(doc.status || 'active');
                const isConfidential =
                  Boolean(doc.is_confidential) ||
                  doc.visibility === 'confidential' ||
                  doc.visibility === 'private';
                return (
                  <tr key={String(doc.id || idx)} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        {isConfidential && (
                          <span title="Riservato">
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                        <span>{String(doc.title || doc.document_name || 'Senza titolo')}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4">{String(doc.document_type || doc.type || '-')}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusConfig(status).className}`}
                      >
                        {getStatusConfig(status).label}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {doc.filename ? (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="max-w-[200px] truncate">{String(doc.filename)}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatDate(doc.created_at as string)}</td>
                    <td className="py-2">
                      {formatDate((doc.expiry_date as string) || (doc.expiration_date as string))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
