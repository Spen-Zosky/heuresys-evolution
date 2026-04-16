'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { CostCenterForm } from '@/components/forms/cost-center-form';
import { api } from '@/lib/api';
import type { CostCenter } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// EDIT COST CENTER PAGE
// ============================================

export default function EditCostCenterPage() {
  const t = useTranslations('admin.costCenters.edit');
  const params = useParams();
  const id = params.id as string;

  const [costCenter, setCostCenter] = useState<CostCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostCenter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.costCenters.getCostCenterById(id);
      setCostCenter(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento centro di costo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCostCenter();
  }, [fetchCostCenter]);

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
        <ApiError message={error} onRetry={fetchCostCenter} />
      </div>
    );
  }

  if (!costCenter) {
    return (
      <div className="p-6">
        <ApiError message="Centro di costo non trovato" />
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
          <Link href={`/admin/cost-centers/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CircleDollarSign className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            Modifica &quot;{costCenter.name}&quot; ({costCenter.code})
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <CostCenterForm costCenter={costCenter} mode="edit" />
    </motion.div>
  );
}
