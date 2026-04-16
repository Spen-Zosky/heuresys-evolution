'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Target, ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

interface SimpleEmployee {
  id: string;
  first_name: string;
  last_name: string;
}

export default function NewGoalPage() {
  const t = useTranslations('admin.goals.new');
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<SimpleEmployee[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: '',
    employee_id: '',
    due_date: '',
    weight: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const result = await api.employees.getEmployees({ limit: 200 });
      setEmployees(
        result.employees.map((e) => ({
          id: e.id,
          first_name: e.first_name,
          last_name: e.last_name,
        }))
      );
    } catch {
      // Non-blocking error
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.employee_id) return;

    setSaving(true);
    setError(null);
    try {
      await api.goals.createGoal({
        title: form.title,
        description: form.description || undefined,
        type: form.type || undefined,
        employee_id: form.employee_id,
        due_date: form.due_date || undefined,
        weight: form.weight ? Number(form.weight) : undefined,
      } as Parameters<typeof api.goals.createGoal>[0]);
      router.push('/admin/goals');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nella creazione dell'obiettivo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" asChild>
          <Link href="/admin/goals">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Nuovo Obiettivo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>Dettagli Obiettivo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titolo *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Inserisci il titolo dell'obiettivo"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Descrizione dell'obiettivo..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => updateField('type', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individuale</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="department">Dipartimento</SelectItem>
                      <SelectItem value="company">Aziendale</SelectItem>
                      <SelectItem value="career">Carriera</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee_id">Dipendente Assegnatario *</Label>
                  <Select
                    value={form.employee_id}
                    onValueChange={(v) => updateField('employee_id', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona dipendente" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Scadenza</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => updateField('due_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Peso (%)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min="0"
                    max="100"
                    value={form.weight}
                    onChange={(e) => updateField('weight', e.target.value)}
                    placeholder="es. 25"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving || !form.title.trim() || !form.employee_id}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Salvataggio...' : 'Crea Obiettivo'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/admin/goals">Annulla</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
