'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Workflow, Building2, Users, Shield } from 'lucide-react';

const portals = [
  { href: '/company-pet/processes', key: 'processes', icon: Workflow },
  { href: '/company-pet/structure', key: 'structure', icon: Building2 },
  { href: '/company-pet/people', key: 'people', icon: Users },
  { href: '/company-pet/governance', key: 'governance', icon: Shield },
] as const;

export function PortalSwitcher() {
  const pathname = usePathname();
  const t = useTranslations('portal');

  return (
    <nav className="border-b bg-card px-4" aria-label={t('switchLabel')}>
      <div className="flex gap-1">
        {portals.map(({ href, key, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
