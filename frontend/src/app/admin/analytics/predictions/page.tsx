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
import { RefreshCw, Brain, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useTranslations } from 'next-intl';

interface Prediction {
  id: string;
  model_name?: string;
  type: string;
  target?: string;
  description?: string;
  prediction_value?: number;
  confidence?: number;
  accuracy?: number;
  status: string;
  department?: string;
  employee_name?: string;
  employee_id?: string;
  risk_level?: string;
  factors?: string[];
  created_at: string;
  prediction_date?: string;
  expires_at?: string;
}

interface PredictionsData {
  predictions: Prediction[];
  models?: Array<{
    name: string;
    type: string;
    accuracy: number;
    last_trained: string;
    status: string;
  }>;
}

export default function PredictionsPage() {
  const t = useTranslations('admin.analytics.predictions');
  const [data, setData] = useState<Prediction[]>([]);
  const [models, setModels] = useState<PredictionsData['models']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<any>('/api/v1/predictions/summary');
      const result = response.data || response;
      const items = result?.predictions || result?.items || result?.results || [];
      setData(Array.isArray(items) ? items : Array.isArray(result) ? result : []);
      setModels(result?.models || []);
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRiskBadge = (risk?: string) => {
    switch (risk?.toLowerCase()) {
      case 'critical':
      case 'very_high':
        return <Badge variant="destructive">Critico</Badge>;
      case 'high':
      case 'alto':
        return <Badge className="bg-orange-100 text-orange-800">Alto</Badge>;
      case 'medium':
      case 'medio':
        return <Badge className="bg-yellow-100 text-yellow-800">Medio</Badge>;
      case 'low':
      case 'basso':
        return <Badge className="bg-green-100 text-green-800">Basso</Badge>;
      default:
        return <Badge variant="outline">{risk || 'N/A'}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'flight_risk':
      case 'attrition':
        return <Badge className="bg-red-100 text-red-800">Flight Risk</Badge>;
      case 'performance':
        return <Badge className="bg-blue-100 text-blue-800">Performance</Badge>;
      case 'promotion':
        return <Badge className="bg-green-100 text-green-800">Promozione</Badge>;
      case 'engagement':
        return <Badge className="bg-purple-100 text-purple-800">Engagement</Badge>;
      case 'skill_gap':
        return <Badge className="bg-yellow-100 text-yellow-800">Skill Gap</Badge>;
      default:
        return <Badge variant="outline">{type || 'N/A'}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Attivo</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">In Attesa</Badge>;
      case 'expired':
        return <Badge variant="secondary">Scaduta</Badge>;
      case 'validated':
        return <Badge className="bg-blue-100 text-blue-800">Validata</Badge>;
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
            <Brain className="h-6 w-6" /> Predizioni AI
          </h1>
          <p className="text-muted-foreground mt-1">
            Modelli predittivi e risultati dell&apos;analisi AI
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('refresh')}
        </Button>
      </div>

      {/* Models Overview */}
      {models && models.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" /> {model.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <Badge variant="outline">{model.type}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Accuratezza</span>
                    <span className="font-medium">{(model.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={model.accuracy * 100} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ultimo training</span>
                    <span>{formatDate(model.last_trained)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Predictions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Predizioni ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('noPredictions')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                I modelli AI genereranno predizioni una volta configurati e addestrati
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Dipartimento</TableHead>
                  <TableHead>Rischio</TableHead>
                  <TableHead>Confidenza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Predizione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((pred) => (
                  <TableRow key={pred.id}>
                    <TableCell>{getTypeBadge(pred.type)}</TableCell>
                    <TableCell className="font-medium">
                      {pred.employee_name || pred.target || 'N/A'}
                    </TableCell>
                    <TableCell>{pred.department || 'N/A'}</TableCell>
                    <TableCell>{getRiskBadge(pred.risk_level)}</TableCell>
                    <TableCell>
                      {pred.confidence != null ? (
                        <div className="flex items-center gap-2">
                          <Progress value={pred.confidence * 100} className="h-2 w-16" />
                          <span className="text-sm">{(pred.confidence * 100).toFixed(0)}%</span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(pred.status)}</TableCell>
                    <TableCell>{formatDate(pred.prediction_date || pred.created_at)}</TableCell>
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
