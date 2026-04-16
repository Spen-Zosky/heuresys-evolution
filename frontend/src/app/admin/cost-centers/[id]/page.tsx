'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CircleDollarSign,
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Building2,
  Calendar,
  TrendingUp,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { CostCenter } from '@/lib/api/types';
import { useTranslations } from 'next-intl';

const formatCurrency = (amount: number | null | undefined) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
};

export default function CostCenterDetailPage() {
  const t = useTranslations('admin.costCenters.detail');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [costCenter, setCostCenter] = useState<CostCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<CostCenter[]>([]);

  const fetchCostCenter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.costCenters.getCostCenterById(id);
      setCostCenter(result);

      // Fetch children
      const allCenters = await api.costCenters.getCostCenters({ parent_id: id });
      setChildren(allCenters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento centro di costo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCostCenter();
  }, [fetchCostCenter]);

  const handleDelete = async () => {
    if (!costCenter) return;
    if (!confirm(`Sei sicuro di voler eliminare "${costCenter.name}"?`)) return;

    try {
      await api.costCenters.deleteCostCenter(id);
      router.push('/admin/cost-centers');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchCostCenter} />
      </div>
    );
  }

  if (!costCenter) {
    return (
      <div className="p-6">
        <ApiError message="Centro di costo non trovato" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/cost-centers">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CircleDollarSign className="h-6 w-6" />
              {costCenter.name}
            </h1>
            <p className="text-muted-foreground font-mono">{costCenter.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/cost-centers/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              Modifica
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Elimina
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Dettagli</CardTitle>
              <CardDescription>Informazioni sul centro di costo</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Nome</p>
                <p className="font-medium">{costCenter.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Codice</p>
                <p className="font-mono">{costCenter.code}</p>
              </div>
              {costCenter.description && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">Descrizione</p>
                  <p>{costCenter.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tipo</p>
                <p>{costCenter.cost_center_type || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Budget</p>
                <p className="font-medium text-lg">
                  {costCenter.budget_annual_eur
                    ? formatCurrency(costCenter.budget_annual_eur)
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Stato</p>
                <Badge variant={costCenter.is_active ? 'default' : 'secondary'}>
                  {costCenter.is_active ? 'Attivo' : 'Inattivo'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Relationships Card */}
          <Card>
            <CardHeader>
              <CardTitle>Relazioni</CardTitle>
              <CardDescription>Collegamenti con altre entità</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Unità Organizzativa</p>
                  <p className="font-medium">{costCenter.org_unit_name || 'Non assegnato'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Responsabile</p>
                  <p className="font-medium">{costCenter.responsible_name || 'Non assegnato'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Dipendenti Assegnati</p>
                  <p className="font-medium">{costCenter.employee_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Child Centers */}
          {children.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Centri Figli ({children.length})</CardTitle>
                <CardDescription>Centri di costo sotto questo centro</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/admin/cost-centers/${child.id}`}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-muted-foreground">{child.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {child.budget_annual_eur && (
                          <span className="text-sm font-mono">
                            {formatCurrency(child.budget_annual_eur)}
                          </span>
                        )}
                        <Badge variant={child.is_active ? 'default' : 'secondary'}>
                          {child.is_active ? 'Attivo' : 'Inattivo'}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Statistiche</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Budget
                </span>
                <span className="font-bold">
                  {costCenter.budget_annual_eur
                    ? formatCurrency(costCenter.budget_annual_eur)
                    : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dipendenti</span>
                <span className="font-bold">{costCenter.employee_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Centri Figli</span>
                <span className="font-bold">{children.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Creato</p>
                  <p>{new Date(costCenter.created_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Aggiornato</p>
                  <p>{new Date(costCenter.updated_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{costCenter.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
