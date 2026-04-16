'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Users,
  UserCheck,
  Landmark,
  Target,
  GraduationCap,
  RefreshCw,
  AlertCircle,
  Calendar,
  Hash,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tenant {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
}

interface TenantStats {
  id: string;
  name: string;
  code: string;
  status: string;
  employees: number;
  departments: number;
  org_units: number;
  cost_centers: number;
  locations: number;
  goals: number;
  courses: number;
  users: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'default' as const;
    case 'suspended':
      return 'destructive' as const;
    case 'pending':
      return 'outline' as const;
    default:
      return 'secondary' as const;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'active':
      return 'Attivo';
    case 'inactive':
      return 'Inattivo';
    case 'suspended':
      return 'Sospeso';
    case 'pending':
      return 'In Attesa';
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Stat card items
// ---------------------------------------------------------------------------

const statCards = [
  { key: 'employees' as const, label: 'Dipendenti', icon: Users },
  { key: 'users' as const, label: 'Utenti', icon: UserCheck },
  { key: 'departments' as const, label: 'Dipartimenti', icon: Landmark },
  { key: 'goals' as const, label: 'Obiettivi', icon: Target },
  { key: 'courses' as const, label: 'Corsi', icon: GraduationCap },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TenantDetailPage() {
  const t = useTranslations('platform');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch tenant detail and platform dashboard stats in parallel
      const [tenantRes, dashboardRes] = await Promise.all([
        apiClient.get<{ data: Tenant }>(`/api/v1/tenants/${id}`),
        apiClient.get<{ data: { tenants: TenantStats[] } }>('/api/v1/platform/dashboard'),
      ]);

      setTenant(tenantRes.data);

      // Find this tenant in the dashboard stats array
      const tenantStats = dashboardRes.data.tenants.find((t: TenantStats) => t.id === id);
      if (tenantStats) {
        setStats(tenantStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dati tenant');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && !tenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Indietro
              </Button>
              <Button onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Riprova
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!tenant) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <Link href="/platform" className="hover:text-foreground transition-colors">
          Piattaforma
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/platform/tenants" className="hover:text-foreground transition-colors">
          Tenant
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{tenant.name}</span>
      </div>

      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {tenant.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tenant.code}</code>
              <Badge variant={statusVariant(tenant.status)}>{statusLabel(tenant.status)}</Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} title={t('common.refresh')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Statistiche */}
      {stats && (
        <motion.div variants={staggerItem}>
          <h2 className="text-lg font-medium mb-3">Statistiche</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map(({ key, label, icon: Icon }) => (
              <Card key={key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {stats[key]?.toLocaleString('it-IT') ?? '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Informazioni */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informazioni</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  ID
                </dt>
                <dd className="mt-0.5 font-mono text-sm break-all">{tenant.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Codice
                </dt>
                <dd className="mt-0.5">
                  <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{tenant.code}</code>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Stato
                </dt>
                <dd className="mt-0.5">
                  <Badge variant={statusVariant(tenant.status)}>{statusLabel(tenant.status)}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Data creazione
                </dt>
                <dd className="mt-0.5">
                  {new Date(tenant.created_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
