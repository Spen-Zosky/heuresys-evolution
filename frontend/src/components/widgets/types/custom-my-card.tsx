'use client';

import Link from 'next/link';
import { useWidgetData } from '@/lib/hooks/use-workspace';
import WidgetWrapper from '../widget-wrapper';
import {
  CreditCard,
  Gem,
  AlertCircle,
  Inbox,
  RefreshCw,
  MapPin,
  User,
  Users,
  CalendarClock,
  Palmtree,
  Clock,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface MyCardData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  hire_date: string;
  job_title: string;
  department_name: string | null;
  location_text: string | null;
  work_location: string | null;
  work_city: string | null;
  contract_type: string | null;
  level: string | null;
  ccnl_code: string | null;
  base_salary: number | null;
  currency: string | null;
  contract_end_date: string | null;
  monthly_salary: number | string | null;
  num_monthly_payments: number | null;
  salary_override_reason: string | null;
  ccnl_min_monthly: number | string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_job_title: string | null;
  vacation_days_remaining: number | null;
  next_review_date: string | null;
  direct_reports_count: number | null;
}

interface MyCardResponse {
  employee: MyCardData | null;
}

// ============================================
// Helpers
// ============================================

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function computeSeniority(hireDate: string): string {
  try {
    const hire = new Date(hireDate);
    const now = new Date();
    let years = now.getFullYear() - hire.getFullYear();
    let months = now.getMonth() - hire.getMonth();
    if (now.getDate() < hire.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years <= 0 && months <= 0) return '< 1 mese';
    if (years <= 0) return `${months} mes${months === 1 ? 'e' : 'i'}`;
    if (months === 0) return `${years} ann${years === 1 ? 'o' : 'i'}`;
    return `${years}a ${months}m`;
  } catch {
    return '—';
  }
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  permanent: 'Indeterminato',
  fixed_term: 'Determinato',
  apprenticeship: 'Apprendistato',
  internship: 'Stage',
  freelance: 'Collaborazione',
};

const CCNL_LABELS: Record<string, string> = {
  CCNL_CRED_2024: 'CCNL Credito',
  CCNL_COMM_2024: 'CCNL Terziario',
  CCNL_METMEC_2024: 'CCNL Metalmeccanico',
  CCNL_ALIM_2024: 'CCNL Alimentare',
  CCNL_ENERGIA_2024: 'CCNL Energia',
  CCNL_TLC_2024: 'CCNL Telecomunicazioni',
  CCNL_TUR_2024: 'CCNL Turismo',
};

// ============================================
// Sub-components
// ============================================

function InfoField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon ? <Icon size={10} className="opacity-70" /> : null}
        {label}
      </span>
      <span className="truncate text-[13px] font-medium text-foreground">{children}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <Inbox size={28} className="text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground">Nessun dato profilo disponibile</span>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function CustomMyCard({ code }: { code: string }) {
  const { data: raw, loading, error, refetch } = useWidgetData<MyCardResponse>(code);
  const data = raw?.employee ?? null;

  const footer = data ? (
    <>
      <span>Assunzione: {formatDate(data.hire_date)}</span>
      <Link href="/portal/profile" className="text-primary hover:underline">
        Vedi profilo completo &rarr;
      </Link>
    </>
  ) : undefined;

  const managerName =
    data?.manager_first_name && data.manager_last_name
      ? `${data.manager_first_name} ${data.manager_last_name}`
      : null;

  const workLocation =
    data?.work_location || data?.work_city || data?.location_text || null;

  return (
    <WidgetWrapper title="My Card" icon={CreditCard} footer={footer}>
      {loading && <Skeleton />}

      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-4">
          <AlertCircle size={22} className="text-destructive" />
          <span className="text-xs text-destructive">{error}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
          >
            <RefreshCw size={12} /> Riprova
          </button>
        </div>
      )}

      {!loading && !error && !data && <EmptyState />}

      {!loading && !error && data && (
        <div className="flex flex-col gap-3">
          {/* Header identità */}
          <div className="flex items-start justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-foreground">
                {data.first_name} {data.last_name}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {data.job_title}
                {data.department_name ? ` · ${data.department_name}` : ''}
              </span>
            </div>
            {data.direct_reports_count && data.direct_reports_count > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Users size={10} />
                {data.direct_reports_count} riport{data.direct_reports_count === 1 ? 'o' : 'i'}
              </span>
            ) : null}
          </div>

          {/* Grid 2×4 — 8 campi */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <InfoField label="Contratto">
              {data.contract_type
                ? CONTRACT_TYPE_LABELS[data.contract_type] || data.contract_type
                : '\u2014'}
              {data.contract_end_date ? (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  fino {formatShortDate(data.contract_end_date)}
                </span>
              ) : null}
            </InfoField>

            <InfoField label="Livello">
              {data.level ? (
                <>
                  {data.level}
                  {data.ccnl_code ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {CCNL_LABELS[data.ccnl_code] || data.ccnl_code}
                    </span>
                  ) : null}
                </>
              ) : (
                '\u2014'
              )}
            </InfoField>

            <InfoField label="Anzianità" icon={Clock}>
              {computeSeniority(data.hire_date)}
            </InfoField>

            <InfoField label="Retribuzione">
              {data.base_salary != null ? (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <Gem size={12} className="text-amber-400" />
                  <span className="bg-gradient-to-br from-amber-400 to-purple-400 bg-clip-text font-semibold text-transparent">
                    {formatCurrency(data.base_salary, data.currency || 'EUR')}
                  </span>
                  {data.num_monthly_payments ? (
                    <span className="text-[10px] text-muted-foreground">
                      / {data.num_monthly_payments} mens.
                    </span>
                  ) : null}
                  {data.salary_override_reason === 'superminimo' ? (
                    <span
                      className="rounded-full bg-amber-400/15 px-1.5 text-[9px] font-semibold uppercase text-amber-500"
                      title="Stipendio oltre il minimo tabellare CCNL"
                    >
                      Super
                    </span>
                  ) : null}
                  {data.salary_override_reason === 'legacy_14a' ? (
                    <span
                      className="rounded-full bg-purple-400/15 px-1.5 text-[9px] font-semibold uppercase text-purple-500"
                      title="14ª mensilità (assunti pre-1999)"
                    >
                      14ª
                    </span>
                  ) : null}
                </span>
              ) : (
                '\u2014'
              )}
            </InfoField>

            <InfoField label="Manager" icon={User}>
              {managerName ? (
                <span className="truncate" title={data.manager_job_title || ''}>
                  {managerName}
                </span>
              ) : (
                '\u2014'
              )}
            </InfoField>

            <InfoField label="Sede" icon={MapPin}>
              {workLocation || '\u2014'}
            </InfoField>

            <InfoField label="Ferie residue" icon={Palmtree}>
              {data.vacation_days_remaining != null
                ? `${data.vacation_days_remaining.toFixed(1)} gg`
                : '\u2014'}
            </InfoField>

            <InfoField label="Prossima review" icon={CalendarClock}>
              {data.next_review_date ? formatShortDate(data.next_review_date) : '\u2014'}
            </InfoField>
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
