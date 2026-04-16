'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { useAuth } from '@/lib/hooks/use-auth';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface PortalPageShellProps {
  title: string;
  description?: string;
  children: (employeeId: string) => ReactNode;
}

/**
 * Shared shell for portal pages that wrap an admin component in read-only mode.
 * Handles: auth guard, loading skeleton, error state, header with title + badge.
 * Child render function receives the authenticated employeeId.
 */
export function PortalPageShell({ title, description, children }: PortalPageShellProps) {
  const { user, isLoading } = useAuth();
  const t = useTranslations('portal');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!user?.employeeId) {
    return (
      <ApiError
        message="Profilo dipendente non disponibile per questo account"
        variant="notFound"
      />
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem} className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}
          >
            {title}
          </h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        <Badge variant="secondary">{t('personalView')}</Badge>
      </motion.div>

      <motion.div variants={staggerItem}>{children(user.employeeId)}</motion.div>
    </motion.div>
  );
}
