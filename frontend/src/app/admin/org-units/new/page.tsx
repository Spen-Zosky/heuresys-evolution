'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrgUnitForm } from '@/components/forms/org-unit-form';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// NEW ORG UNIT PAGE
// ============================================

export default function NewOrgUnitPage() {
  const t = useTranslations('admin.orgUnits');
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
          <Link href="/admin/org-units">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" />
            {t('newUnit')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('newUnitDescription')}</p>
        </div>
      </motion.div>

      {/* Form */}
      <OrgUnitForm mode="create" />
    </motion.div>
  );
}
