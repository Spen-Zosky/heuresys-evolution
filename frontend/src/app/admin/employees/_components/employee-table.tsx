'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Employee, Pagination } from '@/lib/api/types';

interface EmployeeTableProps {
  employees: Employee[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  selectedIds: Set<string>;
  hasFilters: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

function getStatusBadge(status: string, isActive: boolean) {
  if (!isActive) {
    return <Badge variant="destructive">Inattivo</Badge>;
  }
  switch (status) {
    case 'active':
      return (
        <Badge variant="default" className="bg-green-500">
          Attivo
        </Badge>
      );
    case 'on_leave':
      return <Badge variant="secondary">In congedo</Badge>;
    case 'terminated':
      return <Badge variant="destructive">Terminato</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function EmployeeTable({
  employees,
  pagination,
  loading,
  error,
  selectedIds,
  hasFilters,
  onToggleSelect,
  onToggleSelectAll,
  onPageChange,
  onRetry,
}: EmployeeTableProps) {
  const allSelected = useMemo(() => {
    return employees.length > 0 && employees.every((e) => selectedIds.has(e.id));
  }, [employees, selectedIds]);

  const someSelected = useMemo(() => {
    return employees.some((e) => selectedIds.has(e.id)) && !allSelected;
  }, [employees, selectedIds, allSelected]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[300px]" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <ApiError message={error} onRetry={onRetry} />;
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center text-center">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nessun dipendente trovato</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters
                ? 'Prova a modificare i filtri di ricerca'
                : 'Inizia aggiungendo il primo dipendente'}
            </p>
            {!hasFilters && (
              <Button asChild className="mt-4">
                <Link href="/admin/employees/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Dipendente
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {pagination?.total || employees.length} dipendenti
            </CardTitle>
            <CardDescription>
              Pagina {pagination?.page || 1} di {pagination?.totalPages || 1}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Seleziona tutti"
                    className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                  />
                </TableHead>
                <TableHead>Dipendente</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Dipartimento</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Data Assunzione</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className={`group ${selectedIds.has(employee.id) ? 'bg-primary/5' : ''}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(employee.id)}
                      onCheckedChange={() => onToggleSelect(employee.id)}
                      aria-label={`Seleziona ${employee.first_name} ${employee.last_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/employees/${employee.id}`}
                      className="flex items-center gap-3 hover:text-primary transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                        {employee.first_name[0]}
                        {employee.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.email}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{employee.job_title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[150px]" title={employee.department_name}>
                        {employee.department_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[140px]" title={employee.location_name}>
                        {employee.location_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(employee.hire_date)}</TableCell>
                  <TableCell>
                    {getStatusBadge(employee.employment_status, employee.is_active)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="More options"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/employees/${employee.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizza
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/employees/${employee.id}/edit`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifica
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)} di {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Precedente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Successivo
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
