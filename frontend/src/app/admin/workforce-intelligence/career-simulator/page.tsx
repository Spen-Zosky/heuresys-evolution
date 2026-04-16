'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { User, MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import { CareerGraph } from '@/components/workforce-intelligence/career-graph';
import { TransitionPanel } from '@/components/workforce-intelligence/transition-panel';
import * as careerApi from '@/lib/api/endpoints/career-intelligence';
import type { CareerRecommendation } from '@/lib/api/endpoints/career-intelligence';

// ============================================
// TYPES
// ============================================

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
  esco_occupation_uri?: string;
}

// ============================================
// CAREER SIMULATOR PAGE
// ============================================

export default function CareerSimulatorPage() {
  const t = useTranslations('admin.workforceIntelligence.careerSimulator');
  const tCommon = useTranslations('common');
  const { user } = useAuth();

  // Employee selection
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Recommendations
  const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  // Graph center (for "explore from here" flow)
  const [centerLabel, setCenterLabel] = useState('Posizione attuale');
  const [centerUri, setCenterUri] = useState<string | null>(null);

  // Transition panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<CareerRecommendation | null>(null);

  // ============================================
  // LOAD EMPLOYEES
  // ============================================

  useEffect(() => {
    let cancelled = false;

    async function fetchEmployees() {
      setEmployeesLoading(true);
      try {
        const response = await apiClient.get<{ data: Employee[] | { items: Employee[] } }>(
          '/api/v1/employees?limit=100'
        );
        const items = Array.isArray(response.data)
          ? response.data
          : (response.data as { items: Employee[] })?.items || [];
        if (!cancelled) {
          setEmployees(items);
          // Default to current user's employee
          if (user?.employeeId) {
            setSelectedEmployeeId(user.employeeId);
          } else if (items.length > 0) {
            setSelectedEmployeeId(items[0].id);
          }
        }
      } catch {
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    }

    fetchEmployees();
    return () => {
      cancelled = true;
    };
  }, [user?.employeeId]);

  // ============================================
  // LOAD RECOMMENDATIONS
  // ============================================

  const fetchRecommendations = useCallback(
    async (employeeId: string) => {
      setRecsLoading(true);
      setRecsError(null);
      setRecommendations([]);
      setSelectedRec(null);
      setPanelOpen(false);

      try {
        const result = await careerApi.getCareerRecommendations(employeeId);
        setRecommendations(result.recommendations || []);

        // Update center label from selected employee
        const emp = employees.find((e) => e.id === employeeId);
        if (emp) {
          setCenterLabel(emp.job_title || `${emp.first_name} ${emp.last_name}`);
          setCenterUri(emp.esco_occupation_uri || null);
        }
      } catch (err) {
        setRecsError(
          err instanceof Error ? err.message : 'Errore nel caricamento delle raccomandazioni'
        );
      } finally {
        setRecsLoading(false);
      }
    },
    [employees]
  );

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchRecommendations(selectedEmployeeId);
    }
  }, [selectedEmployeeId, fetchRecommendations]);

  // ============================================
  // HANDLERS
  // ============================================

  function handleNodeClick(rec: CareerRecommendation) {
    setSelectedRec(rec);
    setPanelOpen(true);
  }

  function handleExploreFrom(targetUri: string, targetLabel: string) {
    setCenterLabel(targetLabel);
    setCenterUri(targetUri);

    // Fetch new recommendations based on the target occupation using matching occupations
    // For the explore flow, we keep the current employee but shift perspective
    if (selectedEmployeeId) {
      fetchRecommendations(selectedEmployeeId);
    }
  }

  function handleEmployeeChange(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    // Reset explore-from state
    setCenterUri(null);
  }

  // ============================================
  // DERIVED
  // ============================================

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const sourceUri = centerUri || selectedEmployee?.esco_occupation_uri || '';
  const targetUri = selectedRec?.occupationId
    ? `http://data.europa.eu/esco/occupation/${selectedRec.occupationId}`
    : '';

  // ============================================
  // RENDER
  // ============================================

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Simulatore Carriera</h1>
            <p className="text-muted-foreground">
              Esplora percorsi di carriera basati sulle competenze ESCO
            </p>
          </div>
        </div>
      </motion.div>

      {/* Employee selector */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Seleziona dipendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeesLoading ? (
              <Skeleton className="h-10 w-full max-w-sm" />
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <Select value={selectedEmployeeId || ''} onValueChange={handleEmployeeChange}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Seleziona un dipendente" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                        {emp.job_title ? ` - ${emp.job_title}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedEmployee && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {selectedEmployee.job_title && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {selectedEmployee.job_title}
                      </span>
                    )}
                    {selectedEmployee.department_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {selectedEmployee.department_name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Career graph */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Mappa raccomandazioni</span>
              {recommendations.length > 0 && (
                <Badge variant="secondary">{recommendations.length} percorsi</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recsLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="space-y-4 text-center">
                  <Skeleton className="mx-auto h-48 w-48 rounded-full" />
                  <Skeleton className="mx-auto h-4 w-48" />
                  <p className="text-sm text-muted-foreground">Analisi competenze in corso...</p>
                </div>
              </div>
            )}

            {recsError && !recsLoading && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {recsError}
              </div>
            )}

            {!recsLoading && !recsError && recommendations.length === 0 && selectedEmployeeId && (
              <div className="flex items-center justify-center py-20 text-center">
                <div>
                  <p className="text-muted-foreground">
                    Nessuna raccomandazione disponibile per questo dipendente.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verifica che il dipendente abbia competenze ESCO associate.
                  </p>
                </div>
              </div>
            )}

            {!recsLoading && !recsError && recommendations.length > 0 && (
              <div className="mx-auto max-w-2xl">
                <CareerGraph
                  centerLabel={centerLabel}
                  recommendations={recommendations}
                  onNodeClick={handleNodeClick}
                  selectedNodeId={selectedRec?.occupationId}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Transition panel (Sheet) */}
      {sourceUri && targetUri && (
        <TransitionPanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          sourceUri={sourceUri}
          targetUri={targetUri}
          onExploreFrom={handleExploreFrom}
        />
      )}
    </motion.div>
  );
}
