'use client';

import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Dashboards Layout Content - Auth guard for dev/prototyping pages
 */
function DashboardsLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        }
        router.replace('/login');
      } else {
        setReady(true);
      }
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Dashboards Root Layout
 * Provides authentication guard for all dashboard/prototyping pages
 */
export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardsLayoutContent>{children}</DashboardsLayoutContent>
    </AuthProvider>
  );
}
