'use client';

import { useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  RefreshCw,
  X,
  Save,
  Star,
  UserCheck,
  Clock,
  Briefcase,
  Bookmark,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import type { EmployeeFilters as EmployeeFiltersType } from '@/lib/api/types';

export interface AdvancedFilters {
  hire_date_from?: string;
  hire_date_to?: string;
  location_id?: string;
  org_unit_id?: string;
  job_title?: string;
  employment_status?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: EmployeeFiltersType & AdvancedFilters;
}

// Quick filter presets
const QUICK_PRESETS = [
  { id: 'new_hires', label: 'Nuove Assunzioni (30gg)', icon: Star },
  { id: 'active_only', label: 'Solo Attivi', icon: UserCheck },
  { id: 'on_leave', label: 'In Congedo', icon: Clock },
  { id: 'senior', label: 'Senior (5+ anni)', icon: Briefcase },
] as const;

interface EmployeeFiltersProps {
  filters: EmployeeFiltersType & { page: number; limit: number };
  searchInput: string;
  advancedFilters: AdvancedFilters;
  showAdvanced: boolean;
  activePreset: string | null;
  savedSearches: SavedSearch[];
  saveSearchName: string;
  showSaveDialog: boolean;
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  orgUnits: { id: string; name: string }[];
  onFiltersChange: (
    updater: (
      prev: EmployeeFiltersType & { page: number; limit: number }
    ) => EmployeeFiltersType & { page: number; limit: number }
  ) => void;
  onSearchInputChange: (value: string) => void;
  onAdvancedFiltersChange: (updater: (prev: AdvancedFilters) => AdvancedFilters) => void;
  onShowAdvancedChange: (show: boolean) => void;
  onActivePresetChange: (preset: string | null) => void;
  onSavedSearchesChange: (updater: (prev: SavedSearch[]) => SavedSearch[]) => void;
  onSaveSearchNameChange: (name: string) => void;
  onShowSaveDialogChange: (show: boolean) => void;
  onRefresh: () => void;
}

export function EmployeeFiltersPanel({
  filters,
  searchInput,
  advancedFilters,
  showAdvanced,
  activePreset,
  savedSearches,
  saveSearchName,
  showSaveDialog,
  departments,
  locations,
  orgUnits,
  onFiltersChange,
  onSearchInputChange,
  onAdvancedFiltersChange,
  onShowAdvancedChange,
  onActivePresetChange,
  onSavedSearchesChange,
  onSaveSearchNameChange,
  onShowSaveDialogChange,
  onRefresh,
}: EmployeeFiltersProps) {
  // Apply quick preset
  const applyPreset = useCallback(
    (presetId: string) => {
      onActivePresetChange(presetId);
      const today = new Date();

      switch (presetId) {
        case 'new_hires': {
          const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          onAdvancedFiltersChange(() => ({
            hire_date_from: thirtyDaysAgo.toISOString().split('T')[0],
          }));
          break;
        }
        case 'active_only':
          onFiltersChange((prev) => ({ ...prev, is_active: true, page: 1 }));
          onAdvancedFiltersChange(() => ({}));
          break;
        case 'on_leave':
          onAdvancedFiltersChange(() => ({ employment_status: 'on_leave' }));
          break;
        case 'senior': {
          const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
          onAdvancedFiltersChange(() => ({
            hire_date_to: fiveYearsAgo.toISOString().split('T')[0],
          }));
          break;
        }
      }
    },
    [onActivePresetChange, onAdvancedFiltersChange, onFiltersChange]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    onFiltersChange(() => ({ page: 1, limit: 15, search: '', is_active: undefined }));
    onAdvancedFiltersChange(() => ({}));
    onActivePresetChange(null);
    onSearchInputChange('');
  }, [onFiltersChange, onAdvancedFiltersChange, onActivePresetChange, onSearchInputChange]);

  // Save current search
  const saveCurrentSearch = useCallback(() => {
    if (!saveSearchName.trim()) return;
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName,
      filters: { ...filters, ...advancedFilters },
    };
    onSavedSearchesChange((prev) => [...prev, newSearch]);
    onSaveSearchNameChange('');
    onShowSaveDialogChange(false);
  }, [
    saveSearchName,
    filters,
    advancedFilters,
    onSavedSearchesChange,
    onSaveSearchNameChange,
    onShowSaveDialogChange,
  ]);

  // Apply saved search
  const applySavedSearch = useCallback(
    (search: SavedSearch) => {
      onFiltersChange((prev) => ({ ...prev, ...search.filters, page: 1 }));
      onAdvancedFiltersChange(() => search.filters as AdvancedFilters);
      onActivePresetChange(null);
    },
    [onFiltersChange, onAdvancedFiltersChange, onActivePresetChange]
  );

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.is_active !== undefined) count++;
    if (filters.org_unit_id) count++;
    if (advancedFilters.hire_date_from) count++;
    if (advancedFilters.hire_date_to) count++;
    if (advancedFilters.location_id) count++;
    if (advancedFilters.org_unit_id) count++;
    if (advancedFilters.job_title) count++;
    if (advancedFilters.employment_status) count++;
    return count;
  }, [filters, advancedFilters]);

  // Handle search
  const handleSearch = useCallback(() => {
    onFiltersChange((prev) => ({ ...prev, search: searchInput, page: 1 }));
  }, [searchInput, onFiltersChange]);

  // Handle filter change
  const handleFilterChange = (
    key: keyof EmployeeFiltersType,
    value: string | boolean | undefined
  ) => {
    onFiltersChange((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, email, ruolo..."
                  value={searchInput}
                  onChange={(e) => onSearchInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>Cerca</Button>
            </div>

            {/* OrgUnit Filter */}
            <Select
              value={filters.org_unit_id || 'all'}
              onValueChange={(v) => handleFilterChange('org_unit_id', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[200px]">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Tutti i dipartimenti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i dipartimenti</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={
                filters.is_active === undefined ? 'all' : filters.is_active ? 'active' : 'inactive'
              }
              onValueChange={(v) => {
                if (v === 'all') handleFilterChange('is_active', undefined);
                else if (v === 'active') handleFilterChange('is_active', true);
                else handleFilterChange('is_active', false);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="inactive">Inattivi</SelectItem>
              </SelectContent>
            </Select>

            {/* Advanced Search Toggle */}
            <Button
              variant={showAdvanced ? 'secondary' : 'outline'}
              onClick={() => onShowAdvancedChange(!showAdvanced)}
              className="w-full sm:w-auto"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <span className="sm:inline">Avanzata</span>
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 w-5 p-0 flex items-center justify-center"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              className="shrink-0"
              aria-label="Aggiorna elenco"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Advanced Search Panel */}
          <Collapsible open={showAdvanced} onOpenChange={onShowAdvancedChange}>
            <CollapsibleContent>
              <Separator className="my-4" />
              <div className="space-y-4">
                {/* Quick Presets */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Filtri Rapidi</Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PRESETS.map((preset) => (
                      <Button
                        key={preset.id}
                        variant={activePreset === preset.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => applyPreset(preset.id)}
                      >
                        <preset.icon className="h-4 w-4 mr-1" />
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Saved Searches */}
                {savedSearches.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Ricerche Salvate</Label>
                    <div className="flex flex-wrap gap-2">
                      {savedSearches.map((search) => (
                        <Button
                          key={search.id}
                          variant="outline"
                          size="sm"
                          onClick={() => applySavedSearch(search)}
                        >
                          <Bookmark className="h-4 w-4 mr-1" />
                          {search.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Advanced Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm mb-1.5 block">Data Assunzione Da</Label>
                    <Input
                      type="date"
                      value={advancedFilters.hire_date_from || ''}
                      onChange={(e) =>
                        onAdvancedFiltersChange((prev) => ({
                          ...prev,
                          hire_date_from: e.target.value || undefined,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Data Assunzione A</Label>
                    <Input
                      type="date"
                      value={advancedFilters.hire_date_to || ''}
                      onChange={(e) =>
                        onAdvancedFiltersChange((prev) => ({
                          ...prev,
                          hire_date_to: e.target.value || undefined,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Sede</Label>
                    <Select
                      value={advancedFilters.location_id || 'all'}
                      onValueChange={(v) =>
                        onAdvancedFiltersChange((prev) => ({
                          ...prev,
                          location_id: v === 'all' ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tutte le sedi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte le sedi</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Unità Organizzativa</Label>
                    <Select
                      value={advancedFilters.org_unit_id || 'all'}
                      onValueChange={(v) =>
                        onAdvancedFiltersChange((prev) => ({
                          ...prev,
                          org_unit_id: v === 'all' ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tutte le unita" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte le unita</SelectItem>
                        {orgUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Ruolo</Label>
                    <Input
                      placeholder="Cerca ruolo..."
                      value={advancedFilters.job_title || ''}
                      onChange={(e) =>
                        onAdvancedFiltersChange((prev) => ({
                          ...prev,
                          job_title: e.target.value || undefined,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Stato Impiego</Label>
                    <Select
                      value={advancedFilters.employment_status || 'all'}
                      onValueChange={(v) =>
                        onAdvancedFiltersChange((prev) => ({
                          ...prev,
                          employment_status: v === 'all' ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tutti" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="active">Attivo</SelectItem>
                        <SelectItem value="on_leave">In Congedo</SelectItem>
                        <SelectItem value="terminated">Terminato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button onClick={onRefresh} className="w-full sm:w-auto">
                    <Search className="h-4 w-4 mr-2" />
                    Applica Filtri
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Azzera
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onShowSaveDialogChange(true)}
                    className="flex-1 sm:flex-none"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salva
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Save Search Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={onShowSaveDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salva Ricerca</DialogTitle>
            <DialogDescription>
              Salva i filtri correnti per un accesso rapido in futuro.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Nome Ricerca</Label>
            <Input
              value={saveSearchName}
              onChange={(e) => onSaveSearchNameChange(e.target.value)}
              placeholder="Es. Team Marketing Milano"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onShowSaveDialogChange(false)}>
              Annulla
            </Button>
            <Button onClick={saveCurrentSearch} disabled={!saveSearchName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
