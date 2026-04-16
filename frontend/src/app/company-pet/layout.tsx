'use client';

import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  History,
  Network,
  GitBranch,
  PieChart,
  ArrowLeftRight,
  Building2,
  TrendingUp,
  Users,
  UserCircle,
  Sparkles,
  MapPin,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronRightIcon,
  Home,
} from 'lucide-react';
import { PortalSwitcher } from '@/components/navigation/PortalSwitcher';

const sections = [
  {
    name: 'Panoramica',
    items: [
      { path: '/company-pet', label: 'Centro Comandi', icon: LayoutDashboard },
      { path: '/company-pet/sessions', label: 'Sessioni AI', icon: History },
      { path: '/company-pet/org-chart', label: 'Organigramma', icon: Network },
      { path: '/company-pet/hierarchy', label: 'Gerarchia', icon: GitBranch },
      { path: '/company-pet/breakdowns', label: 'Analisi Dettagliata', icon: PieChart },
      { path: '/company-pet/staging-comparison', label: 'Confronto Scenari', icon: ArrowLeftRight },
      { path: '/company-pet/processes', label: 'Processi', icon: GitBranch },
      { path: '/company-pet/structure', label: 'Struttura', icon: Building2 },
    ],
  },
  {
    name: 'Organizzazione',
    items: [
      { path: '/company-pet/organization', label: 'Panoramica', icon: Building2 },
      { path: '/company-pet/organization/performance', label: 'Prestazioni', icon: TrendingUp },
      { path: '/company-pet/organization/talent', label: 'Talento', icon: Sparkles },
      { path: '/company-pet/organization/analytics', label: 'Analisi', icon: BarChart3 },
    ],
  },
  {
    name: 'Risorse Umane',
    items: [
      { path: '/company-pet/people', label: 'Persone', icon: UserCircle },
      { path: '/company-pet/workforce', label: 'Organico', icon: Users },
      { path: '/company-pet/workforce/demographics', label: 'Dati Demografici', icon: PieChart },
      { path: '/company-pet/workforce/locations', label: 'Sedi', icon: MapPin },
    ],
  },
];

function CompanyPETSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Panoramica: true,
    Organizzazione: true,
    'Risorse Umane': true,
  });

  const toggleSection = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <nav className="w-64 min-h-screen border-r bg-card p-4 space-y-2">
      <div className="px-3 py-2 mb-4">
        <h2 className="text-lg font-bold">Company PET</h2>
        <p className="text-xs text-muted-foreground">People, Economy & Talent</p>
      </div>
      {sections.map((section) => (
        <div key={section.name}>
          <button
            onClick={() => toggleSection(section.name)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-md"
            aria-label={
              expanded[section.name]
                ? `Comprimi sezione ${section.name}`
                : `Espandi sezione ${section.name}`
            }
            aria-expanded={expanded[section.name]}
          >
            {section.name}
            {expanded[section.name] ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          {expanded[section.name] && (
            <div className="ml-2 space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
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
          )}
        </div>
      ))}
    </nav>
  );
}

const portalLabels: Record<string, string> = {
  '/company-pet/processes': 'Processi',
  '/company-pet/structure': 'Struttura',
  '/company-pet/people': 'Persone',
};

function PortalBreadcrumb() {
  const pathname = usePathname();
  const activePortal = Object.entries(portalLabels).find(([href]) => pathname.startsWith(href));

  return (
    <nav
      className="px-6 py-2 text-sm text-muted-foreground flex items-center gap-1"
      aria-label="Breadcrumb"
    >
      <Link href="/" className="hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
      </Link>
      <ChevronRightIcon className="h-3 w-3" />
      <Link href="/company-pet" className="hover:text-foreground">
        Company PET
      </Link>
      {activePortal && (
        <>
          <ChevronRightIcon className="h-3 w-3" />
          <span className="text-foreground font-medium">{activePortal[1]}</span>
        </>
      )}
    </nav>
  );
}

function CompanyPETLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);

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
        <p>Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <CompanyPETSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <PortalSwitcher />
        <PortalBreadcrumb />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function CompanyPETLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CompanyPETLayoutContent>{children}</CompanyPETLayoutContent>
    </AuthProvider>
  );
}
