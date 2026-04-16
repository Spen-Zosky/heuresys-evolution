/**
 * Navigation Configuration - RBAC Aware (LEGACY FALLBACK ONLY)
 *
 * @deprecated Data-driven navigation via `/api/rbp/navigation` +
 * `/api/rbp/sections` is the single source of truth (see
 * `use-sidebar-nav.ts` and tables `rbp_dashboards`, `rbp_dashboard_nav_items`,
 * `rbp_pages`, `rbp_sections`). This file is kept ONLY as an emergency
 * safety net when the RBP API is unreachable. DO NOT add new hardcoded
 * entries here — extend the DB tables instead (migration + seed).
 *
 * Violations of P9 "Everything data-driven" must be removed, not extended.
 */

import {
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
  LucideIcon,
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
} from 'lucide-react';
import type { UserRole } from './api/types';

// ============================================
// TYPES
// ============================================

export interface NavItem {
  /** Display label */
  label: string;
  /** Route path */
  href: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Minimum role required (based on ROLE_LEVELS hierarchy) */
  minRole: UserRole;
  /** Required permissions (alternative to role) */
  permissions?: string[];
  /** Sub-items for nested navigation */
  children?: Omit<NavItem, 'children' | 'icon'>[];
  /** Badge count (optional, e.g., notifications) */
  badge?: number;
  /** If true, item is hidden from menu but route is accessible */
  hidden?: boolean;
}

export interface NavSection {
  /** Section header label */
  title: string;
  /** Navigation items in this section */
  items: NavItem[];
}

// ============================================
// ROLE HIERARCHY (lower = more powerful)
// ============================================

export const ROLE_LEVELS: Record<UserRole, number> = {
  SUPERUSER: -1,
  TENANT_OWNER: 0,
  ADMIN: 0, // legacy → TENANT_OWNER
  SYSADMIN: 0, // legacy → TENANT_OWNER
  DEMO: 2,
  HR: 3,
  MANAGER: 4,
  USER: 5, // legacy DB role → same level as EMPLOYEE
  EMPLOYEE: 5,
};

/**
 * Check if a user role meets the minimum required role
 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] <= ROLE_LEVELS[minRole];
}

// ============================================
// ADMIN NAVIGATION CONFIG
// ============================================

/** @deprecated Use useSidebarNav() hook instead — data-driven from RBP API. Kept as fallback. */
export const adminNavSections: NavSection[] = [
  {
    title: 'Panoramica',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
        minRole: 'EMPLOYEE',
      },
    ],
  },
  {
    title: 'Gestione HR',
    items: [
      {
        label: 'Dipendenti',
        href: '/admin/employees',
        icon: Users,
        minRole: 'HR',
        children: [
          { label: 'Lista Dipendenti', href: '/admin/employees', minRole: 'HR' },
          { label: 'Nuovo Dipendente', href: '/admin/employees/new', minRole: 'HR' },
          { label: 'Onboarding', href: '/admin/employees/onboarding', minRole: 'HR' },
        ],
      },
      {
        label: 'Dipartimenti',
        href: '/admin/org-units',
        icon: Building2,
        minRole: 'HR',
      },
      {
        label: 'Organigramma',
        href: '/admin/org-units',
        icon: FolderTree,
        minRole: 'HR',
        children: [
          { label: 'Unità Org.', href: '/admin/org-units', minRole: 'HR' },
          { label: 'Vista Grafico', href: '/admin/org-chart', minRole: 'HR' },
        ],
      },
      {
        label: 'Sedi',
        href: '/admin/locations',
        icon: MapPin,
        minRole: 'HR',
      },
      {
        label: 'Centri Costo',
        href: '/admin/cost-centers',
        icon: CircleDollarSign,
        minRole: 'HR',
      },
    ],
  },
  {
    title: 'Prestazioni',
    items: [
      {
        label: 'Obiettivi',
        href: '/admin/goals',
        icon: Target,
        minRole: 'MANAGER',
        children: [
          { label: 'Lista Obiettivi', href: '/admin/goals', minRole: 'MANAGER' },
          { label: 'Nuovo Obiettivo', href: '/admin/goals/new', minRole: 'HR' },
          { label: 'Cascading', href: '/admin/goals/cascading', minRole: 'HR' },
        ],
      },
      {
        label: 'Valutazioni',
        href: '/admin/reviews',
        icon: ClipboardList,
        minRole: 'MANAGER',
      },
      {
        label: 'Check-in',
        href: '/admin/check-ins',
        icon: MessageSquare,
        minRole: 'MANAGER',
      },
      {
        label: 'Feedback 360',
        href: '/admin/feedback',
        icon: Award,
        minRole: 'HR',
      },
    ],
  },
  {
    title: 'Formazione',
    items: [
      {
        label: 'Corsi',
        href: '/admin/courses',
        icon: GraduationCap,
        minRole: 'HR',
        children: [
          { label: 'Catalogo', href: '/admin/courses', minRole: 'MANAGER' },
          { label: 'Nuovo Corso', href: '/admin/courses/new', minRole: 'HR' },
          { label: 'Iscrizioni', href: '/admin/courses/enrollments', minRole: 'HR' },
        ],
      },
      {
        label: 'Skills',
        href: '/admin/skills',
        icon: Award,
        minRole: 'HR',
      },
      {
        label: 'Certificazioni',
        href: '/admin/certifications',
        icon: FileText,
        minRole: 'HR',
      },
    ],
  },
  {
    title: 'Carriera',
    items: [
      {
        label: 'Career Hub',
        href: '/admin/career',
        icon: Compass,
        minRole: 'HR',
        children: [
          { label: 'Dashboard', href: '/admin/career', minRole: 'HR' },
          { label: 'Percorsi', href: '/admin/career/paths', minRole: 'HR' },
          { label: 'Competenze', href: '/admin/career/skills', minRole: 'HR' },
          { label: 'Mentoring', href: '/admin/career/mentors', minRole: 'HR' },
          { label: 'Formazione', href: '/admin/career/learning', minRole: 'HR' },
          { label: 'Obiettivi', href: '/admin/career/goals', minRole: 'HR' },
          { label: 'Report', href: '/admin/career/reports', minRole: 'HR' },
        ],
      },
    ],
  },
  {
    title: 'Selezione',
    items: [
      {
        label: 'Posizioni',
        href: '/admin/positions',
        icon: Briefcase,
        minRole: 'HR',
      },
      {
        label: 'Candidati',
        href: '/admin/candidates',
        icon: Users,
        minRole: 'HR',
      },
    ],
  },
  {
    title: 'Analisi',
    items: [
      {
        label: 'Centro Analisi',
        href: '/admin/analytics',
        icon: BarChart3,
        minRole: 'MANAGER',
        children: [
          { label: 'Dashboard', href: '/admin/analytics', minRole: 'MANAGER' },
          { label: 'Organico', href: '/admin/analytics/workforce', minRole: 'HR' },
          { label: 'AI Insights', href: '/admin/analytics/ai', minRole: 'HR' },
          { label: 'Retribuzioni', href: '/admin/analytics/compensation', minRole: 'HR' },
          { label: 'Presenze', href: '/admin/analytics/attendance', minRole: 'HR' },
          { label: 'HR Intelligence', href: '/admin/analytics/hr-intelligence', minRole: 'HR' },
          { label: 'Predizioni', href: '/admin/analytics/predictions', minRole: 'HR' },
          { label: 'Esportazione', href: '/admin/analytics/export', minRole: 'HR' },
        ],
      },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      {
        label: 'Marketplace Plugin',
        href: '/admin/marketplace',
        icon: Store,
        minRole: 'ADMIN',
        children: [
          { label: 'Catalogo', href: '/admin/marketplace', minRole: 'ADMIN' },
          { label: 'Installati', href: '/admin/marketplace/installed', minRole: 'ADMIN' },
          { label: 'Sviluppatori', href: '/admin/marketplace/developer', minRole: 'ADMIN' },
          { label: 'Chiavi API', href: '/admin/marketplace/api-keys', minRole: 'ADMIN' },
          { label: 'Webhooks', href: '/admin/marketplace/webhooks', minRole: 'ADMIN' },
        ],
      },
    ],
  },
  {
    title: 'Company PET',
    items: [
      {
        label: 'Company PET',
        href: '/company-pet',
        icon: PieChart,
        minRole: 'ADMIN',
        children: [
          { label: 'Centro Comandi', href: '/company-pet', minRole: 'ADMIN' },
          { label: 'Organigramma', href: '/company-pet/org-chart', minRole: 'ADMIN' },
          { label: 'Gerarchia', href: '/company-pet/hierarchy', minRole: 'ADMIN' },
          { label: 'Analisi Dettagliata', href: '/company-pet/breakdowns', minRole: 'ADMIN' },
          { label: 'Organizzazione', href: '/company-pet/organization', minRole: 'ADMIN' },
          { label: 'Organico', href: '/company-pet/workforce', minRole: 'ADMIN' },
          { label: 'Confronto Scenari', href: '/company-pet/staging-comparison', minRole: 'ADMIN' },
          { label: 'Processi', href: '/company-pet/processes', minRole: 'ADMIN' },
          { label: 'Struttura', href: '/company-pet/structure', minRole: 'ADMIN' },
          { label: 'Persone', href: '/company-pet/people', minRole: 'ADMIN' },
        ],
      },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        label: 'AI Search',
        href: '/admin/workforce-intelligence',
        icon: Search,
        minRole: 'HR',
      },
      {
        label: 'Career Simulator',
        href: '/admin/workforce-intelligence/career-simulator',
        icon: Rocket,
        minRole: 'HR',
      },
      {
        label: 'Skill Galaxy',
        href: '/admin/workforce-intelligence/skill-galaxy',
        icon: Sparkles,
        minRole: 'HR',
      },
      {
        label: 'What-If',
        href: '/admin/workforce-intelligence/what-if',
        icon: FlaskConical,
        minRole: 'HR',
      },
      {
        label: 'Org Dashboard',
        href: '/admin/workforce-intelligence/org-dashboard',
        icon: BrainCircuit,
        minRole: 'HR',
      },
    ],
  },
  {
    title: 'Amministrazione',
    items: [
      {
        label: 'Utenti',
        href: '/admin/users',
        icon: UserCog,
        minRole: 'ADMIN',
      },
      {
        label: 'Impostazioni',
        href: '/admin/settings',
        icon: Settings,
        minRole: 'ADMIN',
        children: [
          { label: 'Generale', href: '/admin/settings', minRole: 'ADMIN' },
          { label: 'Migrazione SAP', href: '/admin/settings/sap-migration', minRole: 'ADMIN' },
        ],
      },
    ],
  },
];

// ============================================
// PLATFORM (TENANT_OWNER) NAVIGATION
// ============================================

/** @deprecated Use useSidebarNav() hook instead — data-driven from RBP API. Kept as fallback. */
export const platformNavSections: NavSection[] = [
  {
    title: 'Piattaforma',
    items: [
      {
        label: 'Dashboard',
        href: '/platform',
        icon: LayoutDashboard,
        minRole: 'SUPERUSER',
      },
      {
        label: 'Panoramica',
        href: '/platform/panoramica',
        icon: Layers,
        minRole: 'SUPERUSER',
      },
      {
        label: 'Blueprint',
        href: '/platform/blueprint',
        icon: Compass,
        minRole: 'SUPERUSER',
      },
      {
        label: 'Tenants',
        href: '/platform/tenants',
        icon: Building2,
        minRole: 'SUPERUSER',
      },
      {
        label: 'Utenti Sistema',
        href: '/platform/users',
        icon: UserCog,
        minRole: 'SUPERUSER',
      },
      {
        label: 'Sicurezza',
        href: '/platform/security',
        icon: Shield,
        minRole: 'SUPERUSER',
      },
      {
        label: 'Database',
        href: '/platform/database',
        icon: Database,
        minRole: 'SUPERUSER',
      },
      {
        label: 'Impostazioni',
        href: '/platform/settings',
        icon: Settings,
        minRole: 'SUPERUSER',
      },
    ],
  },
];

// ============================================
// EMPLOYEE PORTAL NAVIGATION
// ============================================

/** @deprecated Use useSidebarNav() hook instead — data-driven from RBP API. Kept as fallback. */
export const portalNavSections: NavSection[] = [
  {
    title: 'Il Mio Spazio',
    items: [
      {
        label: 'Home',
        href: '/portal',
        icon: LayoutDashboard,
        minRole: 'EMPLOYEE',
      },
      {
        label: 'Profilo',
        href: '/portal/profile',
        icon: Users,
        minRole: 'EMPLOYEE',
      },
      {
        label: 'I Miei Obiettivi',
        href: '/portal/goals',
        icon: Target,
        minRole: 'EMPLOYEE',
      },
      {
        label: 'Formazione',
        href: '/portal/learning',
        icon: GraduationCap,
        minRole: 'EMPLOYEE',
      },
      {
        label: 'Ferie e Permessi',
        href: '/portal/time-off',
        icon: Calendar,
        minRole: 'EMPLOYEE',
      },
      {
        label: 'Documenti',
        href: '/portal/documents',
        icon: FileText,
        minRole: 'EMPLOYEE',
      },
      {
        label: 'Le Mie Buste Paga',
        href: '/portal/payroll',
        icon: Wallet,
        minRole: 'EMPLOYEE',
      },
    ],
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Filter navigation sections based on user role
 */
export function filterNavByRole(sections: NavSection[], userRole: UserRole): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.hidden && hasMinRole(userRole, item.minRole))
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) => hasMinRole(userRole, child.minRole)),
        })),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Find current navigation item by path
 */
export function findNavItem(sections: NavSection[], path: string): NavItem | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href === path) return item;
      if (item.children) {
        const child = item.children.find((c) => c.href === path);
        if (child) return item;
      }
    }
  }
  return null;
}

/**
 * Get breadcrumb path for a route
 */
export function getBreadcrumbs(
  sections: NavSection[],
  path: string
): { label: string; href: string }[] {
  const breadcrumbs: { label: string; href: string }[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      if (path.startsWith(item.href)) {
        breadcrumbs.push({ label: item.label, href: item.href });

        if (item.children) {
          for (const child of item.children) {
            if (path === child.href || path.startsWith(child.href + '/')) {
              breadcrumbs.push({ label: child.label, href: child.href });
              break;
            }
          }
        }
        return breadcrumbs;
      }
    }
  }

  return breadcrumbs;
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(
  sections: NavSection[],
  path: string,
  userRole: UserRole,
  userPermissions: string[] = []
): boolean {
  // Find the matching nav item
  for (const section of sections) {
    for (const item of section.items) {
      // Check exact match
      if (item.href === path) {
        if (item.permissions && item.permissions.length > 0) {
          return item.permissions.some((p) => userPermissions.includes(p));
        }
        return hasMinRole(userRole, item.minRole);
      }

      // Check children
      if (item.children) {
        for (const child of item.children) {
          if (child.href === path || path.startsWith(child.href + '/')) {
            return hasMinRole(userRole, child.minRole);
          }
        }
      }

      // Check if path starts with item href (nested routes)
      if (path.startsWith(item.href + '/')) {
        return hasMinRole(userRole, item.minRole);
      }
    }
  }

  // Default: allow access if route not found in nav (might be a detail page)
  return true;
}
