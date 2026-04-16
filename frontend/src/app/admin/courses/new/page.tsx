'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GraduationCap, ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
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

export default function NewCoursePage() {
  const t = useTranslations('admin.courses.new');
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    title: '',
    description: '',
    category: '',
    duration_hours: '',
    provider: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.code.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await api.courses.createCourse({
        code: form.code,
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        duration_hours: form.duration_hours ? Number(form.duration_hours) : undefined,
        provider: form.provider || undefined,
      } as Parameters<typeof api.courses.createCourse>[0]);
      router.push('/admin/courses');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createError'));
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
          <Link href="/admin/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Nuovo Corso
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>{t('detailsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Codice Corso *</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => updateField('code', e.target.value)}
                    placeholder="es. LEAD-101"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Titolo *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="Inserisci il titolo del corso"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Inserisci il titolo del corso"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Descrizione del corso..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => updateField('category', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Tecnico</SelectItem>
                      <SelectItem value="soft_skills">Soft Skills</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="leadership">Leadership</SelectItem>
                      <SelectItem value="safety">Sicurezza</SelectItem>
                      <SelectItem value="other">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration_hours">Durata (ore)</Label>
                  <Input
                    id="duration_hours"
                    type="number"
                    min="0"
                    value={form.duration_hours}
                    onChange={(e) => updateField('duration_hours', e.target.value)}
                    placeholder="es. 8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Ente Erogatore</Label>
                <Input
                  id="provider"
                  value={form.provider}
                  onChange={(e) => updateField('provider', e.target.value)}
                  placeholder="es. Coursera, interno, ecc."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving || !form.title.trim()}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Salvataggio...' : 'Crea Corso'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/admin/courses">Annulla</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
