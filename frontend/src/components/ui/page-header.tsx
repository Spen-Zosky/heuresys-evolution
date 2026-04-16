'use client'

import { motion } from 'framer-motion'
import { easing } from '@/lib/motion-presets'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easing.out }
  }
}

/**
 * Consistent page header component with title, description, and optional action slot.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Dashboard"
 *   description="Overview of key HR metrics"
 * >
 *   <Button variant="outline" size="sm">
 *     <RefreshCw className="h-4 w-4 mr-2" />
 *     Refresh
 *   </Button>
 * </PageHeader>
 * ```
 */
export function PageHeader({
  title,
  description,
  children,
  className
}: PageHeaderProps) {
  return (
    <motion.div
      variants={headerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6',
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground font-display tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">
          {children}
        </div>
      )}
    </motion.div>
  )
}

interface PageSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * Section wrapper with optional title for organizing page content.
 */
export function PageSection({
  title,
  description,
  children,
  className
}: PageSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-lg font-semibold text-foreground font-display">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
