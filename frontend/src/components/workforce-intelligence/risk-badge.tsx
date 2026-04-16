import { Badge } from '@/components/ui/badge';

const RISK_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#e03131', bg: '#fff5f5', label: 'Critico' },
  high: { color: '#f76707', bg: '#fff4e6', label: 'Alto' },
  moderate: { color: '#f59f00', bg: '#fff9db', label: 'Moderato' },
  healthy: { color: '#37b24d', bg: '#ebfbee', label: 'Sano' },
  CRITICAL_GAP: { color: '#e03131', bg: '#fff5f5', label: 'Gap Critico' },
  SCARCE: { color: '#f76707', bg: '#fff4e6', label: 'Scarso' },
  HEALTHY: { color: '#37b24d', bg: '#ebfbee', label: 'Sano' },
  WIDESPREAD: { color: '#2b8a3e', bg: '#d3f9d8', label: 'Diffuso' },
};

interface RiskBadgeProps {
  level: string;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = RISK_COLORS[level] ?? {
    color: '#868e96',
    bg: '#f8f9fa',
    label: level,
  };

  return (
    <Badge
      className={className}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: config.color,
      }}
      variant="outline"
    >
      {config.label}
    </Badge>
  );
}
