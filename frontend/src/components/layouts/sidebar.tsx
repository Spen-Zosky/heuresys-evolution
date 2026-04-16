'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from './app-shell';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSidebarNav } from '@/lib/hooks/use-sidebar-nav';
import { type NavItem as NavConfigItem } from '@/lib/navigation';

// ============================================================================
// Sidebar Component - RBAC Aware
// ============================================================================
interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const { toggle, isMobile, mobileOpen, setMobileOpen } = useSidebar();
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Close mobile sidebar on navigation
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    if (isMobile && mobileOpen) {
      setMobileOpen(false);
    }
  }, [pathname, isMobile, mobileOpen, setMobileOpen]);

  // Data-driven navigation from RBP API (with hardcoded fallback)
  const filteredSections = useSidebarNav();

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (children?: Omit<NavConfigItem, 'children' | 'icon'>[]): boolean =>
    children?.some((child) => pathname.startsWith(child.href)) ?? false;

  // Auto-expand parent when child is active
  useEffect(() => {
    const toExpand: string[] = [];
    filteredSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children && isParentActive(item.children)) {
          toExpand.push(item.label);
        }
      });
    });
    if (toExpand.length > 0) {
      setExpandedItems((prev) => {
        const newLabels = toExpand.filter((l) => !prev.includes(l));
        return newLabels.length > 0 ? [...prev, ...newLabels] : prev;
      });
    }
  }, [pathname, filteredSections]);

  // On mobile, sidebar is hidden by default and shown as overlay when mobileOpen
  // On desktop, sidebar is always visible and can be collapsed
  const isVisible = isMobile ? mobileOpen : true;

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 bottom-8 z-40',
        'bg-sidebar border-r border-sidebar-border',
        'transition-all duration-200 ease-out',
        // Desktop sizing
        collapsed ? 'lg:w-16' : 'lg:w-64',
        // Mobile: full-width overlay, hidden by default
        'w-64',
        isMobile && !mobileOpen && '-translate-x-full',
        isMobile && mobileOpen && 'translate-x-0 shadow-xl'
      )}
      role="navigation"
      aria-label="Navigazione principale"
      aria-hidden={!isVisible}
    >
      <div className="flex flex-col h-full">
        {/* Navigation Items */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-6">
            <TooltipProvider delayDuration={0}>
              {filteredSections.map((section) => (
                <div key={section.title}>
                  {/* Section Title */}
                  {!collapsed && (
                    <h3 className="mb-2 px-3 text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <NavItemComponent
                        key={item.href}
                        item={item}
                        collapsed={collapsed}
                        isActive={isActive(item.href)}
                        isParentActive={isParentActive(item.children)}
                        isExpanded={expandedItems.includes(item.label)}
                        onToggleExpanded={() => toggleExpanded(item.label)}
                        pathname={pathname}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </TooltipProvider>
          </nav>
        </ScrollArea>

        {/* User Role Badge */}
        {user && !collapsed && (
          <div className="px-3 py-2 border-t border-sidebar-border">
            <div className="text-xs text-sidebar-foreground/50">
              Ruolo: <span className="font-medium text-sidebar-foreground">{user.role}</span>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              'w-full justify-center',
              'text-sidebar-foreground/70 hover:text-sidebar-foreground',
              'hover:bg-sidebar-accent'
            )}
            aria-label={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Comprimi</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// NavItem Component - Updated for RBAC config
// ============================================================================
interface NavItemComponentProps {
  item: NavConfigItem;
  collapsed: boolean;
  isActive: boolean;
  isParentActive: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  pathname: string;
}

function NavItemComponent({
  item,
  collapsed,
  isActive,
  isParentActive,
  isExpanded,
  onToggleExpanded,
  pathname,
}: NavItemComponentProps) {
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;

  // Single link item
  if (!hasChildren) {
    const content = (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md',
          'text-sm font-medium',
          'transition-colors duration-150',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          collapsed && 'justify-center px-2'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="flex-1">{item.label}</span>}
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  }

  // Group with children
  const groupButton = (
    <button
      onClick={collapsed ? undefined : onToggleExpanded}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md w-full',
        'text-sm font-medium',
        'transition-colors duration-150',
        isParentActive || isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-2'
      )}
      aria-expanded={!collapsed && isExpanded}
      aria-controls={!collapsed ? `nav-group-${item.label}` : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRight
            className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-90')}
            aria-hidden="true"
          />
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{groupButton}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="p-0">
          <div className="py-2">
            <div className="px-3 py-1 text-sm font-medium text-foreground">{item.label}</div>
            <div className="mt-1">
              {item.children?.map((subItem) => (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  className={cn(
                    'block px-3 py-1.5 text-sm',
                    pathname === subItem.href
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {subItem.label}
                </Link>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      {groupButton}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`nav-group-${item.label}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-6 mt-1 space-y-1 border-l border-sidebar-border pl-3">
              {item.children?.map((subItem) => (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  className={cn(
                    'block py-1.5 px-2 rounded-md text-sm',
                    'transition-colors duration-150',
                    pathname === subItem.href
                      ? 'text-sidebar-primary font-medium bg-sidebar-accent'
                      : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                  aria-current={pathname === subItem.href ? 'page' : undefined}
                >
                  {subItem.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
