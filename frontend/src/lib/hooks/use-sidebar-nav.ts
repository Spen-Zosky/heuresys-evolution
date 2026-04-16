'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  LayoutDashboard,
  Users,
  Building2,
  Target,
  GraduationCap,
  BarChart3,
  Settings,
  Shield,
  UserCog,
  FolderTree,
  Briefcase,
  ClipboardList,
  MessageSquare,
  Calendar,
  Award,
  FileText,
  Database,
  CircleDollarSign,
  MapPin,
  Store,
  Compass,
  Wallet,
  PieChart,
  Search,
  Rocket,
  Sparkles,
  FlaskConical,
  BrainCircuit,
  Layers,
  BookOpen,
  Library,
  CheckCircle,
  UserPlus,
  Shuffle,
  Star,
  GitBranch,
  Gem,
  CreditCard,
  File,
  CheckSquare,
  Bell,
  LayoutGrid,
  LayoutTemplate,
  type LucideIcon,
} from 'lucide-react';
import { getApiBaseUrl, getDefaultHeaders } from '../api-config';
import { useAuth } from './use-auth';
import {
  adminNavSections,
  platformNavSections,
  portalNavSections,
  filterNavByRole,
  type NavSection,
} from '../navigation';

// ============================================================================
// Icon Map — maps DB icon names to Lucide components
// ============================================================================

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  Home,
  'layout-dashboard': LayoutDashboard,
  LayoutDashboard,
  users: Users,
  Users,
  building: Building2,
  'building-2': Building2,
  Building2,
  target: Target,
  Target,
  'graduation-cap': GraduationCap,
  GraduationCap,
  'bar-chart-3': BarChart3,
  BarChart3,
  settings: Settings,
  Settings,
  shield: Shield,
  Shield,
  'user-cog': UserCog,
  UserCog,
  'folder-tree': FolderTree,
  FolderTree,
  briefcase: Briefcase,
  Briefcase,
  'clipboard-check': ClipboardList,
  'clipboard-list': ClipboardList,
  ClipboardList,
  'message-circle': MessageSquare,
  'message-square': MessageSquare,
  MessageSquare,
  calendar: Calendar,
  Calendar,
  award: Award,
  Award,
  'file-text': FileText,
  FileText,
  database: Database,
  Database,
  'circle-dollar-sign': CircleDollarSign,
  CircleDollarSign,
  'map-pin': MapPin,
  MapPin,
  store: Store,
  Store,
  compass: Compass,
  Compass,
  wallet: Wallet,
  Wallet,
  'pie-chart': PieChart,
  PieChart,
  search: Search,
  Search,
  rocket: Rocket,
  Rocket,
  sparkles: Sparkles,
  Sparkles,
  'flask-conical': FlaskConical,
  FlaskConical,
  'brain-circuit': BrainCircuit,
  BrainCircuit,
  layers: Layers,
  Layers,
  'book-open': BookOpen,
  BookOpen,
  library: Library,
  Library,
  'check-circle': CheckCircle,
  CheckCircle,
  'user-plus': UserPlus,
  UserPlus,
  shuffle: Shuffle,
  Shuffle,
  star: Star,
  Star,
  'git-branch': GitBranch,
  GitBranch,
  gem: Gem,
  Gem,
  'credit-card': CreditCard,
  CreditCard,
  file: File,
  File,
  'check-square': CheckSquare,
  CheckSquare,
  bell: Bell,
  Bell,
  'layout-grid': LayoutGrid,
  LayoutGrid,
  'layout-template': LayoutTemplate,
  LayoutTemplate,
};

function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || LayoutDashboard;
}

// ============================================================================
// Types
// ============================================================================

interface RbpNavItem {
  label: string;
  labelIt?: string;
  labelEn?: string | null;
  path: string;
  icon: string;
  section: string;
  sortOrder: number;
}

interface RbpDashboard {
  code: string;
  name: string;
  layoutPath: string;
  icon: string;
  isDefault: boolean;
  navItems: RbpNavItem[];
}

interface NavigationResponse {
  dashboards: RbpDashboard[];
}

// ============================================================================
// Hook
// ============================================================================

async function fetchNavigation(): Promise<NavigationResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/rbp/navigation`, {
    headers: getDefaultHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Navigation fetch failed: ${res.status}`);
  return res.json();
}

interface SectionRegistryEntry {
  code: string;
  label_it: string;
  label_en: string | null;
  sort_order: number;
  icon: string | null;
}

async function fetchSections(): Promise<SectionRegistryEntry[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/rbp/sections`, {
    headers: getDefaultHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Sections fetch failed: ${res.status}`);
  const json = await res.json();
  return json?.data || [];
}

/**
 * Hook that fetches sidebar nav items from the RBP API.
 * Falls back to hardcoded navigation.ts if API call fails.
 */
export function useSidebarNav(): NavSection[] {
  const pathname = usePathname();
  const locale = useLocale();
  const { user } = useAuth();

  const { data: navData } = useQuery({
    queryKey: ['rbp-navigation'],
    queryFn: fetchNavigation,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  // Section registry — data-driven order and labels (P9)
  const { data: sectionsRegistry } = useQuery({
    queryKey: ['rbp-sections'],
    queryFn: fetchSections,
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Determine which dashboard to show based on current path
  const activeDashboard = useMemo(() => {
    if (!navData?.dashboards?.length) return null;

    const dashboards = navData.dashboards;

    if (pathname.startsWith('/platform')) {
      return dashboards.find((d) => d.code === 'platform_console') || null;
    }
    if (pathname.startsWith('/portal')) {
      return dashboards.find((d) => d.code === 'employee_portal') || null;
    }
    if (pathname.startsWith('/company-pet')) {
      return dashboards.find((d) => d.code === 'company_pet') || null;
    }

    // For /admin paths, find the best matching dashboard (prefer default)
    const adminDashboards = dashboards.filter(
      (d) => !['platform_console', 'employee_portal'].includes(d.code)
    );
    return adminDashboards.find((d) => d.isDefault) || adminDashboards[0] || null;
  }, [navData, pathname]);

  // Convert RBP dashboard to NavSection[] — uses section registry for order/labels
  const rbpSections = useMemo(() => {
    if (!activeDashboard?.navItems?.length) return null;
    return convertRbpToNavSections(activeDashboard.navItems, sectionsRegistry || [], locale);
  }, [activeDashboard, sectionsRegistry, locale]);

  // Fallback to hardcoded navigation if RBP data not available
  const fallbackSections = useMemo(() => {
    const sections = pathname.startsWith('/platform')
      ? platformNavSections
      : pathname.startsWith('/portal')
        ? portalNavSections
        : adminNavSections;
    return user ? filterNavByRole(sections, user.role) : [];
  }, [pathname, user]);

  return rbpSections || fallbackSections;
}

/**
 * Convert flat RBP nav items to NavSection[] structure.
 *
 * Section order and labels come from the DB registry (rbp_sections table,
 * served by /api/rbp/sections). This enforces P9: no hardcoded arrays or
 * maps for dashboard metadata. Sections missing from the registry fall
 * back to capitalized code at the end of the list.
 */
function convertRbpToNavSections(
  items: RbpNavItem[],
  sectionsRegistry: SectionRegistryEntry[],
  locale: string = 'it'
): NavSection[] {
  // Index registry for O(1) lookup
  const registryByCode = new Map<string, SectionRegistryEntry>();
  for (const entry of sectionsRegistry) {
    registryByCode.set(entry.code, entry);
  }

  const sectionMap = new Map<string, { title: string; key: string; items: NavSection['items'] }>();

  for (const item of items) {
    const sectionKey = item.section || 'general';
    if (!sectionMap.has(sectionKey)) {
      const registryEntry = registryByCode.get(sectionKey);
      sectionMap.set(sectionKey, {
        title:
          (locale === 'en' ? registryEntry?.label_en : null) ||
          registryEntry?.label_it ||
          sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1),
        key: sectionKey,
        items: [],
      });
    }

    sectionMap.get(sectionKey)!.items.push({
      label: (locale === 'en' ? item.labelEn : item.labelIt) || item.labelIt || item.label,
      href: item.path,
      icon: getIconComponent(item.icon),
      minRole: 'EMPLOYEE' as const, // RBP handles permissions, not role hierarchy
    });
  }

  return Array.from(sectionMap.values())
    .sort((a, b) => {
      const aOrder = registryByCode.get(a.key)?.sort_order ?? 9999;
      const bOrder = registryByCode.get(b.key)?.sort_order ?? 9999;
      return aOrder - bOrder;
    })
    .map(({ title, items }) => ({ title, items }));
}
