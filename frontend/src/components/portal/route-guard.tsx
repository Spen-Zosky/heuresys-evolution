'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================================
// RouteGuard — Permission check wrapper
// ============================================================================

interface RouteGuardProps {
  area?: string;
  action?: string;
  children: React.ReactNode;
}

export function RouteGuard({ area, action, children }: RouteGuardProps) {
  const router = useRouter();
  const { isLoading, isAuthenticated, hasPermission } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Store current path for redirect after login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      }
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  // Not authenticated — redirect handled by useEffect
  if (!isAuthenticated) {
    return null;
  }

  // Permission check (only if area is specified)
  if (area) {
    const permissionKey = action ? `${area}:${action}` : area;
    if (!hasPermission(permissionKey)) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className={cn('flex flex-col items-center gap-4 text-center max-w-md px-4')}>
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <h2
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Accesso negato
            </h2>
            <p className="text-sm text-muted-foreground">
              Non hai i permessi necessari per accedere a questa sezione. Contatta il tuo
              amministratore per richiedere l&apos;accesso.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
