'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FolderTree,
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Building2,
  MapPin,
  Calendar,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';

export default function OrgUnitDetailPage() {
  const t = useTranslations('admin.orgUnits');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [orgUnit, setOrgUnit] = useState<OrgUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<OrgUnit[]>([]);

  const fetchOrgUnit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.orgUnits.getOrgUnitById(id);
      setOrgUnit(result);

      // Fetch children
      const allUnits = await api.orgUnits.getOrgUnits({ parent_id: id });
      setChildren(allUnits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento unità');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrgUnit();
  }, [fetchOrgUnit]);

  const handleDelete = async () => {
    if (!orgUnit) return;
    if (!confirm(`Sei sicuro di voler eliminare "${orgUnit.name}"?`)) return;

    try {
      await api.orgUnits.deleteOrgUnit(id);
      router.push('/admin/org-units');
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
        <ApiError message={error} onRetry={fetchOrgUnit} />
      </div>
    );
  }

  if (!orgUnit) {
    return (
      <div className="p-6">
        <ApiError message="Unità organizzativa non trovata" />
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
          <Link href="/admin/org-units">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderTree className="h-6 w-6" />
              {orgUnit.name}
            </h1>
            <p className="text-muted-foreground font-mono">{orgUnit.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/org-units/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              {tCommon('edit')}
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.details')}</CardTitle>
              <CardDescription>{t('detail.unitInfo')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Nome</p>
                <p className="font-medium">{orgUnit.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Codice</p>
                <p className="font-mono">{orgUnit.code}</p>
              </div>
              {orgUnit.description && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">Descrizione</p>
                  <p>{orgUnit.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tipo</p>
                <p>{orgUnit.org_type || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Livello</p>
                <p>{orgUnit.org_level}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Stato</p>
                <Badge variant={orgUnit.is_active ? 'default' : 'secondary'}>
                  {orgUnit.is_active ? 'Attivo' : 'Inattivo'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Relationships Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.relationships')}</CardTitle>
              <CardDescription>{t('detail.entityLinks')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Dipartimento</p>
                  <p className="font-medium">{orgUnit.department_name || 'Non assegnato'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Manager</p>
                  <p className="font-medium">{orgUnit.manager_name || 'Non assegnato'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Sede</p>
                  <p className="font-medium">{orgUnit.location_name || 'Non assegnata'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Dipendenti</p>
                  <p className="font-medium">{orgUnit.employee_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Child Units */}
          {children.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('detail.childUnits')} ({children.length})
                </CardTitle>
                <CardDescription>{t('detail.childUnitsDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/admin/org-units/${child.id}`}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-muted-foreground">{child.code}</p>
                        </div>
                      </div>
                      <Badge variant={child.is_active ? 'default' : 'secondary'}>
                        {child.is_active ? 'Attivo' : 'Inattivo'}
                      </Badge>
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
              <CardTitle>{t('detail.statistics')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('detail.employees')}</span>
                <span className="font-bold">{orgUnit.employee_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unità figlie</span>
                <span className="font-bold">{children.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Livello</span>
                <span className="font-bold">{orgUnit.org_level}</span>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.systemInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Creato</p>
                  <p>{new Date(orgUnit.created_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Aggiornato</p>
                  <p>{new Date(orgUnit.updated_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{orgUnit.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
