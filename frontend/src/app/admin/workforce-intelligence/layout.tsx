'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Search, Rocket, Sparkles, FlaskConical, BrainCircuit } from 'lucide-react';

const tabs = [
  {
    label: 'AI Search',
    href: '/admin/workforce-intelligence',
    icon: Search,
    exact: true,
  },
  {
    label: 'Career Simulator',
    href: '/admin/workforce-intelligence/career-simulator',
    icon: Rocket,
    exact: false,
  },
  {
    label: 'Skill Galaxy',
    href: '/admin/workforce-intelligence/skill-galaxy',
    icon: Sparkles,
    exact: false,
  },
  {
    label: 'What-If',
    href: '/admin/workforce-intelligence/what-if',
    icon: FlaskConical,
    exact: false,
  },
  {
    label: 'Org Dashboard',
    href: '/admin/workforce-intelligence/org-dashboard',
    icon: BrainCircuit,
    exact: false,
  },
];

export default function WorkforceIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(tab: (typeof tabs)[number]) {
    if (tab.exact) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workforce Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analisi semantica, simulazioni di carriera e insight organizzativi basati su ESCO e
          Knowledge Graph.
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
                'border-b-2 -mb-px',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      {children}
    </div>
  );
}
