'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface TenantSettings {
  id?: string;
  name?: string;
  code?: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  industry_type?: string;
  region?: string;
  [key: string]: unknown;
}

export default function SettingsPage() {
  const t = useTranslations('admin.settings');
  const tCommon = useTranslations('common');
  const [settings, setSettings] = useState<TenantSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ data: TenantSettings } | TenantSettings>(
        '/api/v1/tenants/current'
      );
      const tenant = (data as { data: TenantSettings }).data ?? data;
      setSettings(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento impostazioni');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateField = (field: string, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiClient.patch('/api/v1/tenants/current', {
        name: settings.name,
        description: settings.description,
        contact_email: settings.contact_email,
        contact_phone: settings.contact_phone,
        industry_type: settings.industry_type,
        region: settings.region,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        {tCommon('loading')}
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem}>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </motion.div>

      {/* Form */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('generalInfo')}
            </CardTitle>
            <CardDescription>{t('tenantIdentification')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('fields.tenantName')}</Label>
                <Input
                  id="name"
                  value={settings.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nome del tenant"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">{t('fields.code')}</Label>
                <Input id="code" value={settings.code || ''} disabled className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('fields.description')}</Label>
              <Input
                id="description"
                value={settings.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Descrizione del tenant"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">{t('fields.contactEmail')}</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={settings.contact_email || ''}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                  placeholder="es. info@azienda.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone">{t('fields.phone')}</Label>
                <Input
                  id="contact_phone"
                  value={settings.contact_phone || ''}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  placeholder="es. +39 02 1234567"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry_type">{t('fields.industry')}</Label>
                <Input
                  id="industry_type"
                  value={settings.industry_type || ''}
                  onChange={(e) => updateField('industry_type', e.target.value)}
                  placeholder="es. Bancario, Alimentare"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">{t('fields.region')}</Label>
                <Input
                  id="region"
                  value={settings.region || ''}
                  onChange={(e) => updateField('region', e.target.value)}
                  placeholder="es. Lombardia"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {t('savedSuccess')}
              </div>
            )}

            <div className="pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? tCommon('saving') : t('saveSettings')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
