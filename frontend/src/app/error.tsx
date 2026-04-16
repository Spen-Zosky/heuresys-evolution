'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('[Global Error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const handleGoHome = () => {
    window.location.href = '/admin';
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{t('generic')}</CardTitle>
          <CardDescription className="text-base">{t('apology')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground font-mono break-all">
              {error.message || t('unknownError')}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('errorId')}: <code className="bg-muted px-1 rounded">{error.digest}</code>
              </p>
            )}
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>{t('whatYouCanDo')}:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('tryReloadPage')}</li>
              <li>{t('returnToDashboard')}</li>
              <li>{t('contactSupportIfPersists')}</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2 justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('tryAgain')}
          </Button>
          <Button onClick={handleReload} variant="outline">
            {t('reloadPage')}
          </Button>
          <Button onClick={handleGoHome} variant="ghost">
            <Home className="h-4 w-4 mr-2" />
            {t('goHome')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
