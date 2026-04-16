'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { OrgUnitForm } from '@/components/forms/org-unit-form';
import { api } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// EDIT ORG UNIT PAGE
// ============================================

export default function EditOrgUnitPage() {
  const t = useTranslations('admin.orgUnits');
  const params = useParams();
  const id = params.id as string;

  const [orgUnit, setOrgUnit] = useState<OrgUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgUnit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.orgUnits.getOrgUnitById(id);
      setOrgUnit(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento unità');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrgUnit();
  }, [fetchOrgUnit]);

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
        <ApiError message={error} onRetry={fetchOrgUnit} />
      </div>
    );
  }

  if (!orgUnit) {
    return (
      <div className="p-6">
        <ApiError message="Unità organizzativa non trovata" />
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
          <Link href={`/admin/org-units/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" />
            {t('editUnit')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('editingUnit', { name: orgUnit.name, code: orgUnit.code })}
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <OrgUnitForm orgUnit={orgUnit} mode="edit" />
    </motion.div>
  );
}
