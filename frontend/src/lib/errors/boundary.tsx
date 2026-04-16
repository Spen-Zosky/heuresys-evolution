'use client';

/**
 * Heuresys Error Boundary
 *
 * Componente React per catturare errori di rendering e mostrare un fallback UI.
 * Conforme alla regola ZERO MOCK DATA: nessun fallback a dati demo.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  showDetails?: boolean;
  title?: string;
  description?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

/**
 * Error Boundary per catturare errori di rendering
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log dell'errore
    console.error('[ErrorBoundary] Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/admin';
  };

  handleCopyError = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const errorDetails = `
Errore: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      console.error('Failed to copy error details');
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, copied } = this.state;
    const { children, fallback, showDetails = false, title, description } = this.props;

    if (hasError) {
      // Se c'è un fallback custom, usalo
      if (fallback) {
        return fallback;
      }

      // UI di errore standard
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">{title || 'Si è verificato un errore'}</CardTitle>
              <CardDescription>
                {description ||
                  'Qualcosa è andato storto durante il caricamento di questa sezione.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Messaggio errore */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {error?.message || 'Errore sconosciuto'}
                </p>
              </div>

              {/* Dettagli errore (solo in dev) */}
              {showDetails && errorInfo && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Dettagli tecnici
                  </summary>
                  <pre className="mt-2 p-4 bg-muted rounded-lg overflow-auto max-h-48 text-xs">
                    {error?.stack}
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap gap-2 justify-center">
              <Button onClick={this.handleReset} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                Riprova
              </Button>
              <Button onClick={this.handleReload} variant="outline">
                Ricarica pagina
              </Button>
              <Button onClick={this.handleGoHome} variant="ghost">
                <Home className="h-4 w-4 mr-2" />
                Torna alla home
              </Button>
              <Button
                onClick={this.handleCopyError}
                variant="ghost"
                size="icon"
                aria-label="Copy"
                title="Copia dettagli errore"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook per creare un error boundary funzionale
 * Nota: Gli Error Boundary devono essere class components in React,
 * ma questo hook può essere usato per trigger errori
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    throwError: setError,
    resetError: () => setError(null),
  };
}

/**
 * Componente wrapper per sezioni con error boundary
 */
interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  name?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export function SafeSection({ children, name, onError }: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      onError={(error, info) => {
        console.error(`[${name || 'Section'}] Error:`, error);
        onError?.(error, info);
      }}
      title={`Errore in ${name || 'questa sezione'}`}
      description="Non è stato possibile caricare questa sezione. Prova a ricaricare la pagina."
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * HOC per wrappare componenti con error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<Props, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}
