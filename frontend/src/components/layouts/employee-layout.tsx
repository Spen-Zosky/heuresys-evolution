'use client';

import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Target,
  GraduationCap,
  Calendar,
  FileText,
  Wallet,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { HeuresysLogo } from '@/components/branding/HeuresysLogo';

const portalNavItems = [
  { path: '/portal', label: 'Home', icon: LayoutDashboard },
  { path: '/portal/profile', label: 'Profilo', icon: Users },
  { path: '/portal/goals', label: 'I Miei Obiettivi', icon: Target },
  { path: '/portal/learning', label: 'Formazione', icon: GraduationCap },
  { path: '/portal/time-off', label: 'Ferie e Permessi', icon: Calendar },
  { path: '/portal/documents', label: 'Documenti', icon: FileText },
  { path: '/portal/payroll', label: 'Le Mie Buste Paga', icon: Wallet },
];

function PortalSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <nav
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b">
            <Link href="/portal">
              <HeuresysLogo size="xs" />
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-md hover:bg-muted"
              aria-label="Chiudi menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Il Mio Spazio
            </p>
            {portalNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.path ||
                (item.path !== '/portal' && pathname.startsWith(item.path + '/'));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User info + Logout */}
          {user && (
            <div className="border-t p-4 space-y-2">
              <div className="px-3">
                <p className="text-sm font-medium truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email || user.username}
                </p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Esci
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

function EmployeeLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else {
        setReady(true);
      }
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <PortalSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 rounded-md hover:bg-muted"
            aria-label="Apri menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <HeuresysLogo size="xs" />
          <div className="w-7" /> {/* Spacer for centering */}
        </header>

        <main className="flex-1 overflow-auto p-6" aria-label="Contenuto principale">
          {children}
        </main>
      </div>
    </div>
  );
}

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <EmployeeLayoutContent>{children}</EmployeeLayoutContent>
    </AuthProvider>
  );
}

export default EmployeeLayout;
