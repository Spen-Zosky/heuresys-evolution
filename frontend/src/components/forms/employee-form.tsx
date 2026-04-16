'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { validators } from '@/lib/validation';

// ============================================
// TYPES
// ============================================

interface EmployeeFormProps {
  employee?: Employee | null;
  mode: 'create' | 'edit';
}

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  org_unit_id: string;
  hire_date: string;
  manager_id: string;
  location_id: string;
  cost_center_id: string;
  is_active: boolean;
  employment_status: string;
  phone: string;
  mobile: string;
}

// ============================================
// EMPLOYEE FORM COMPONENT
// ============================================

export function EmployeeForm({ employee, mode }: EmployeeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reference data
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    job_title: '',
    org_unit_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    manager_id: '',
    location_id: '',
    cost_center_id: '',
    is_active: true,
    employment_status: 'active',
    phone: '',
    mobile: '',
  });

  // Initialize form with employee data
  useEffect(() => {
    if (employee && mode === 'edit') {
      setFormData({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        job_title: employee.job_title || '',
        org_unit_id: employee.org_unit_id || '',
        hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : '',
        manager_id: employee.manager_id || '',
        location_id: employee.location_id || '',
        cost_center_id: employee.cost_center_id || '',
        is_active: employee.is_active,
        employment_status: employee.employment_status || 'active',
        phone: employee.phone || '',
        mobile: employee.mobile || '',
      });
    }
  }, [employee, mode]);

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    try {
      // Fetch departments
      const deptResult = await api.orgUnits.getOrgUnits({ limit: 100 });
      setDepartments(deptResult.map((d) => ({ id: d.id, name: d.name })));

      // Fetch locations
      const locResult = await api.locations.getLocations({ limit: 100, is_active: true });
      setLocations(locResult.map((l) => ({ id: l.id, name: l.name })));

      // Fetch potential managers (active employees)
      const mgrResult = await api.employees.getEmployees({ limit: 200, is_active: true });
      const empList = Array.isArray(mgrResult)
        ? mgrResult
        : (mgrResult as { employees?: { id: string; first_name: string; last_name: string }[] })
            .employees || [];
      setManagers(empList.map((e) => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })));
    } catch {
      // Ignore errors for reference data - form still works without them
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Handle input change
  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Field-level validation on blur
  const validateField = useCallback((field: keyof FormData, value: string) => {
    let error: string | null = null;

    switch (field) {
      case 'first_name':
      case 'last_name':
        error = validators.required()(value);
        if (!error) error = validators.minLength(2)(value);
        break;
      case 'email':
        error = validators.required()(value);
        if (!error) error = validators.email()(value);
        break;
      case 'job_title':
        error = validators.required()(value);
        break;
      case 'phone':
        if (value) error = validators.phone()(value);
        break;
      case 'mobile':
        if (value) error = validators.phone()(value);
        break;
      case 'hire_date':
        error = validators.required()(value);
        break;
    }

    setFieldErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });

    return error;
  }, []);

  // Validate all fields before submit
  const validateAllFields = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    const requiredCheck = validators.required();
    const minLenCheck = validators.minLength(2);
    const emailCheck = validators.email();
    const phoneCheck = validators.phone();

    // first_name
    let err = requiredCheck(formData.first_name);
    if (!err) err = minLenCheck(formData.first_name);
    if (err) errors.first_name = err;

    // last_name
    err = requiredCheck(formData.last_name);
    if (!err) err = minLenCheck(formData.last_name);
    if (err) errors.last_name = err;

    // email
    err = requiredCheck(formData.email);
    if (!err) err = emailCheck(formData.email);
    if (err) errors.email = err;

    // job_title
    err = requiredCheck(formData.job_title);
    if (err) errors.job_title = err;

    // hire_date
    err = requiredCheck(formData.hire_date);
    if (err) errors.hire_date = err;

    // phone (optional but must be valid if provided)
    if (formData.phone) {
      err = phoneCheck(formData.phone);
      if (err) errors.phone = err;
    }

    // mobile (optional but must be valid if provided)
    if (formData.mobile) {
      err = phoneCheck(formData.mobile);
      if (err) errors.mobile = err;
    }

    // org_unit_id
    err = requiredCheck(formData.org_unit_id);
    if (err) errors.org_unit_id = err;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle blur for inline validation
  const handleBlur = useCallback(
    (field: keyof FormData) => {
      validateField(field, formData[field] as string);
    },
    [formData, validateField]
  );

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAllFields()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        const createData: CreateEmployeeRequest = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          job_title: formData.job_title,
          org_unit_id: formData.org_unit_id,
          hire_date: formData.hire_date,
          manager_id: formData.manager_id || undefined,
          location_id: formData.location_id || undefined,
          cost_center_id: formData.cost_center_id || undefined,
        };
        const newEmployee = await api.employees.createEmployee(createData);
        router.push(`/admin/employees/${newEmployee.id}`);
      } else if (employee) {
        const updateData: UpdateEmployeeRequest = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          job_title: formData.job_title,
          org_unit_id: formData.org_unit_id,
          hire_date: formData.hire_date,
          manager_id: formData.manager_id || undefined,
          location_id: formData.location_id || undefined,
          cost_center_id: formData.cost_center_id || undefined,
          is_active: formData.is_active,
          employment_status: formData.employment_status,
        };
        await api.employees.updateEmployee(employee.id, updateData);
        router.push(`/admin/employees/${employee.id}`);
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
          <Card className="border-destructive bg-destructive/10" role="alert" aria-live="assertive">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Personal Info */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informazioni Personali</CardTitle>
            <CardDescription>Dati anagrafici del dipendente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nome *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  onBlur={() => handleBlur('first_name')}
                  required
                  placeholder="Mario"
                  className={fieldErrors.first_name ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.first_name}
                  aria-describedby={fieldErrors.first_name ? 'first_name-error' : undefined}
                />
                {fieldErrors.first_name && (
                  <p id="first_name-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.first_name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Cognome *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  onBlur={() => handleBlur('last_name')}
                  required
                  placeholder="Rossi"
                  className={fieldErrors.last_name ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.last_name}
                  aria-describedby={fieldErrors.last_name ? 'last_name-error' : undefined}
                />
                {fieldErrors.last_name && (
                  <p id="last_name-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.last_name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  required
                  placeholder="mario.rossi@azienda.com"
                  className={fieldErrors.email ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  onBlur={() => handleBlur('phone')}
                  placeholder="+39 02 1234567"
                  className={fieldErrors.phone ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.phone}
                  aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                />
                {fieldErrors.phone && (
                  <p id="phone-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Cellulare</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  onBlur={() => handleBlur('mobile')}
                  placeholder="+39 333 1234567"
                  className={fieldErrors.mobile ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.mobile}
                  aria-describedby={fieldErrors.mobile ? 'mobile-error' : undefined}
                />
                {fieldErrors.mobile && (
                  <p id="mobile-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.mobile}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Employment Info */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informazioni Lavorative</CardTitle>
            <CardDescription>Ruolo e organizzazione</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Ruolo *</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => handleChange('job_title', e.target.value)}
                  onBlur={() => handleBlur('job_title')}
                  required
                  placeholder="Software Developer"
                  className={fieldErrors.job_title ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.job_title}
                  aria-describedby={fieldErrors.job_title ? 'job_title-error' : undefined}
                />
                {fieldErrors.job_title && (
                  <p id="job_title-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.job_title}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="org_unit_id">Dipartimento *</Label>
                <Select
                  value={formData.org_unit_id}
                  onValueChange={(v) => handleChange('org_unit_id', v)}
                >
                  <SelectTrigger
                    className={fieldErrors.org_unit_id ? 'border-destructive' : ''}
                    aria-invalid={!!fieldErrors.org_unit_id}
                    aria-describedby={fieldErrors.org_unit_id ? 'org_unit_id-error' : undefined}
                  >
                    <SelectValue placeholder="Seleziona dipartimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.org_unit_id && (
                  <p id="org_unit_id-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.org_unit_id}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hire_date">Data Assunzione *</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => handleChange('hire_date', e.target.value)}
                  onBlur={() => handleBlur('hire_date')}
                  required
                  className={fieldErrors.hire_date ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.hire_date}
                  aria-describedby={fieldErrors.hire_date ? 'hire_date-error' : undefined}
                />
                {fieldErrors.hire_date && (
                  <p id="hire_date-error" className="text-sm text-destructive" role="alert">
                    {fieldErrors.hire_date}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_id">Sede</Label>
                <Select
                  value={formData.location_id}
                  onValueChange={(v) => handleChange('location_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_id">Manager</Label>
                <Select
                  value={formData.manager_id}
                  onValueChange={(v) => handleChange('manager_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((mgr) => (
                      <SelectItem key={mgr.id} value={mgr.id}>
                        {mgr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mode === 'edit' && (
                <div className="space-y-2">
                  <Label htmlFor="employment_status">Stato</Label>
                  <Select
                    value={formData.employment_status}
                    onValueChange={(v) => handleChange('employment_status', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Attivo</SelectItem>
                      <SelectItem value="on_leave">In congedo</SelectItem>
                      <SelectItem value="inactive">Inattivo</SelectItem>
                      <SelectItem value="terminated">Terminato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status (edit mode only) */}
      {mode === 'edit' && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stato</CardTitle>
              <CardDescription>Attivazione dipendente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dipendente Attivo</p>
                  <p className="text-sm text-muted-foreground">
                    Disattivare per impedire l&apos;accesso al sistema
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
      )}

      {/* Actions */}
      <motion.div variants={staggerItem} className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvataggio...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {mode === 'create' ? 'Crea Dipendente' : 'Salva Modifiche'}
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}
