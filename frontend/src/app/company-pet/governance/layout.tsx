'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, GraduationCap, DollarSign, UserSearch } from 'lucide-react';

const tabs = [
  { href: '/company-pet/governance/performance', label: 'Performance', icon: BarChart3 },
  { href: '/company-pet/governance/learning', label: 'L&D', icon: GraduationCap },
  { href: '/company-pet/governance/compensation', label: 'Compensation', icon: DollarSign },
  { href: '/company-pet/governance/recruiting', label: 'Recruiting', icon: UserSearch },
] as const;

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r bg-card p-3 space-y-1">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Governance
        </p>
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-auto p-6">{children}</main>
    </div>
  );
}
