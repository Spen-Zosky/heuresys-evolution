/**
 * API Error Display Component - Heuresys Platform
 *
 * Componente standard per mostrare errori API.
 * Compliance: BEHAVIOR_RULES R004 - Zero Mock Data
 *
 * Usage:
 * ```tsx
 * if (error || !data) {
 *   return <ApiError onRetry={() => refetch()} />
 * }
 * ```
 */

'use client'

import { AlertCircle, RefreshCw, WifiOff, ShieldX, FileX } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent } from './card'
import { cn } from '@/lib/utils'

interface ApiErrorProps {
  /** Error message to display */
  message?: string
  /** Error title */
  title?: string
  /** Callback for retry button */
  onRetry?: () => void
  /** Show retry button */
  showRetry?: boolean
  /** Error variant */
  variant?: 'default' | 'network' | 'auth' | 'notFound' | 'forbidden'
  /** Additional class names */
  className?: string
  /** Compact mode for inline errors */
  compact?: boolean
}

const ERROR_CONFIGS = {
  default: {
    icon: AlertCircle,
    title: 'API/Dati Non Disponibili',
    message: 'Impossibile caricare i dati. Verifica la connessione e riprova.',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  network: {
    icon: WifiOff,
    title: 'Errore di Connessione',
    message: 'Impossibile connettersi al server. Verifica la tua connessione internet.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  auth: {
    icon: ShieldX,
    title: 'Sessione Scaduta',
    message: 'La tua sessione è scaduta. Effettua nuovamente il login.',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  notFound: {
    icon: FileX,
    title: 'Risorsa Non Trovata',
    message: 'La risorsa richiesta non esiste o è stata rimossa.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  forbidden: {
    icon: ShieldX,
    title: 'Accesso Negato',
    message: 'Non hai i permessi necessari per visualizzare questa risorsa.',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
}

export function ApiError({
  message,
  title,
  onRetry,
  showRetry = true,
  variant = 'default',
  className,
  compact = false,
}: ApiErrorProps) {
  const config = ERROR_CONFIGS[variant]
  const Icon = config.icon

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', config.color, className)}>
        <Icon className="h-4 w-4" />
        <span>{message || config.message}</span>
        {showRetry && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-6 px-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Riprova
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="p-8 sm:p-12">
        <div className="flex flex-col items-center text-center space-y-4">
          <div
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center',
              config.bgColor
            )}
          >
            <Icon className={cn('h-8 w-8', config.color)} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              {title || config.title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {message || config.message}
            </p>
          </div>

          {showRetry && onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Loading Skeleton Component
 */
interface LoadingSkeletonProps {
  className?: string
  rows?: number
}

export function LoadingSkeleton({ className, rows = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  )
}

/**
 * Empty State Component
 */
interface EmptyStateProps {
  title?: string
  message?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  title = 'Nessun dato',
  message = 'Non ci sono dati da visualizzare.',
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="p-8 sm:p-12">
        <div className="flex flex-col items-center text-center space-y-4">
          {icon && (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              {icon}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
          </div>

          {action}
        </div>
      </CardContent>
    </Card>
  )
}
