'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================================
// Animation Variants
// ============================================================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

// ============================================================================
// Component: KPICardSkeleton
// ============================================================================
function KPICardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            {/* Label */}
            <Skeleton className="h-4 w-24" />
            {/* Value */}
            <Skeleton className="h-9 w-20" />
            {/* Trend badge */}
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* Sparkline placeholder */}
          <div className="w-20 h-12 flex items-end gap-0.5">
            {[40, 65, 45, 80, 55, 70, 50, 85].map((height, i) => (
              <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component: ChartCardSkeleton
// ============================================================================
function ChartCardSkeleton({ type = 'bar' }: { type?: 'bar' | 'donut' }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </CardHeader>
      <CardContent>
        {type === 'bar' ? (
          <div className="space-y-3">
            {[75, 90, 55, 80, 65, 45].map((width, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-8" />
                </div>
                <Skeleton className="h-2 rounded-full" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <div className="relative">
              {/* Donut chart placeholder */}
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="absolute inset-4 bg-background rounded-full" />
              {/* Center text placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-1">
                  <Skeleton className="h-6 w-12 mx-auto" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component: AlertsCardSkeleton
// ============================================================================
function AlertsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component: ActivityCardSkeleton
// ============================================================================
function ActivityCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component: DashboardSkeleton (Main Export)
// ============================================================================
export function DashboardSkeleton() {
  return (
    <motion.div
      className="space-y-6 min-h-[calc(100vh-8rem)]"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      aria-busy="true"
      aria-label="Caricamento dashboard in corso"
    >
      {/* Header section */}
      <motion.div
        variants={itemVariants}
        className="flex justify-between items-start min-h-[3.5rem]"
      >
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </motion.div>

      {/* KPI Bento Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 lg:grid-rows-2 gap-4 min-h-[12rem]"
      >
        <div className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
          <Card className="h-full">
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-10 w-full mt-4" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <KPICardSkeleton />
        </div>
        <div className="lg:col-span-2">
          <KPICardSkeleton />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <KPICardSkeleton />
        </div>
      </motion.div>

      {/* Charts Row — asymmetric 3:2 */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[16rem]"
      >
        <div className="lg:col-span-3">
          <ChartCardSkeleton type="bar" />
        </div>
        <div className="lg:col-span-2">
          <ChartCardSkeleton type="donut" />
        </div>
      </motion.div>

      {/* Bottom Row — asymmetric 2:3 */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[14rem]"
      >
        <div className="lg:col-span-2">
          <AlertsCardSkeleton />
        </div>
        <div className="lg:col-span-3">
          <ActivityCardSkeleton />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default DashboardSkeleton;
