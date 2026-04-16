'use client'

/**
 * Client-side Error Provider Wrapper
 *
 * Wrapper per il context di gestione errori da usare nel layout root.
 */

import { ReactNode } from 'react'
import { ErrorProvider } from '@/lib/errors/context'
import { Toaster } from '@/components/ui/sonner'

interface Props {
  children: ReactNode
}

export function ErrorProviderWrapper({ children }: Props) {
  return (
    <ErrorProvider
      enableToasts={true}
      logErrors={process.env.NODE_ENV !== 'production'}
      onCriticalError={(error) => {
        // Log errori critici a sistema esterno (futuro: Sentry)
        console.error('[CRITICAL ERROR]', error)
      }}
    >
      {children}
      <Toaster
        position="top-right"
        closeButton
        richColors
        expand={false}
        duration={5000}
        toastOptions={{
          classNames: {
            toast: 'font-sans',
            title: 'font-medium',
            description: 'text-sm text-muted-foreground'
          }
        }}
      />
    </ErrorProvider>
  )
}
