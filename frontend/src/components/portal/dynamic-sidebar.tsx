'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarNav } from '@/lib/hooks/use-sidebar-nav';
import { useAuth } from '@/lib/hooks/use-auth';
import { TenantLogo } from './tenant-logo';
import { Badge } from '@/components/ui/badge';
import type { NavSection } from '@/lib/navigation';

// ============================================================================
// DynamicSidebar — Accordion sidebar from RBP nav
// ============================================================================

interface SidebarSectionProps {
  section: NavSection;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
}

function SidebarSection({ section, pathname, isOpen, onToggle }: SidebarSectionProps) {
  return (
    <div className="mb-1">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between px-3 py-1.5',
          'text-[11px] uppercase font-bold tracking-wider',
          'text-muted-foreground hover:text-foreground',
          'transition-colors duration-150'
        )}
        aria-expanded={isOpen}
      >
        <span>{section.title}</span>
        <ChevronRight
          className={cn('h-3 w-3 transition-transform duration-200', isOpen && 'rotate-90')}
          aria-hidden="true"
        />
      </button>

      {/* Section Items — smooth collapse */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="mt-0.5 space-y-0.5 px-2">
          {section.items.map((item) => (
            <SidebarItem
              key={item.href}
              label={item.label}
              href={item.href}
              icon={item.icon}
              isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
              badge={item.badge}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SidebarItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: boolean;
  badge?: number;
}

function SidebarItem({ label, href, icon: Icon, isActive, badge }: SidebarItemProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm',
        'transition-colors duration-150',
        isActive
          ? 'bg-primary/10 text-primary font-semibold border-l-[2.5px] border-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground border-l-[2.5px] border-transparent'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge
          variant="secondary"
          className="ml-auto h-5 min-w-[20px] px-1 text-[10px] font-medium"
        >
          {badge}
        </Badge>
      )}
    </Link>
  );
}

export function DynamicSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  // Sections come pre-localized from useSidebarNav() which reads DB labels per locale
  const sections = useSidebarNav();

  // All sections open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      initial[s.title] = true;
    });
    return initial;
  });

  const toggleSection = useCallback((title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  }, []);

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-40',
        'w-[264px] h-[calc(100vh-32px)]',
        'bg-card border-r border-border',
        'flex flex-col'
      )}
      role="navigation"
      aria-label="Portal sidebar"
    >
      {/* Header — tenant logo */}
      <div className="flex items-center justify-center h-14 border-b border-border px-4 shrink-0">
        <TenantLogo tenantCode={user?.tenant_code || 'heuresys'} />
      </div>

      {/* Scrollable nav body */}
      <nav className="flex-1 overflow-y-auto py-3 px-1">
        {sections.map((section) => (
          <SidebarSection
            key={section.title}
            section={section}
            pathname={pathname}
            isOpen={openSections[section.title] !== false}
            onToggle={() => toggleSection(section.title)}
          />
        ))}
      </nav>
    </aside>
  );
}
