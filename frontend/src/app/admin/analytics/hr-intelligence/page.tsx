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
import { RefreshCw, Lightbulb, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface HrInsight {
  id: string;
  title: string;
  description?: string;
  category: string;
  type?: string;
  severity?: string;
  priority?: string;
  impact?: string;
  status?: string;
  confidence?: number;
  affected_employees?: number;
  department?: string;
  recommendation?: string;
  created_at: string;
  expires_at?: string;
}

interface HrIntelligenceData {
  insights: HrInsight[];
  summary?: {
    total_insights: number;
    high_priority: number;
    actionable: number;
    resolved: number;
  };
}

export default function HrIntelligencePage() {
  const t = useTranslations('admin.analytics.hrIntelligence');
  const [data, setData] = useState<HrInsight[]>([]);
  const [summary, setSummary] = useState<HrIntelligenceData['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/hr-intelligence');
      const result = response.data || response;
      const items = result?.insights || result?.items || result?.reports || [];
      setData(Array.isArray(items) ? items : Array.isArray(result) ? result : []);
      setSummary(result?.summary || null);
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'critica':
        return <Badge variant="destructive">Critica</Badge>;
      case 'high':
      case 'alta':
        return <Badge className="bg-orange-100 text-orange-800">Alta</Badge>;
      case 'medium':
      case 'media':
        return <Badge className="bg-yellow-100 text-yellow-800">Media</Badge>;
      case 'low':
      case 'bassa':
        return <Badge variant="outline">Bassa</Badge>;
      default:
        return <Badge variant="outline">{priority || 'N/A'}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'retention':
        return <Badge className="bg-red-100 text-red-800">Retention</Badge>;
      case 'performance':
        return <Badge className="bg-blue-100 text-blue-800">Performance</Badge>;
      case 'engagement':
        return <Badge className="bg-green-100 text-green-800">Engagement</Badge>;
      case 'compliance':
        return <Badge className="bg-purple-100 text-purple-800">Compliance</Badge>;
      case 'compensation':
        return <Badge className="bg-yellow-100 text-yellow-800">Compensation</Badge>;
      case 'development':
        return <Badge className="bg-indigo-100 text-indigo-800">Development</Badge>;
      default:
        return <Badge variant="outline">{category || 'N/A'}</Badge>;
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
            <Lightbulb className="h-6 w-6" /> HR Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Lightbulb className="h-4 w-4" />
                <span className="text-sm">Insight Totali</span>
              </div>
              <p className="text-2xl font-bold">{summary.total_insights}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Alta Priorità</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{summary.high_priority}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Azionabili</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{summary.actionable}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Risolti</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{summary.resolved}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insights Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Insight ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noInsights')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Dipendenti Coinvolti</TableHead>
                  <TableHead>Confidenza</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((insight) => (
                  <TableRow key={insight.id}>
                    <TableCell className="max-w-[300px]">
                      <p className="font-medium truncate">{insight.title}</p>
                      {insight.description && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {insight.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{getCategoryBadge(insight.category)}</TableCell>
                    <TableCell>{getPriorityBadge(insight.priority || insight.severity)}</TableCell>
                    <TableCell>{insight.affected_employees ?? 'N/A'}</TableCell>
                    <TableCell>
                      {insight.confidence != null
                        ? `${(insight.confidence * 100).toFixed(0)}%`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{formatDate(insight.created_at)}</TableCell>
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
