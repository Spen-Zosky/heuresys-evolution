'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCertifications } from '@/lib/hooks/use-governance-queries';
import type { Certification, CertificationStatus } from '@/lib/api/endpoints/governance';

const STATUS_CONFIG: Record<
  CertificationStatus,
  {
    label: string;
    icon: React.ElementType;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
  }
> = {
  active: { label: 'Attiva', icon: CheckCircle, variant: 'default', className: 'text-green-600' },
  expiring: {
    label: 'In scadenza',
    icon: AlertTriangle,
    variant: 'outline',
    className: 'text-amber-600',
  },
  expired: {
    label: 'Scaduta',
    icon: XCircle,
    variant: 'destructive',
    className: 'text-destructive',
  },
  pending: {
    label: 'In attesa',
    icon: Clock,
    variant: 'secondary',
    className: 'text-muted-foreground',
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CertificationTracker() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useCertifications({
    status: statusFilter !== 'all' ? (statusFilter as CertificationStatus) : undefined,
    limit: 100,
  });

  const certs: Certification[] = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-44" />
        <Card>
          <CardContent className="pt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {certs.length} certificazione{certs.length !== 1 ? 'i' : ''}
        </p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filtra stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attive</SelectItem>
            <SelectItem value="expiring">In scadenza</SelectItem>
            <SelectItem value="expired">Scadute</SelectItem>
            <SelectItem value="pending">In attesa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificazioni dipendenti</CardTitle>
        </CardHeader>
        <CardContent>
          {!certs.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nessuna certificazione trovata.
            </p>
          ) : (
            <div className="divide-y">
              {certs.map((cert) => {
                const cfg = STATUS_CONFIG[cert.status];
                const StatusIcon = cfg.icon;
                return (
                  <div key={cert.id} className="flex items-center gap-4 py-3">
                    <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.className}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cert.certification_name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {cert.employee_name && (
                          <span className="text-xs text-muted-foreground">
                            {cert.employee_name}
                          </span>
                        )}
                        {cert.issuer && (
                          <span className="text-xs text-muted-foreground">· {cert.issuer}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <Badge variant={cfg.variant} className="text-xs">
                        {cfg.label}
                      </Badge>
                      {cert.expiry_date && (
                        <p className="text-xs text-muted-foreground">
                          Scad. {formatDate(cert.expiry_date)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
