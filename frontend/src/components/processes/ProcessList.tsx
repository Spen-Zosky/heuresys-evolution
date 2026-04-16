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
import { ProcessCategoryBadge } from './ProcessCategoryBadge';
import { useProcessList } from '@/lib/hooks/use-process-queries';
import { useProcessStore } from '@/lib/stores/process-store';
import { AlertCircle, Search } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Tutte le categorie' },
  { value: 'core', label: 'Core' },
  { value: 'support', label: 'Support' },
  { value: 'management', label: 'Management' },
];

export function ProcessList() {
  const router = useRouter();
  const { filters, setFilter, resetFilters } = useProcessStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  const queryFilters = {
    category: filters.category || undefined,
    search: filters.search || undefined,
  };

  const { data: processes, isLoading, isError, refetch } = useProcessList(queryFilters);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter('search', searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setFilter]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      setFilter('category', value === 'all' ? null : value);
    },
    [setFilter]
  );

  const handleRowClick = useCallback(
    (processId: string) => {
      router.push(`/company-pet/processes/${processId}`);
    },
    [router]
  );

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-semibold">Errore nel caricamento dei processi</p>
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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca processi..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filters.category || 'all'} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Fasi</TableHead>
                <TableHead className="text-center">Ruoli</TableHead>
                <TableHead className="text-center">Skill</TableHead>
                <TableHead className="text-center">KPI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : processes && processes.length > 0 ? (
                processes.map((process) => (
                  <TableRow
                    key={process.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(process.id)}
                  >
                    <TableCell className="font-mono text-sm">{process.processCode}</TableCell>
                    <TableCell className="font-medium">{process.processName}</TableCell>
                    <TableCell>
                      <ProcessCategoryBadge category={process.processCategory} />
                    </TableCell>
                    <TableCell className="text-center">{process.phaseCount}</TableCell>
                    <TableCell className="text-center">{process.roleCount}</TableCell>
                    <TableCell className="text-center">{process.skillCount}</TableCell>
                    <TableCell className="text-center">{process.kpiCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      type="search"
                      title="Nessun processo trovato"
                      description={
                        filters.search || filters.category
                          ? 'Prova a modificare i filtri di ricerca.'
                          : 'Non ci sono processi configurati per questo tenant.'
                      }
                      action={
                        filters.search || filters.category
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
      </Card>
    </div>
  );
}
