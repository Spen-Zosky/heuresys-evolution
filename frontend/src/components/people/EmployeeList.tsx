'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useEmployees } from '@/lib/hooks/use-people-queries';
import { useOrgUnits } from '@/lib/hooks/use-org-queries';
import { usePeopleStore } from '@/lib/stores/people-store';
import { AlertCircle, Search } from 'lucide-react';

export function EmployeeList() {
  const router = useRouter();
  const { filters, setFilter, resetFilters } = usePeopleStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  const queryParams = {
    search: filters.search || undefined,
    org_unit_id: filters.orgUnitId || undefined,
    limit: 50,
  };

  const { data, isLoading, isError, refetch } = useEmployees(queryParams);
  const { data: orgUnits } = useOrgUnits({ is_active: true, limit: 200 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter('search', searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setFilter]);

  const handleOrgUnitChange = useCallback(
    (value: string) => {
      setFilter('orgUnitId', value === 'all' ? null : value);
    },
    [setFilter]
  );

  const handleRowClick = useCallback(
    (employeeId: string) => {
      router.push(`/company-pet/people/${employeeId}`);
    },
    [router]
  );

  const employees = data?.employees ?? [];
  const pagination = data?.pagination;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-semibold">Errore nel caricamento dei dipendenti</p>
              <p className="text-sm text-muted-foreground">Si e' verificato un errore. Riprova.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome o email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filters.orgUnitId || 'all'} onValueChange={handleOrgUnitChange}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Unità organizzativa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le unita</SelectItem>
            {(orgUnits ?? []).map((ou) => (
              <SelectItem key={ou.id} value={ou.id}>
                {ou.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Unità Organizzativa</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead className="text-center">Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length > 0 ? (
                employees.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(emp.id)}
                  >
                    <TableCell className="font-medium">
                      {emp.first_name} {emp.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                    <TableCell>{emp.org_unit_name || emp.department_name || '–'}</TableCell>
                    <TableCell>{emp.job_title || '–'}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          emp.is_active
                            ? 'inline-block w-2 h-2 rounded-full bg-green-500'
                            : 'inline-block w-2 h-2 rounded-full bg-gray-400'
                        }
                        title={emp.is_active ? 'Attivo' : 'Inattivo'}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      type="search"
                      title="Nessun dipendente trovato"
                      description={
                        filters.search || filters.orgUnitId
                          ? 'Prova a modificare i filtri di ricerca.'
                          : 'Non ci sono dipendenti configurati per questo tenant.'
                      }
                      action={
                        filters.search || filters.orgUnitId
                          ? {
                              label: 'Resetta filtri',
                              onClick: () => {
                                resetFilters();
                                setSearchInput('');
                              },
                              variant: 'outline',
                            }
                          : undefined
                      }
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {pagination && pagination.total > 0 && (
          <div className="px-4 py-3 border-t text-sm text-muted-foreground">
            {employees.length} di {pagination.total} dipendenti
          </div>
        )}
      </Card>
    </div>
  );
}
