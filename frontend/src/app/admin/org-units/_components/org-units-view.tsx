'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FolderTree,
  Search,
  RefreshCw,
  Users,
  Building2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface OrgUnitsViewProps {
  /** When true, hides CRUD actions (create/edit/delete) and admin links */
  readOnly?: boolean;
  /** Optional slot rendered in the header area (e.g. "Nuova Unità" button) */
  headerActions?: React.ReactNode;
  /** Optional render function for per-row actions column */
  renderRowActions?: (unit: OrgUnit) => React.ReactNode;
}

interface OrgUnitsState {
  orgUnits: OrgUnit[];
  loading: boolean;
  error: string | null;
}

export function OrgUnitsView({
  readOnly = false,
  headerActions,
  renderRowActions,
}: OrgUnitsViewProps) {
  const [state, setState] = useState<OrgUnitsState>({
    orgUnits: [],
    loading: true,
    error: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [types, setTypes] = useState<string[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');

  // Auto-expand root + first level when entering tree view (better default UX)
  useEffect(() => {
    if (viewMode !== 'tree' || state.orgUnits.length === 0) return;
    const roots = state.orgUnits.filter((u) => !u.parent_id);
    const firstLevel = state.orgUnits.filter(
      (u) => u.parent_id && roots.some((r) => r.id === u.parent_id)
    );
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      [...roots, ...firstLevel].forEach((u) => next.add(u.id));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, state.orgUnits.length]);

  const fetchOrgUnits = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      const orgType = typeFilter === 'all' ? undefined : typeFilter;

      const result = await api.orgUnits.getOrgUnits({
        is_active: isActive,
        org_type: orgType,
        search: searchInput || undefined,
        limit: 200,
      });

      setState({ orgUnits: result, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento unità organizzative',
      }));
    }
  }, [statusFilter, typeFilter, searchInput]);

  const fetchTypes = useCallback(async () => {
    try {
      const result = await api.orgUnits.getOrgUnitTypes();
      setTypes(result);
    } catch {
      // Types are optional
    }
  }, []);

  useEffect(() => {
    fetchOrgUnits();
    fetchTypes();
  }, [fetchOrgUnits, fetchTypes]);

  const filteredOrgUnits = state.orgUnits.filter((unit) => {
    if (!searchInput) return true;
    const search = searchInput.toLowerCase();
    return (
      unit.name.toLowerCase().includes(search) ||
      unit.code.toLowerCase().includes(search) ||
      unit.department_name?.toLowerCase().includes(search)
    );
  });

  const buildTree = (units: OrgUnit[]): OrgUnit[] => {
    return units.filter((u) => !u.parent_id);
  };

  const getChildren = (parentId: string): OrgUnit[] => {
    return state.orgUnits.filter((u) => u.parent_id === parentId);
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTreeNode = (unit: OrgUnit, level: number = 0) => {
    const children = getChildren(unit.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(unit.id);

    const nameContent = readOnly ? (
      <span className="flex-1">
        <span className="font-medium">{unit.name}</span>
        <span className="text-muted-foreground ml-2">({unit.code})</span>
      </span>
    ) : (
      <Link href={`/admin/org-units/${unit.id}`} className="flex-1 hover:underline">
        <span className="font-medium">{unit.name}</span>
        <span className="text-muted-foreground ml-2">({unit.code})</span>
      </Link>
    );

    return (
      <div key={unit.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md cursor-pointer"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggleExpand(unit.id)} className="p-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          {nameContent}
          <Badge variant={unit.is_active ? 'default' : 'secondary'}>
            {unit.is_active ? 'Attivo' : 'Inattivo'}
          </Badge>
          {unit.employee_count !== undefined && unit.employee_count > 0 && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {unit.employee_count}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>{children.map((child) => renderTreeNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  if (state.loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.error) {
    return <ApiError message={state.error} onRetry={fetchOrgUnits} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderTree className="h-6 w-6" />
            Unità Organizzative
          </h1>
          <p className="text-muted-foreground">
            {readOnly
              ? `Struttura organizzativa aziendale (${state.orgUnits.length} unità)`
              : "Gestisci la struttura organizzativa dell'azienda"}
          </p>
        </div>
        {headerActions}
      </div>

      {/* Stats Cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FolderTree className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Totale Unità</p>
                  <p className="text-2xl font-bold">{state.orgUnits.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unità Attive</p>
                  <p className="text-2xl font-bold">
                    {state.orgUnits.filter((u) => u.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dipendenti Assegnati</p>
                  <p className="text-2xl font-bold">
                    {state.orgUnits.reduce((sum, u) => sum + (Number(u.employee_count) || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome, codice..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attivo</SelectItem>
                <SelectItem value="inactive">Inattivo</SelectItem>
              </SelectContent>
            </Select>
            {types.length > 0 && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tipi</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                Tabella
              </Button>
              <Button
                variant={viewMode === 'tree' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('tree')}
              >
                Albero
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchOrgUnits}
              aria-label="Aggiorna unità organizzative"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Unità Organizzative ({filteredOrgUnits.length})</CardTitle>
          <CardDescription>
            {readOnly ? 'Struttura organizzativa' : 'Lista delle unità organizzative'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Dipartimento</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-center">Dipendenti</TableHead>
                    <TableHead>Stato</TableHead>
                    {!readOnly && renderRowActions && (
                      <TableHead className="text-right">Azioni</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgUnits.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={readOnly ? 7 : 8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Nessuna unità organizzativa trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrgUnits.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-mono text-sm">{unit.code}</TableCell>
                        <TableCell>
                          {readOnly ? (
                            <span className="font-medium">{unit.name}</span>
                          ) : (
                            <Link
                              href={`/admin/org-units/${unit.id}`}
                              className="font-medium hover:underline"
                            >
                              {unit.name}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>
                          {unit.org_type && <Badge variant="outline">{unit.org_type}</Badge>}
                        </TableCell>
                        <TableCell>{unit.department_name || '-'}</TableCell>
                        <TableCell>{unit.manager_name || '-'}</TableCell>
                        <TableCell className="text-center">{unit.employee_count || 0}</TableCell>
                        <TableCell>
                          <Badge variant={unit.is_active ? 'default' : 'secondary'}>
                            {unit.is_active ? 'Attivo' : 'Inattivo'}
                          </Badge>
                        </TableCell>
                        {!readOnly && renderRowActions && (
                          <TableCell className="text-right">{renderRowActions(unit)}</TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              {buildTree(filteredOrgUnits).length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nessuna unità organizzativa trovata
                </p>
              ) : (
                buildTree(filteredOrgUnits).map((unit) => renderTreeNode(unit))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
