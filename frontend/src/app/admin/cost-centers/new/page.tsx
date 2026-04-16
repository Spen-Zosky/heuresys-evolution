'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CostCenterForm } from '@/components/forms/cost-center-form';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// NEW COST CENTER PAGE
// ============================================

export default function NewCostCenterPage() {
  const t = useTranslations('admin.costCenters.new');
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
          <Link href="/admin/cost-centers">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CircleDollarSign className="h-6 w-6 text-primary" />
            Nuovo Centro di Costo
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      {/* Form */}
      <CostCenterForm mode="create" />
    </motion.div>
  );
}
