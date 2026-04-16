'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Settings2, RefreshCw, AlertCircle, Save, Building2, Globe, Palette } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface TenantConfig {
  id?: string;
  name?: string;
  code?: string;
  locale?: string;
  timezone?: string;
  currency?: string;
  fiscal_year_start?: string;
  working_days?: string[];
  branding_primary_color?: string;
  branding_logo_url?: string;
  modules_enabled?: string[];
  status?: string;
  [key: string]: unknown;
}

const availableModules = [
  { id: 'hr_core', label: 'HR Core', description: 'Gestione dipendenti e organizzazione' },
  { id: 'performance', label: 'Performance', description: 'Obiettivi, revisioni, OKR' },
  { id: 'learning', label: 'Learning', description: 'Formazione e sviluppo' },
  { id: 'recruiting', label: 'Recruiting', description: 'Selezione del personale' },
  { id: 'talent', label: 'Talent', description: 'Competenze e successione' },
  { id: 'analytics', label: 'Analytics', description: 'Dashboard e reportistica' },
  { id: 'payroll', label: 'Payroll', description: 'Cedolini e compensi' },
  { id: 'time_off', label: 'Time Off', description: 'Ferie e permessi' },
];

export default function TenantSetupPage() {
  const t = useTranslations('admin.settings.tenantSetup');
  const tCommon = useTranslations('common');
  const [config, setConfig] = useState<TenantConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: TenantConfig } | TenantConfig>(
        '/api/v1/tenant-setup'
      );
      const raw = (response as { data: TenantConfig }).data || response;
      setConfig(raw as TenantConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento configurazione tenant');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateField = (field: string, value: string) => {
    setConfig({ ...config, [field]: value });
    setSaved(false);
  };

  const toggleModule = (moduleId: string) => {
    const current = config.modules_enabled || [];
    const updated = current.includes(moduleId)
      ? current.filter((m) => m !== moduleId)
      : [...current, moduleId];
    setConfig({ ...config, modules_enabled: updated });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!config.id) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/v1/tenants/${config.id}`, {
        name: config.name,
        locale: config.locale,
        timezone: config.timezone,
        currency: config.currency,
        fiscal_year_start: config.fiscal_year_start,
        branding_primary_color: config.branding_primary_color,
        branding_logo_url: config.branding_logo_url,
        modules_enabled: config.modules_enabled,
      });
      setSaved(true);
      toast.success('Configurazione salvata');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio');
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
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Settings2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Configurazione Tenant
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Impostazioni generali e personalizzazione del tenant
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Ricarica
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvataggio...' : saved ? 'Salvato!' : 'Salva'}
          </Button>
        </div>
      </motion.div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Caricamento...</div>
      ) : error ? (
        <div className="p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            Riprova
          </Button>
        </div>
      ) : (
        <>
          {/* General Info */}
          <motion.div variants={staggerItem}>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Informazioni Generali
            </h2>
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Nome Organizzazione
                    </label>
                    <Input
                      value={config.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Codice Tenant
                    </label>
                    <Input value={config.code || ''} disabled className="mt-1 bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Localization */}
          <motion.div variants={staggerItem}>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              Localizzazione
            </h2>
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Lingua</label>
                    <Select
                      value={config.locale || 'it-IT'}
                      onValueChange={(v) => updateField('locale', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it-IT">Italiano</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-GB">English (UK)</SelectItem>
                        <SelectItem value="de-DE">Deutsch</SelectItem>
                        <SelectItem value="fr-FR">Francais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fuso Orario</label>
                    <Select
                      value={config.timezone || 'Europe/Rome'}
                      onValueChange={(v) => updateField('timezone', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Rome">Europe/Rome</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                        <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Valuta</label>
                    <Select
                      value={config.currency || 'EUR'}
                      onValueChange={(v) => updateField('currency', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="USD">USD - Dollaro US</SelectItem>
                        <SelectItem value="GBP">GBP - Sterlina</SelectItem>
                        <SelectItem value="CHF">CHF - Franco Svizzero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Branding */}
          <motion.div variants={staggerItem}>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
              Branding
            </h2>
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Colore Primario
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={config.branding_primary_color || '#3b82f6'}
                        onChange={(e) => updateField('branding_primary_color', e.target.value)}
                        className="h-10 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={config.branding_primary_color || '#3b82f6'}
                        onChange={(e) => updateField('branding_primary_color', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">URL Logo</label>
                    <Input
                      value={config.branding_logo_url || ''}
                      onChange={(e) => updateField('branding_logo_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Modules */}
          <motion.div variants={staggerItem}>
            <h2 className="text-lg font-semibold mb-3">Moduli Abilitati</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {availableModules.map((mod) => {
                const isEnabled = (config.modules_enabled || []).includes(mod.id);
                return (
                  <Card
                    key={mod.id}
                    className={`cursor-pointer transition-all ${isEnabled ? 'ring-2 ring-primary' : 'opacity-60'}`}
                    onClick={() => toggleModule(mod.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{mod.label}</p>
                        <Badge
                          className={
                            isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {isEnabled ? 'ON' : 'OFF'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
