'use client';

import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DynamicSidebar } from './dynamic-sidebar';
import { PortalHeader } from './portal-header';
import { PortalFooter } from './portal-footer';

// ============================================================================
// PortalLayout — Assembles sidebar, header, content, footer
// ============================================================================

function PortalLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);
  const tCommon = useTranslations('common');

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

  // Loading skeleton matching portal structure
  if (isLoading || !ready) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton Header */}
        <div className="h-14 border-b bg-card px-4 flex items-center justify-between ml-[264px]">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        {/* Skeleton Sidebar + Content */}
        <div className="flex">
          <div className="w-[264px] border-r bg-card p-4 space-y-2 shrink-0">
            <Skeleton className="h-8 w-full mb-4" />
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <main className="flex-1 p-6">
            <div className="flex items-center justify-center h-[50vh]">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Grain texture overlay for glassmorphism depth */}
      <div className="pointer-events-none absolute inset-0 bg-grain" />
      <DynamicSidebar />
      <PortalHeader />
      <main
        className="relative min-h-screen"
        style={{
          marginLeft: '264px',
          paddingTop: '80px',
          paddingBottom: '56px',
          paddingLeft: '24px',
          paddingRight: '24px',
        }}
      >
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PortalLayoutContent>{children}</PortalLayoutContent>
    </AuthProvider>
  );
}
