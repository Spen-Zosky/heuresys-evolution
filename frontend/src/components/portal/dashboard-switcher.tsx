'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/hooks/use-auth';

// ============================================================================
// DashboardSwitcher — Multi-dashboard dropdown
// ============================================================================

const DASHBOARD_PATHS: Record<string, string> = {
  admin: '/admin',
  portal: '/portal',
  employee_portal: '/portal',
  platform_console: '/platform',
  company_pet: '/company-pet',
  hr_dashboard: '/admin',
  manager_dashboard: '/admin',
};

export function DashboardSwitcher() {
  const router = useRouter();
  const { rbpDashboards } = useAuth();
  const t = useTranslations('dashboards');

  if (!rbpDashboards || rbpDashboards.length <= 1) {
    return null;
  }

  const handleSwitch = (slug: string) => {
    const path = DASHBOARD_PATHS[slug];
    if (path) {
      router.push(path);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('switchDashboard')}>
          <LayoutDashboard className="h-5 w-5" />
          <ChevronDown className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('availableDashboards')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {rbpDashboards.map((slug) => (
          <DropdownMenuItem
            key={slug}
            onClick={() => handleSwitch(slug)}
            className={cn('cursor-pointer')}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            {t.has(`labels.${slug}`) ? t(`labels.${slug}`) : slug}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
