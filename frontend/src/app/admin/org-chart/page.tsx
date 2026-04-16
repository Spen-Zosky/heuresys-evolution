'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Network,
  RefreshCw,
  ZoomIn,
  Maximize2,
  Filter,
  Building2,
  Users,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { OrgChart } from '@/components/charts/org-chart';
import { api } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// ORG CHART PAGE
// ============================================

export default function OrgChartPage() {
  const t = useTranslations('admin.orgChart');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchOrgUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      const result = await api.orgUnits.getOrgUnits({ is_active: isActive, limit: 500 });
      setOrgUnits(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento organigramma');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrgUnits();
  }, [fetchOrgUnits]);

  const handleNodeClick = useCallback((orgUnit: OrgUnit) => {
    setSelectedUnit(orgUnit);
  }, []);

  const handleViewDetails = useCallback(() => {
    if (selectedUnit) {
      router.push(`/admin/org-units/${selectedUnit.id}`);
    }
  }, [selectedUnit, router]);

  // Calculate stats
  const stats = {
    total: orgUnits.length,
    active: orgUnits.filter((u) => u.is_active).length,
    rootUnits: orgUnits.filter((u) => !u.parent_id).length,
    totalEmployees: orgUnits.reduce((sum, u) => sum + (Number(u.employee_count) || 0), 0),
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchOrgUnits} />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 p-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="h-6 w-6" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Solo Attivi</SelectItem>
                <SelectItem value="inactive">Solo Inattivi</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchOrgUnits}
              aria-label="Aggiorna organigramma"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Totale Unità</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <ZoomIn className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Attive</p>
                    <p className="text-xl font-bold">{stats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Network className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Radici</p>
                    <p className="text-xl font-bold">{stats.rootUnits}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Users className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dipendenti</p>
                    <p className="text-xl font-bold">{stats.totalEmployees}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Org Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('organizationalStructure')}</CardTitle>
            <CardDescription>
              Clicca su un nodo per vedere i dettagli. Usa scroll per zoom, trascina per muoverti.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <OrgChart
              orgUnits={orgUnits}
              onNodeClick={handleNodeClick}
              height={isFullscreen ? 'calc(100vh - 300px)' : 600}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Details Sheet */}
      <Sheet open={!!selectedUnit} onOpenChange={() => setSelectedUnit(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedUnit?.name}
            </SheetTitle>
            <SheetDescription className="font-mono">{selectedUnit?.code}</SheetDescription>
          </SheetHeader>
          {selectedUnit && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div>
                <Badge variant={selectedUnit.is_active ? 'default' : 'secondary'}>
                  {selectedUnit.is_active ? 'Attivo' : 'Inattivo'}
                </Badge>
              </div>

              {/* Info */}
              <div className="space-y-4">
                {selectedUnit.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Descrizione</p>
                    <p className="text-sm">{selectedUnit.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Livello Organizzativo</p>
                  <p className="text-sm">{selectedUnit.org_level}</p>
                </div>
                {selectedUnit.org_type && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Tipo</p>
                    <Badge variant="outline">{selectedUnit.org_type}</Badge>
                  </div>
                )}
              </div>

              {/* Relationships */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Relazioni</h4>
                {selectedUnit.manager_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Responsabile</p>
                      <p className="text-sm font-medium">{selectedUnit.manager_name}</p>
                    </div>
                  </div>
                )}
                {selectedUnit.department_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Dipartimento</p>
                      <p className="text-sm font-medium">{selectedUnit.department_name}</p>
                    </div>
                  </div>
                )}
                {selectedUnit.location_name && (
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Sede</p>
                      <p className="text-sm font-medium">{selectedUnit.location_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dipendenti Assegnati</span>
                  <span className="font-bold">{selectedUnit.employee_count || 0}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleViewDetails} className="flex-1">
                  {tCommon('viewDetails')}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
