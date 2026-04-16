'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/lib/hooks/use-auth';
import '@/components/widgets/widget-effects.css';

// ============================================
// Helpers
// ============================================

function getGreeting(locale: string): string {
  const hour = new Date().getHours();
  if (locale === 'en') {
    if (hour < 13) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
  if (hour < 13) return 'Buongiorno';
  if (hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}

function formatDisplayName(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  return username ?? 'Utente';
}

function formatRoleLine(role?: string, department?: string, tenantName?: string): string {
  const parts: string[] = [];
  if (role) parts.push(role.replace(/_/g, ' '));
  if (department) parts.push(department);
  if (tenantName) parts.push(tenantName);
  return parts.join(' \u00b7 ');
}

// ============================================
// Component
// ============================================

/**
 * Welcome hero banner with glassmorphism card and animated avatar ring.
 * Fetches user data from auth context — no additional API calls needed
 * since User type already includes name, role, department, tenant.
 */
export default function HeroSection() {
  const { user } = useAuth();
  const locale = useLocale();

  const greeting = useMemo(() => getGreeting(locale), [locale]);

  if (!user) return null;

  const initials = getInitials(user.firstName, user.lastName, user.username);
  const displayName = formatDisplayName(user.firstName, user.lastName, user.username);
  const roleLine = formatRoleLine(user.jobTitle || user.role, user.department, user.tenant_name);

  return (
    <div
      className="hero-fade-in relative overflow-hidden rounded-[14px] border border-border/50 bg-card/60 px-6 py-5"
      style={{
        backdropFilter: 'blur(24px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
      }}
    >
      {/* Subtle glow overlay — reuses widget-glow pattern but lighter */}
      <div
        className="pointer-events-none absolute inset-[-2px] rounded-[16px] opacity-20"
        style={{
          padding: '2px',
          background: `conic-gradient(
            from calc(var(--angle, 0deg) + 225deg),
            transparent 50%,
            hsl(var(--primary)) 60%,
            oklch(0.638 0.200 310) 70%,
            oklch(0.720 0.160 55) 75%,
            transparent 85%
          )`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          animation: 'widget-ring-spin 3s linear infinite',
        }}
      />

      <div className="relative z-[2] flex items-center gap-5">
        {/* Animated avatar ring */}
        <div className="avatar-ring shrink-0" style={{ width: '72px', height: '72px' }}>
          <div
            className="flex h-full w-full items-center justify-center rounded-full bg-card text-2xl font-extrabold text-primary"
            style={{ fontFamily: 'var(--font-exo2, "Exo 2", sans-serif)' }}
          >
            {initials}
          </div>
        </div>

        {/* Text block */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h2
            className="truncate text-[22px] font-bold leading-tight text-foreground"
            style={{ fontFamily: 'var(--font-sora, Sora, sans-serif)' }}
          >
            {displayName}
          </h2>
          {roleLine && (
            <p className="mt-0.5 truncate text-[14px] text-muted-foreground">{roleLine}</p>
          )}
        </div>
      </div>

      {/* FadeUp animation */}
      <style>{`
        .hero-fade-in {
          animation: heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
