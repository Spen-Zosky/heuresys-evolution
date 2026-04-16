'use client';

import { AppShell } from '@/components/layouts/app-shell';
import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin Layout Content - Uses AuthProvider context
 */
function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Store current path for redirect after login
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        }
        router.replace('/login');
      } else {
        setReady(true);
      }
    }
  }, [isLoading, isAuthenticated, router]);

  // Loading state with skeleton matching AppShell structure
  if (isLoading || !ready) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton Header */}
        <div className="h-14 border-b bg-card px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        {/* Skeleton Content */}
        <div className="flex pt-14">
          <div className="w-64 border-r bg-sidebar p-4 space-y-2 hidden lg:block">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <main className="flex-1 p-6 space-y-4">
            <div className="flex items-center justify-center h-[50vh]">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Caricamento...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // User data for AppShell
  const appShellUser = user
    ? {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '',
        email: user.email || '',
        role: user.role || '',
        avatar: undefined, // Could add avatar URL if available
      }
    : {
        name: '',
        email: '',
        role: '',
      };

  return (
    <AppShell
      user={appShellUser}
      tenantCode={user?.tenant_code}
      tenantName={user?.tenant_name || user?.tenant_code}
    >
      {children}
    </AppShell>
  );
}

/**
 * Admin Root Layout
 * Provides authentication context and theme for all admin pages
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthProvider>
  );
}
