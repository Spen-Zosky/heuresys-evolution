'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  homeHref?: string
  homeLabel?: string
  className?: string
  showHome?: boolean
}

// Route label mappings for Italian localization
const routeLabels: Record<string, string> = {
  // Admin sections
  admin: 'Dashboard',
  ai: 'AI & Knowledge',
  chat: 'Chat AI',
  documents: 'Documenti',
  sessions: 'Sessioni',
  'knowledge-base': 'Knowledge Base',
  'hr-core': 'HR Core',
  employees: 'Dipendenti',
  departments: 'Dipartimenti',
  'org-units': 'Unità Org.',
  locations: 'Sedi',
  'cost-centers': 'Centri Costo',
  contracts: 'Contratti',
  leave: 'Ferie e Permessi',
  performance: 'Performance',
  goals: 'Obiettivi',
  okrs: 'OKRs',
  reviews: 'Valutazioni',
  'check-ins': 'Check-ins',
  feedback: 'Feedback',
  calibration: 'Calibrazione',
  'review-cycles': 'Cicli Review',
  learning: 'Learning',
  courses: 'Corsi',
  paths: 'Percorsi',
  certifications: 'Certificazioni',
  enrollments: 'Iscrizioni',
  recruiting: 'Recruiting',
  requisitions: 'Posizioni',
  candidates: 'Candidati',
  postings: 'Job Posting',
  interviews: 'Colloqui',
  offers: 'Offerte',
  compensation: 'Compensation',
  'salary-bands': 'Fasce Salariali',
  'bonus-plans': 'Piano Bonus',
  'merit-cycles': 'Cicli Merito',
  benefits: 'Benefits',
  payroll: 'Payroll',
  engagement: 'Engagement',
  recognition: 'Riconoscimenti',
  surveys: 'Sondaggi',
  wellbeing: 'Wellbeing',
  social: 'Social Feed',
  mentorship: 'Mentorship',
  talent: 'Talent',
  skills: 'Skills',
  'skill-profiles': 'Profili Skill',
  'gap-analysis': 'Gap Analysis',
  'career-paths': 'Percorsi Carriera',
  succession: 'Succession',
  assessments: 'Assessment',
  mobility: 'Mobilità Interna',
  'pay-stubs': 'Cedolini',
  compliance: 'Compliance',
  'audit-logs': 'Audit Logs',
  whistleblowing: 'Whistleblowing',
  analytics: 'Analytics',
  'hr-intelligence': 'HR Intelligence',
  predictions: 'Predictions AI',
  reports: 'Report',
  exports: 'Export Dati',
  subscriptions: 'Sottoscrizioni',
  dashboards: 'Dashboard Custom',
  settings: 'Impostazioni',
  // Portal sections
  portal: 'Portale Dipendente',
  'time-off': 'Ferie e Permessi',
  profile: 'Profilo',
  // Platform sections
  platform: 'Piattaforma',
  tenants: 'Tenant',
  // Other
  new: 'Nuovo',
  edit: 'Modifica',
  career: 'Carriera',
  news: 'News',
}

/**
 * Breadcrumb Navigation - WCAG 2.4.8
 *
 * Provides location context within site hierarchy.
 * Auto-generates from pathname or accepts custom items.
 */
export function Breadcrumb({
  items,
  homeHref = '/admin',
  homeLabel = 'Home',
  className,
  showHome = true,
}: BreadcrumbProps) {
  const pathname = usePathname()

  // Auto-generate breadcrumbs from pathname if items not provided
  const breadcrumbItems = React.useMemo(() => {
    if (items) return items

    const segments = pathname.split('/').filter(Boolean)
    const generatedItems: BreadcrumbItem[] = []

    let currentPath = ''
    for (const segment of segments) {
      currentPath += `/${segment}`

      // Skip dynamic segments (like [id])
      if (segment.startsWith('[') && segment.endsWith(']')) {
        continue
      }

      // Skip UUID-like segments
      if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(segment)) {
        generatedItems.push({
          label: 'Dettaglio',
          href: currentPath,
        })
        continue
      }

      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')

      generatedItems.push({
        label,
        href: currentPath,
      })
    }

    return generatedItems
  }, [pathname, items])

  // Don't render if only home
  if (breadcrumbItems.length <= 1 && !showHome) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-sm text-muted-foreground', className)}
    >
      <ol className="flex items-center gap-1.5">
        {showHome && (
          <li className="flex items-center">
            <Link
              href={homeHref}
              className="flex items-center hover:text-foreground transition-colors"
              aria-label={homeLabel}
            >
              <Home className="h-4 w-4" />
            </Link>
          </li>
        )}

        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1
          const isFirst = index === 0

          // Skip first item if it's the same as home
          if (isFirst && showHome && item.href === homeHref) {
            return null
          }

          return (
            <li key={item.href} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
