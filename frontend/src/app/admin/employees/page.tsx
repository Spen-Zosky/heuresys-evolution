'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Employee, EmployeeFilters, Pagination } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { EmployeeFiltersPanel, EmployeeBulkActions, EmployeeTable } from './_components';
import type { AdvancedFilters, SavedSearch } from './_components';

// ============================================
// TYPES
// ============================================

interface EmployeesState {
  employees: Employee[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function EmployeesPage() {
  const t = useTranslations('admin.employees');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<EmployeesState>({
    employees: [],
    pagination: null,
    loading: true,
    error: null,
  });

  const [filters, setFilters] = useState<EmployeeFilters & { page: number; limit: number }>({
    page: 1,
    limit: 50,
    search: '',
    is_active: undefined,
  });

  const [searchInput, setSearchInput] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [orgUnits, setOrgUnits] = useState<{ id: string; name: string }[]>([]);

  // Advanced search state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.employees.getEmployees({
        page: filters.page,
        limit: filters.limit,
        search: filters.search || undefined,
        is_active: filters.is_active,
        org_unit_id: filters.org_unit_id || undefined,
      });
      setState({
        employees: result.employees,
        pagination: result.pagination,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Errore nel caricamento dipendenti',
      }));
    }
  }, [filters]);

  // Fetch filter options

  const fetchLocations = useCallback(async () => {
    try {
      const result = await api.locations.getLocations({ limit: 100 });
      setLocations(result.map((l) => ({ id: l.id, name: l.name })));
    } catch {
      // Ignore location fetch errors
    }
  }, []);

  const fetchOrgUnits = useCallback(async () => {
    try {
      const result = await api.orgUnits.getOrgUnits({ limit: 100 });
      setOrgUnits(result.map((o) => ({ id: o.id, name: o.name })));
      setDepartments(result.map((d) => ({ id: d.id, name: d.name })));
    } catch {
      // Ignore org unit fetch errors
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchOrgUnits();
    fetchLocations();
    fetchOrgUnits();
  }, [fetchOrgUnits, fetchLocations, fetchOrgUnits]);

  // Selection handlers
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        state.employees.length > 0 && state.employees.every((e) => prev.has(e.id));
      return allSelected ? new Set() : new Set(state.employees.map((e) => e.id));
    });
  }, [state.employees]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Pagination handler
  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    setSelectedIds(new Set());
  }, []);

  const hasFilters = useMemo(
    () => !!(filters.search || filters.org_unit_id || filters.is_active !== undefined),
    [filters.search, filters.org_unit_id, filters.is_active]
  );

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Page Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/employees/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('newEmployee')}
          </Link>
        </Button>
      </motion.div>

      {/* Bulk Actions */}
      <EmployeeBulkActions
        selectedIds={selectedIds}
        employees={state.employees}
        onClearSelection={clearSelection}
        onRefresh={fetchEmployees}
      />

      {/* Filters */}
      <motion.div variants={staggerItem}>
        <EmployeeFiltersPanel
          filters={filters}
          searchInput={searchInput}
          advancedFilters={advancedFilters}
          showAdvanced={showAdvanced}
          activePreset={activePreset}
          savedSearches={savedSearches}
          saveSearchName={saveSearchName}
          showSaveDialog={showSaveDialog}
          departments={departments}
          locations={locations}
          orgUnits={orgUnits}
          onFiltersChange={setFilters}
          onSearchInputChange={setSearchInput}
          onAdvancedFiltersChange={setAdvancedFilters}
          onShowAdvancedChange={setShowAdvanced}
          onActivePresetChange={setActivePreset}
          onSavedSearchesChange={setSavedSearches}
          onSaveSearchNameChange={setSaveSearchName}
          onShowSaveDialogChange={setShowSaveDialog}
          onRefresh={fetchEmployees}
        />
      </motion.div>

      {/* Results Table */}
      <motion.div variants={staggerItem}>
        <EmployeeTable
          employees={state.employees}
          pagination={state.pagination}
          loading={state.loading}
          error={state.error}
          selectedIds={selectedIds}
          hasFilters={hasFilters}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onPageChange={handlePageChange}
          onRetry={fetchEmployees}
        />
      </motion.div>
    </motion.div>
  );
}
