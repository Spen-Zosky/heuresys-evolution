'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { CostCenter, OrgUnit } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface CostCenterFormProps {
  costCenter?: CostCenter | null;
  mode: 'create' | 'edit';
}

interface FormData {
  name: string;
  code: string;
  description: string;
  parent_id: string;
  org_unit_id: string;
  responsible_id: string;
  cost_center_type: string;
  budget_annual_eur: number;
  is_active: boolean;
}

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
}

const COST_TYPES = [
  { value: 'OPERATIONAL', label: 'Operativo' },
  { value: 'ADMINISTRATIVE', label: 'Amministrativo' },
  { value: 'PRODUCTION', label: 'Produzione' },
  { value: 'SALES', label: 'Vendite' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'RND', label: 'Ricerca e Sviluppo' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'HR', label: 'Risorse Umane' },
  { value: 'FINANCE', label: 'Finanza' },
  { value: 'OTHER', label: 'Altro' },
];

// ============================================
// COST CENTER FORM COMPONENT
// ============================================

export function CostCenterForm({ costCenter, mode }: CostCenterFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [parentCenters, setParentCenters] = useState<CostCenter[]>([]);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    description: '',
    parent_id: '',
    org_unit_id: '',
    responsible_id: '',
    cost_center_type: '',
    budget_annual_eur: 0,
    is_active: true,
  });

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const [centersRes, deptsRes, employeesRes] = await Promise.all([
        api.costCenters.getCostCenters({ is_active: true, limit: 500 }),
        api.orgUnits.getOrgUnits({ is_active: true }),
        api.employees.getEmployees({ is_active: true, limit: 500 }),
      ]);

      // Filter out current center from parent options
      const filteredCenters =
        mode === 'edit' && costCenter
          ? centersRes.filter((c) => c.id !== costCenter.id)
          : centersRes;

      setParentCenters(filteredCenters);
      setDepartments(deptsRes);
      setManagers(
        employeesRes.employees.map((emp) => ({
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
        }))
      );
    } catch (err) {
      console.error('Error fetching reference data:', err);
    } finally {
      setLoadingRefs(false);
    }
  }, [mode, costCenter]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Initialize form with cost center data
  useEffect(() => {
    if (costCenter && mode === 'edit') {
      setFormData({
        name: costCenter.name || '',
        code: costCenter.code || '',
        description: costCenter.description || '',
        parent_id: costCenter.parent_id || '',
        org_unit_id: costCenter.org_unit_id || '',
        responsible_id: costCenter.responsible_id || '',
        cost_center_type: costCenter.cost_center_type || '',
        budget_annual_eur: costCenter.budget_annual_eur || 0,
        is_active: costCenter.is_active,
      });
    }
  }, [costCenter, mode]);

  // Handle input change
  const handleChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: typeof value === 'string' && value === '__none__' ? '' : value,
    }));
  };

  // Auto-generate code from name
  const handleNameChange = (name: string) => {
    handleChange('name', name);
    if (mode === 'create' && !formData.code) {
      const code = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 20);
      handleChange('code', code);
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        parent_id: formData.parent_id || undefined,
        org_unit_id: formData.org_unit_id || undefined,
        responsible_id: formData.responsible_id || undefined,
        cost_center_type: formData.cost_center_type || undefined,
        budget_annual_eur: formData.budget_annual_eur || undefined,
        is_active: formData.is_active,
      };

      if (mode === 'create') {
        const newCenter = await api.costCenters.createCostCenter(payload);
        router.push(`/admin/cost-centers/${newCenter.id}`);
      } else if (costCenter) {
        await api.costCenters.updateCostCenter(costCenter.id, payload);
        router.push(`/admin/cost-centers/${costCenter.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {error && (
        <motion.div variants={staggerItem}>
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Basic Info */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informazioni Base</CardTitle>
            <CardDescription>Nome e identificativo del centro di costo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="Amministrazione Centrale"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Codice *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  required
                  placeholder="CC-AMM"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost_center_type">Tipo Costo</Label>
                <Select
                  value={formData.cost_center_type}
                  onValueChange={(value) => handleChange('cost_center_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget_annual_eur">Budget Annuale (&euro;)</Label>
                <Input
                  id="budget_annual_eur"
                  type="number"
                  value={formData.budget_annual_eur}
                  onChange={(e) =>
                    handleChange('budget_annual_eur', parseFloat(e.target.value) || 0)
                  }
                  min={0}
                  step={0.01}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Descrizione del centro di costo..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Hierarchy */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gerarchia</CardTitle>
            <CardDescription>Posizione nella struttura dei centri di costo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_id">Centro di Costo Padre</Label>
                <Select
                  value={formData.parent_id}
                  onValueChange={(value) => handleChange('parent_id', value)}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona centro padre (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuno (Centro Root)</SelectItem>
                    {parentCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name} ({center.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org_unit_id">Unità Organizzativa</Label>
                <Select
                  value={formData.org_unit_id}
                  onValueChange={(value) => handleChange('org_unit_id', value)}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona unità (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuna unità</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="responsible_id">Responsabile</Label>
                <Select
                  value={formData.responsible_id}
                  onValueChange={(value) => handleChange('responsible_id', value)}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona responsabile (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessun responsabile</SelectItem>
                    {managers.map((mgr) => (
                      <SelectItem key={mgr.id} value={mgr.id}>
                        {mgr.first_name} {mgr.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stato</CardTitle>
            <CardDescription>Attivazione del centro di costo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Centro di Costo Attivo</p>
                <p className="text-sm text-muted-foreground">
                  Disattivare per nascondere dalle selezioni
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => handleChange('is_active', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Actions */}
      <motion.div variants={staggerItem} className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
        <Button type="submit" disabled={loading || loadingRefs}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvataggio...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {mode === 'create' ? 'Crea Centro' : 'Salva Modifiche'}
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}
