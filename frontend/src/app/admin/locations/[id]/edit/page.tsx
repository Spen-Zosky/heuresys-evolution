'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { LocationForm } from '@/components/forms/location-form';
import { api } from '@/lib/api';
import type { Location } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// EDIT LOCATION PAGE
// ============================================

export default function EditLocationPage() {
  const t = useTranslations('admin.locations');
  const params = useParams();
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

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
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
      className="space-y-6 p-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" asChild>
          <Link href={`/admin/locations/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            {t('editLocation')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('editingLocation', { name: location.name, code: location.code })}
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <LocationForm location={location} mode="edit" />
    </motion.div>
  );
}
