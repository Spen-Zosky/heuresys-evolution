'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { MapPin, Users, Globe, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Location {
  id: string;
  name: string;
  city?: string;
  country?: string;
  employee_count?: number;
  code?: string;
}

export default function WorkforceLocationsPage() {
  const t = useTranslations('companyPet');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: Location[] | { locations?: Location[] } }>(
        '/api/v1/locations'
      );
      const raw = res?.data;
      setLocations(Array.isArray(raw) ? raw : raw?.locations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalEmployees = locations.reduce((sum, l) => sum + (l.employee_count || 0), 0);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('locations.title')} description={t('locations.description')} />
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('locations.title')} description={t('locations.description')} />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '-' : locations.length}
                </p>
                <p className="text-xs text-muted-foreground">Sedi operative</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '-' : totalEmployees > 0 ? totalEmployees : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Dipendenti distribuiti</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading
                    ? '-'
                    : new Set(locations.map((l) => l.country).filter(Boolean)).size || 1}
                </p>
                <p className="text-xs text-muted-foreground">Paesi</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Sedi
          </CardTitle>
          <CardDescription>
            {loading ? 'Caricamento...' : `${locations.length} sedi nell'organizzazione`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nessuna sede trovata</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-4 border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    {loc.employee_count !== undefined && loc.employee_count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {loc.employee_count}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-foreground">{loc.name}</h3>
                  {loc.city && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {loc.city}
                      {loc.country ? `, ${loc.country}` : ''}
                    </p>
                  )}
                  {loc.code && (
                    <p className="text-xs text-muted-foreground mt-0.5">Codice: {loc.code}</p>
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
