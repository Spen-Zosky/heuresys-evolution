'use client';

import {
  useState,
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Footer } from './footer';

// ============================================================================
// Context for sidebar state
// ============================================================================
interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within AppShell');
  }
  return context;
}

// ============================================================================
// AppShell Props
// ============================================================================
interface AppShellProps {
  children: ReactNode;
  user: {
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  tenantCode?: string;
  tenantName?: string;
}

// ============================================================================
// AppShell Component
// ============================================================================
export function AppShell({ children, user, tenantCode, tenantName }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const t = useTranslations('nav');

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  return (
    <SidebarContext.Provider
      value={{ collapsed, setCollapsed, toggle, isMobile, mobileOpen, setMobileOpen }}
    >
      <div className="min-h-screen flex flex-col bg-background">
        {/* Skip to main content - Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {t('skipToMain')}
        </a>

        {/* Fixed Header */}
        <Header
          user={user}
          tenantCode={tenantCode}
          tenantName={tenantName}
          onToggleSidebar={toggle}
        />

        {/* Mobile Overlay Backdrop */}
        <AnimatePresence>
          {isMobile && mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* Main Layout: Sidebar + Content */}
        <div className="flex flex-1 pt-14">
          {/* Fixed Sidebar - Hidden on mobile unless open */}
          <Sidebar collapsed={collapsed} />

          {/* Main Content Area */}
          <main
            id="main-content"
            ref={mainRef}
            className={cn(
              'flex-1 min-h-[calc(100vh-3.5rem-2rem)]',
              'overflow-y-auto',
              'transition-[margin] duration-200 ease-out',
              // Mobile: no margin (sidebar is overlay)
              // Desktop: margin based on collapsed state
              'lg:ml-16',
              !collapsed && 'lg:ml-64'
            )}
            tabIndex={-1}
            aria-label="Contenuto principale"
          >
            <div className="p-4 sm:p-6 pb-12">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>

        {/* Fixed Footer */}
        <Footer />
      </div>
    </SidebarContext.Provider>
  );
}
