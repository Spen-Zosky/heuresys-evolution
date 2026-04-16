'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MapPin,
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Building2,
  Globe,
  Calendar,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { Location } from '@/lib/api/types';

export default function LocationDetailPage() {
  const t = useTranslations('admin.locations');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.locations.getLocationById(id);
      setLocation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento sede');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const handleDelete = async () => {
    if (!location) return;
    if (!confirm(`Sei sicuro di voler eliminare "${location.name}"?`)) return;

    try {
      await api.locations.deleteLocation(id);
      router.push('/admin/locations');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchLocation} />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="p-6">
        <ApiError message="Sede non trovata" />
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
          <Link href="/admin/locations">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6" />
              {location.name}
            </h1>
            <p className="text-muted-foreground font-mono">{location.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/locations/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              {tCommon('edit')}
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.details')}</CardTitle>
              <CardDescription>{t('detail.locationInfo')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Nome</p>
                <p className="font-medium">{location.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Codice</p>
                <p className="font-mono">{location.code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tipo</p>
                <p>{location.location_type || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Capacità</p>
                <p>
                  {location.capacity_headcount ? `${location.capacity_headcount} persone` : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Stato</p>
                <Badge variant={location.is_active ? 'default' : 'secondary'}>
                  {location.is_active ? 'Attivo' : 'Inattivo'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.address')}</CardTitle>
              <CardDescription>{t('detail.geographicPosition')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3 sm:col-span-2">
                <Navigation className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Indirizzo Completo</p>
                  <p className="font-medium">
                    {[
                      location.address,
                      location.postal_code,
                      location.city,
                      location.province ? `(${location.province})` : null,
                      location.country,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Non specificato'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Città</p>
                  <p className="font-medium">{location.city || 'Non specificata'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Paese</p>
                  <p className="font-medium">{location.country || 'Non specificato'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.statistics')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Capacità
                </span>
                <span className="font-bold">{location.capacity_headcount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dipendenti Assegnati</span>
                <span className="font-bold">{location.employee_count || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.systemInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Creato</p>
                  <p>{new Date(location.created_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Aggiornato</p>
                  <p>{new Date(location.updated_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{location.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
