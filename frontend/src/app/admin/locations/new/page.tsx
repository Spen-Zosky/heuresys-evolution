'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationForm } from '@/components/forms/location-form';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// NEW LOCATION PAGE
// ============================================

export default function NewLocationPage() {
  const t = useTranslations('admin.locations');
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
          <Link href="/admin/locations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            {t('newLocation')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('newLocationDescription')}</p>
        </div>
      </motion.div>

      {/* Form */}
      <LocationForm mode="create" />
    </motion.div>
  );
}
