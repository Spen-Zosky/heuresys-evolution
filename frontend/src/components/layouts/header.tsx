'use client';

import Link from 'next/link';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslations } from 'next-intl';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Search,
  LogOut,
  Settings,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { HeuresysLogo } from '@/components/branding/HeuresysLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { clearAuthToken, setCurrentTenant, getSelectedTenant } from '@/lib/api-config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';

// ============================================================================
// Header Props
// ============================================================================
interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  tenantCode?: string;
  tenantName?: string;
  onToggleSidebar: () => void;
}

const ALL_TENANTS = [
  { code: 'heuresys', label: 'Heuresys System' },
  { code: 'rtl-bank', label: 'RTL Bank' },
  { code: 'smartfood', label: 'SmartFood' },
  { code: 'econova', label: 'EcoNova' },
];

// ============================================================================
// Header Component
// ============================================================================
export function Header({ user, tenantCode, tenantName, onToggleSidebar }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('nav');
  const tTheme = useTranslations('theme');
  const tHeader = useTranslations('header');
  const notifications = 0;

  const TENANT_LABELS: Record<string, string> = {
    'rtl-bank': 'RTL Bank',
    smartfood: 'SmartFood',
    econova: 'EcoNova',
    heuresys: 'Heuresys System',
  };
  const _displayTenantName = tenantCode
    ? TENANT_LABELS[tenantCode] || tenantName || tenantCode
    : tenantName;

  const userInitials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const handleTenantSwitch = (code: string) => {
    if (code === '__all__') {
      // "Tutti" — rimuove il filtro tenant per SUPERUSER
      if (typeof window !== 'undefined') {
        localStorage.removeItem('heuresys_tenant');
      }
    } else {
      setCurrentTenant(code);
    }
    window.location.reload();
  };

  const isSuperuser = user.role === 'SUPERUSER';
  const activeTenantCode = getSelectedTenant();
  const activeTenantLabel = activeTenantCode
    ? ALL_TENANTS.find((t) => t.code === activeTenantCode)?.label || activeTenantCode
    : t('allTenants');

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'h-14 bg-card border-b border-border',
        'flex items-center justify-between px-4'
      )}
      role="banner"
    >
      {/* Left Section: Menu + Logo + Tenant */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="lg:hidden"
          aria-label={t('openMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <Link
          href="/admin"
          prefetch={false}
          className="flex items-center"
          aria-label="Heuresys Dashboard"
        >
          <HeuresysLogo size="xs" />
        </Link>

        {/* Tenant Switcher — solo per SUPERUSER */}
        {isSuperuser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-[150px] truncate hidden sm:inline">{activeTenantLabel}</span>
                <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{t('filterByTenant')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleTenantSwitch('__all__')}
                className={cn(!activeTenantCode && 'bg-accent font-medium')}
              >
                <Building2 className="h-4 w-4 mr-2" />
                {t('allTenants')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {ALL_TENANTS.map((t) => (
                <DropdownMenuItem
                  key={t.code}
                  onClick={() => handleTenantSwitch(t.code)}
                  className={cn(activeTenantCode === t.code && 'bg-accent font-medium')}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Center Section: Search (Optional) */}
      <div className="hidden lg:flex flex-1 max-w-md mx-8">
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={() => undefined}
        >
          <Search className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t('search')}</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      {/* Right Section: Actions + User */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={t('notifications')}
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
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex justify-between">
              {t('notifications')}
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                {t('markAllRead')}
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('noNotifications')}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language Switcher */}
        <LanguageSwitcher />

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

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 pl-2 pr-3"
              aria-label={tHeader('userMenu')}
            >
              <Avatar className="h-8 w-8">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium leading-none">{user.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{user.role}</div>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-normal">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* P9 debt: user-menu links hardcoded. Future work: resolve
                from /api/rbp/my-permissions. Removed /admin/profile because
                the page doesn't exist (dead link). Settings kept because
                /admin/settings/page.tsx exists. */}
            <DropdownMenuItem asChild>
              <Link href="/admin/settings" prefetch={false}>
                <Settings className="h-4 w-4 mr-2" />
                {t('settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
