'use client';

import { useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PlatformError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[Platform Error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center p-8 min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Errore nella Piattaforma</CardTitle>
          <CardDescription>
            Si è verificato un problema durante il caricamento di questa pagina.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground font-mono break-all">
              {error.message || 'Errore sconosciuto'}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                ID Errore: <code className="bg-muted px-1 rounded">{error.digest}</code>
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex gap-2 justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Riprova
          </Button>
          <Button onClick={() => (window.location.href = '/platform')} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Torna alla Piattaforma
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
