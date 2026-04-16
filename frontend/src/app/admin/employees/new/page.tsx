'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmployeeForm } from '@/components/forms/employee-form';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// NEW EMPLOYEE PAGE
// ============================================

export default function NewEmployeePage() {
  const t = useTranslations('admin.employees.new');
  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" asChild>
          <Link href="/admin/employees">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            Aggiungi un nuovo dipendente all&apos;anagrafica
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <EmployeeForm mode="create" />
    </motion.div>
  );
}
