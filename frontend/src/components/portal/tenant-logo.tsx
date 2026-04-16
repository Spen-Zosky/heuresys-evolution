'use client';

import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TenantLogo — SVG logo per tenant
// ============================================================================

interface TenantLogoProps {
  tenantCode: string;
  className?: string;
}

function RtlBankLogo({ className }: { className?: string }) {
  return (
    <svg
      width="160"
      height="34"
      viewBox="0 0 160 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="RTL Bank"
    >
      <defs>
        <linearGradient id="rtl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(239 84% 67%)" />
          <stop offset="100%" stopColor="hsl(271 81% 56%)" />
        </linearGradient>
      </defs>
      {/* Hexagon with R */}
      <path d="M17 2 L29 9 L29 23 L17 30 L5 23 L5 9 Z" fill="url(#rtl-grad)" opacity="0.9" />
      <text
        x="17"
        y="20"
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="700"
        fontFamily="'Sora', sans-serif"
      >
        R
      </text>
      {/* Text */}
      <text
        x="40"
        y="21"
        fill="url(#rtl-grad)"
        fontSize="16"
        fontWeight="700"
        fontFamily="'Sora', sans-serif"
      >
        RTL Bank
      </text>
    </svg>
  );
}

function SmartFoodLogo({ className }: { className?: string }) {
  return (
    <svg
      width="160"
      height="34"
      viewBox="0 0 160 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SmartFood"
    >
      <defs>
        <linearGradient id="sf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(142 71% 45%)" />
          <stop offset="100%" stopColor="hsl(38 92% 50%)" />
        </linearGradient>
      </defs>
      {/* Circle with leaf sprout */}
      <circle cx="17" cy="17" r="14" fill="url(#sf-grad)" opacity="0.9" />
      <path
        d="M12 22 C12 22, 14 12, 22 10 C22 10, 16 14, 16 22"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="20" cy="12" r="2" fill="white" opacity="0.7" />
      {/* Text */}
      <text
        x="40"
        y="21"
        fill="url(#sf-grad)"
        fontSize="16"
        fontWeight="700"
        fontFamily="'Sora', sans-serif"
      >
        SmartFood
      </text>
    </svg>
  );
}

function EcoNovaLogo({ className }: { className?: string }) {
  return (
    <svg
      width="160"
      height="34"
      viewBox="0 0 160 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="EcoNova"
    >
      <defs>
        <linearGradient id="en-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(38 92% 50%)" />
          <stop offset="100%" stopColor="hsl(142 71% 45%)" />
        </linearGradient>
      </defs>
      {/* Circle with leaf curve */}
      <circle cx="17" cy="17" r="14" fill="url(#en-grad)" opacity="0.9" />
      <path
        d="M10 24 Q17 6 26 12"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M17 17 Q20 14 24 13"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Text */}
      <text
        x="40"
        y="21"
        fill="url(#en-grad)"
        fontSize="16"
        fontWeight="700"
        fontFamily="'Sora', sans-serif"
      >
        EcoNova
      </text>
    </svg>
  );
}

function DefaultLogo({ tenantCode, className }: { tenantCode: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
      <span
        className="text-base font-bold text-foreground"
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        {tenantCode}
      </span>
    </div>
  );
}

export function TenantLogo({ tenantCode, className }: TenantLogoProps) {
  const normalizedCode = tenantCode?.toLowerCase().replace(/[-_\s]/g, '');

  switch (normalizedCode) {
    case 'rtlbank':
      return <RtlBankLogo className={className} />;
    case 'smartfood':
      return <SmartFoodLogo className={className} />;
    case 'econova':
      return <EcoNovaLogo className={className} />;
    default:
      return <DefaultLogo tenantCode={tenantCode} className={className} />;
  }
}
