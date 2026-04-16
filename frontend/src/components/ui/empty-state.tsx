'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from './button'
import {
  FileQuestion,
  Search,
  Users,
  Target,
  BookOpen,
  Inbox,
  Calendar,
  FolderOpen,
  TrendingUp,
  BarChart3,
  Award,
  Heart,
  Clock,
  Bell,
  Briefcase,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react'

// ============================================================================
// Icons Registry
// ============================================================================
const emptyStateIcons: Record<string, LucideIcon> = {
  default: FileQuestion,
  search: Search,
  users: Users,
  goals: Target,
  courses: BookOpen,
  inbox: Inbox,
  calendar: Calendar,
  files: FolderOpen,
  analytics: BarChart3,
  trends: TrendingUp,
  recognition: Award,
  engagement: Heart,
  timeoff: Clock,
  alerts: Bell,
  positions: Briefcase,
  learning: GraduationCap,
}

// ============================================================================
// Branded Messages (Heuresys Voice)
// ============================================================================
const brandedMessages: Record<string, { title: string; description: string }> = {
  departments: {
    title: 'Nessun dipartimento configurato',
    description: 'Inizia configurando la struttura organizzativa per visualizzare i dati.',
  },
  goals: {
    title: 'Nessun obiettivo definito',
    description: 'Gli obiettivi aiutano il team a crescere. Crea il primo obiettivo!',
  },
  reviews: {
    title: 'Nessuna valutazione attiva',
    description: 'Le valutazioni periodiche migliorano le performance. Iniziamo?',
  },
  courses: {
    title: 'Catalogo corsi vuoto',
    description: 'La formazione continua è la chiave del successo. Aggiungi un corso!',
  },
  alerts: {
    title: 'Tutto sotto controllo',
    description: 'Non ci sono azioni urgenti in attesa. Ottimo lavoro!',
  },
  analytics: {
    title: 'Dati insufficienti',
    description: 'Servono più dati per generare analytics significative.',
  },
  employees: {
    title: 'Nessun dipendente',
    description: 'Inizia aggiungendo i membri del tuo team.',
  },
  trends: {
    title: 'Trend non disponibile',
    description: 'I dati storici verranno visualizzati dopo alcune settimane.',
  },
  recognition: {
    title: 'Nessun riconoscimento',
    description: 'I riconoscimenti aumentano il morale. Celebra i successi!',
  },
  engagement: {
    title: 'Survey non attive',
    description: 'Misura il coinvolgimento del team con sondaggi periodici.',
  },
}

// ============================================================================
// Types
// ============================================================================
interface EmptyStateProps {
  /** Type of empty state - determines icon and optional default message */
  type?: keyof typeof emptyStateIcons
  /** Custom icon component */
  icon?: LucideIcon
  /** Main title - overrides branded message if provided */
  title?: string
  /** Description text - overrides branded message if provided */
  description?: string
  /** Primary action button */
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'secondary'
  }
  /** Secondary action link */
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  /** Additional className */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Disable animation */
  noAnimation?: boolean
}

// ============================================================================
// Component: EmptyState
// ============================================================================
export function EmptyState({
  type = 'default',
  icon: CustomIcon,
  title: customTitle,
  description: customDescription,
  action,
  secondaryAction,
  className,
  size = 'md',
  noAnimation = false,
}: EmptyStateProps) {
  const Icon = CustomIcon || emptyStateIcons[type] || emptyStateIcons.default
  const brandedMessage = brandedMessages[type]

  const title = customTitle || brandedMessage?.title || 'Nessun dato'
  const description = customDescription || brandedMessage?.description

  const sizeClasses = {
    sm: {
      container: 'py-6',
      icon: 'h-6 w-6',
      iconBg: 'h-12 w-12',
      title: 'text-sm',
      description: 'text-xs',
    },
    md: {
      container: 'py-10',
      icon: 'h-8 w-8',
      iconBg: 'h-16 w-16',
      title: 'text-base',
      description: 'text-sm',
    },
    lg: {
      container: 'py-16',
      icon: 'h-10 w-10',
      iconBg: 'h-20 w-20',
      title: 'text-lg',
      description: 'text-base',
    },
  }

  const sizes = sizeClasses[size]

  // Content elements
  const iconElement = (
    <div
      className={cn(
        'flex items-center justify-center rounded-full mb-4',
        'bg-gradient-to-br from-muted to-muted/50',
        'ring-1 ring-border/50',
        sizes.iconBg
      )}
    >
      <Icon className={cn('text-muted-foreground', sizes.icon)} />
    </div>
  )

  const titleElement = (
    <h3 className={cn('font-semibold text-foreground mb-1', sizes.title)}>
      {title}
    </h3>
  )

  const descriptionElement = description && (
    <p className={cn('text-muted-foreground max-w-sm mb-4', sizes.description)}>
      {description}
    </p>
  )

  const actionsElement = (action || secondaryAction) && (
    <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
      {action && (
        <Button
          variant={action.variant || 'default'}
          size={size === 'sm' ? 'sm' : 'default'}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
      {secondaryAction && (
        <Button
          variant="ghost"
          size={size === 'sm' ? 'sm' : 'default'}
          onClick={secondaryAction.onClick}
        >
          {secondaryAction.label}
        </Button>
      )}
    </div>
  )

  // Non-animated version
  if (noAnimation) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center',
          sizes.container,
          className
        )}
      >
        {iconElement}
        {titleElement}
        {descriptionElement}
        {actionsElement}
      </div>
    )
  }

  // Animated version
  return (
    <motion.div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizes.container,
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {iconElement}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {titleElement}
      </motion.div>

      {description && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          {descriptionElement}
        </motion.div>
      )}

      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          {actionsElement}
        </motion.div>
      )}
    </motion.div>
  )
}

// ============================================================================
// Component: SearchEmptyState
// ============================================================================
export function SearchEmptyState({
  query,
  onClear,
  className,
}: {
  query: string
  onClear?: () => void
  className?: string
}) {
  return (
    <EmptyState
      type="search"
      title="Nessun risultato trovato"
      description={`Nessun risultato per "${query}". Prova con termini diversi.`}
      action={onClear ? { label: 'Cancella ricerca', onClick: onClear, variant: 'outline' } : undefined}
      className={className}
    />
  )
}

// ============================================================================
// Component: TableEmptyState
// ============================================================================
export function TableEmptyState({
  entityName,
  onAdd,
  className,
}: {
  entityName: string
  onAdd?: () => void
  className?: string
}) {
  return (
    <EmptyState
      type="inbox"
      title={`Nessun ${entityName}`}
      description={`Non ci sono ${entityName} da visualizzare.`}
      action={onAdd ? { label: `Aggiungi ${entityName}`, onClick: onAdd } : undefined}
      size="sm"
      className={className}
    />
  )
}

// ============================================================================
// Component: DashboardEmptyState (for dashboard widgets)
// ============================================================================
export function DashboardEmptyState({
  type,
  onAction,
  actionLabel,
  className,
}: {
  type: keyof typeof brandedMessages
  onAction?: () => void
  actionLabel?: string
  className?: string
}) {
  const message = brandedMessages[type] || brandedMessages.default

  return (
    <EmptyState
      type={type as keyof typeof emptyStateIcons}
      title={message?.title}
      description={message?.description}
      action={onAction && actionLabel ? { label: actionLabel, onClick: onAction } : undefined}
      size="sm"
      className={className}
    />
  )
}

// ============================================================================
// Component: SuccessEmptyState (for "no items needed" states)
// ============================================================================
export function SuccessEmptyState({
  title = 'Tutto sotto controllo',
  description = 'Non ci sono elementi che richiedono attenzione.',
  className,
}: {
  title?: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('text-center py-6', className)}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mb-3"
      >
        <svg
          className="h-6 w-6 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-sm font-medium text-foreground"
      >
        {title}
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-xs text-muted-foreground mt-1"
      >
        {description}
      </motion.p>
    </div>
  )
}
