'use client';

import Link from 'next/link';
import { Workflow, Building2, User, BookOpen, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EntityType = 'process' | 'org_unit' | 'employee' | 'skill' | 'role';

const ENTITY_CONFIG: Record<
  EntityType,
  { icon: React.ComponentType<{ className?: string }>; basePath: string; label: string }
> = {
  process: { icon: Workflow, basePath: '/company-pet/processes', label: 'Processo' },
  org_unit: { icon: Building2, basePath: '/company-pet/structure', label: 'Unità Organizzativa' },
  employee: { icon: User, basePath: '/company-pet/people', label: 'Dipendente' },
  skill: { icon: BookOpen, basePath: '/admin/talent/skills', label: 'Competenza ESCO' },
  role: { icon: Briefcase, basePath: '/company-pet/people', label: 'Persone' },
};

interface EntityLinkProps {
  type: EntityType;
  id: string;
  children: React.ReactNode;
  className?: string;
  /** Override the generated href (e.g. to add query params) */
  href?: string;
}

export function EntityLink({ type, id, children, className, href }: EntityLinkProps) {
  const config = ENTITY_CONFIG[type];
  const Icon = config.icon;
  const resolvedHref = href ?? `${config.basePath}/${id}`;

  return (
    <Link
      href={resolvedHref}
      title={`${config.label}: ${typeof children === 'string' ? children : ''}`}
      className={cn(
        'inline-flex items-center gap-1 text-primary hover:underline underline-offset-2 transition-colors',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      {children}
    </Link>
  );
}
