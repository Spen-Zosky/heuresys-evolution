'use client';

import Link from 'next/link';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslations } from 'next-intl';
import { Sun, Moon, Bell, Search, User, LogOut, ChevronDown } from 'lucide-react';
import { GlobalSearchDialog } from '@/components/portal/global-search-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { clearAuthToken } from '@/lib/api-config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/hooks/use-auth';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';
import { DashboardSwitcher } from './dashboard-switcher';

// ============================================================================
// PortalHeader — Glass morphism header for Employee Portal
// ============================================================================

export function PortalHeader() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const tHeader = useTranslations('header');
  const tTheme = useTranslations('theme');
  const notifications = 0;

  const userName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || ''
    : '';

  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const userSubtitle = user?.jobTitle || user?.role || '';

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-50',
        'h-14 border-b border-border',
        'flex items-center justify-between px-4',
        'left-[264px]'
      )}
      style={{
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        backgroundColor: 'hsl(var(--card) / 0.8)',
      }}
      role="banner"
    >
      {/* Left: Dashboard Title */}
      <div className="flex items-center gap-3">
        <h1
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          {tNav('employeePortal')}
        </h1>
      </div>

      {/* Center: Search Trigger */}
      <div className="hidden lg:flex flex-1 max-w-md mx-8">
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={() => window.dispatchEvent(new CustomEvent('global-search:open'))}
        >
          <Search className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{tNav('search')}</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      {/* Right: Actions + User */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? tTheme('light') : tTheme('dark')}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={tNav('notifications')}
            >
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                >
                  {notifications}
                </Badge>
              )}
              {notifications > 0 && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex justify-between">
              {tNav('notifications')}
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                {tNav('markAllRead')}
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-4 text-center text-sm text-muted-foreground">
              {tNav('noNotifications')}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dashboard Switcher */}
        <DashboardSwitcher />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 pl-2 pr-3"
              aria-label={tHeader('userMenu')}
            >
              <Avatar className="h-8 w-8 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
                <AvatarImage src={undefined} alt={userName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium leading-none">{userName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{userSubtitle}</div>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-normal">
                <div className="font-medium">{userName}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* P9 debt: user-menu links hardcoded. Future work: resolve
                from /api/rbp/my-permissions or a dedicated rbp_user_menu
                table. Removed /portal/settings because the page doesn't
                exist (dead link). */}
            <DropdownMenuItem asChild>
              <Link href="/portal/profile" prefetch={false}>
                <User className="h-4 w-4 mr-2" />
                {tNav('profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {tAuth('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <GlobalSearchDialog />
    </header>
  );
}
