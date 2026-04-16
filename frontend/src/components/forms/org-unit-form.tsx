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
import type { OrgUnit, Location } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface OrgUnitFormProps {
  orgUnit?: OrgUnit | null;
  mode: 'create' | 'edit';
}

interface FormData {
  name: string;
  code: string;
  description: string;
  parent_id: string;
  org_unit_id: string;
  manager_id: string;
  default_location_id: string;
  org_level: number;
  org_type: string;
  sort_order: number;
  is_active: boolean;
}

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

// ============================================
// ORG UNIT FORM COMPONENT
// ============================================

export function OrgUnitForm({ orgUnit, mode }: OrgUnitFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [parentUnits, setParentUnits] = useState<OrgUnit[]>([]);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [orgTypes, setOrgTypes] = useState<string[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    description: '',
    parent_id: '',
    org_unit_id: '',
    manager_id: '',
    default_location_id: '',
    org_level: 1,
    org_type: '',
    sort_order: 0,
    is_active: true,
  });

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const [unitsRes, deptsRes, locsRes, typesRes] = await Promise.all([
        api.orgUnits.getOrgUnits({ is_active: true, limit: 500 }),
        api.orgUnits.getOrgUnits({ is_active: true }),
        api.locations.getLocations({ is_active: true }),
        api.orgUnits.getOrgUnitTypes().catch(() => []),
      ]);

      // Filter out current unit from parent options (can't be parent of self)
      const filteredUnits =
        mode === 'edit' && orgUnit ? unitsRes.filter((u) => u.id !== orgUnit.id) : unitsRes;

      setParentUnits(filteredUnits);
      setDepartments(deptsRes);
      setLocations(locsRes);
      setOrgTypes(typesRes);

      // Fetch managers (employees who can be managers)
      const employeesRes = await api.employees.getEmployees({ is_active: true, limit: 500 });
      setManagers(
        employeesRes.employees.map((emp) => ({
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
        }))
      );
    } catch (err) {
      console.error('Error fetching reference data:', err);
    } finally {
      setLoadingRefs(false);
    }
  }, [mode, orgUnit]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Initialize form with org unit data
  useEffect(() => {
    if (orgUnit && mode === 'edit') {
      setFormData({
        name: orgUnit.name || '',
        code: orgUnit.code || '',
        description: orgUnit.description || '',
        parent_id: orgUnit.parent_id || '',
        org_unit_id: orgUnit.org_unit_id || '',
        manager_id: orgUnit.manager_id || '',
        default_location_id: orgUnit.default_location_id || '',
        org_level: orgUnit.org_level || 1,
        org_type: orgUnit.org_type || '',
        sort_order: orgUnit.sort_order || 0,
        is_active: orgUnit.is_active,
      });
    }
  }, [orgUnit, mode]);

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

  // Handle parent change - auto-adjust org level
  const handleParentChange = (parentId: string) => {
    handleChange('parent_id', parentId === '__none__' ? '' : parentId);
    if (parentId && parentId !== '__none__') {
      const parent = parentUnits.find((u) => u.id === parentId);
      if (parent) {
        handleChange('org_level', parent.org_level + 1);
      }
    } else {
      handleChange('org_level', 1);
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
        manager_id: formData.manager_id || undefined,
        default_location_id: formData.default_location_id || undefined,
        org_level: formData.org_level,
        org_type: formData.org_type || undefined,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };

      if (mode === 'create') {
        const newUnit = await api.orgUnits.createOrgUnit(payload);
        router.push(`/admin/org-units/${newUnit.id}`);
      } else if (orgUnit) {
        await api.orgUnits.updateOrgUnit(orgUnit.id, payload);
        router.push(`/admin/org-units/${orgUnit.id}`);
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
            <CardDescription>Nome e identificativo dell&apos;unità organizzativa</CardDescription>
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
                  placeholder="Direzione Commerciale"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Codice *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  required
                  placeholder="DIR-COMM"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Descrizione dell'unità organizzativa..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Organization Structure */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Struttura Organizzativa</CardTitle>
            <CardDescription>Posizione nell&apos;organigramma aziendale</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_id">Unità Padre</Label>
                <Select
                  value={formData.parent_id}
                  onValueChange={handleParentChange}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona unità padre (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuna (Unità Root)</SelectItem>
                    {parentUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org_level">Livello Organizzativo</Label>
                <Input
                  id="org_level"
                  type="number"
                  value={formData.org_level}
                  onChange={(e) => handleChange('org_level', parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                />
                <p className="text-xs text-muted-foreground">
                  1 = Top level, valori più alti = più in basso nella gerarchia
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org_type">Tipo Unità</Label>
                <Select
                  value={formData.org_type}
                  onValueChange={(value) => handleChange('org_type', value)}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessun tipo specifico</SelectItem>
                    {orgTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                    <SelectItem value="DIREZIONE">Direzione</SelectItem>
                    <SelectItem value="DIVISIONE">Divisione</SelectItem>
                    <SelectItem value="AREA">Area</SelectItem>
                    <SelectItem value="UFFICIO">Ufficio</SelectItem>
                    <SelectItem value="TEAM">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordine Visualizzazione</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Relationships */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relazioni</CardTitle>
            <CardDescription>Collegamenti con altre entità aziendali</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org_unit_id">Dipartimento</Label>
                <Select
                  value={formData.org_unit_id}
                  onValueChange={(value) => handleChange('org_unit_id', value)}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona dipartimento (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessun dipartimento</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_id">Manager</Label>
                <Select
                  value={formData.manager_id}
                  onValueChange={(value) => handleChange('manager_id', value)}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona manager (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessun manager</SelectItem>
                    {managers.map((mgr) => (
                      <SelectItem key={mgr.id} value={mgr.id}>
                        {mgr.first_name} {mgr.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="default_location_id">Sede di Default</Label>
                <Select
                  value={formData.default_location_id}
                  onValueChange={(value) => handleChange('default_location_id', value)}
                  disabled={loadingRefs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona sede (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuna sede di default</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} - {loc.city}
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
            <CardDescription>Attivazione dell&apos;unità organizzativa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Unità Attiva</p>
                <p className="text-sm text-muted-foreground">
                  Disattivare per nascondere l&apos;unità dalle selezioni
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
              {mode === 'create' ? 'Crea Unità' : 'Salva Modifiche'}
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}
