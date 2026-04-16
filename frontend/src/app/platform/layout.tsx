'use client';

import { AppShell } from '@/components/layouts/app-shell';
import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function PlatformLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        }
        router.replace('/login');
      } else if (user?.role !== 'SUPERUSER') {
        router.replace('/403');
      } else {
        setReady(true);
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !ready) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b bg-card px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="flex pt-14">
          <div className="w-64 border-r bg-sidebar p-4 space-y-2 hidden lg:block">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <main className="flex-1 p-6 space-y-4">
            <div className="flex items-center justify-center h-[50vh]">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Caricamento piattaforma...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const appShellUser = user
    ? {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '',
        email: user.email || '',
        role: user.role || '',
        avatar: undefined,
      }
    : {
        name: '',
        email: '',
        role: '',
      };

  return (
    <AppShell user={appShellUser} tenantCode={user?.tenant_code} tenantName={user?.tenant_code}>
      {children}
    </AppShell>
  );
}

export default function PlatformRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PlatformLayoutContent>{children}</PlatformLayoutContent>
    </AuthProvider>
  );
}
