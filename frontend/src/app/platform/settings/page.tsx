'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Settings, RefreshCw, Globe, Shield, Mail, Puzzle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface PlatformSettings {
  general?: {
    platform_name?: string;
    default_language?: string;
    timezone?: string;
    max_tenants?: number;
  };
  security?: {
    session_timeout_minutes?: number;
    password_min_length?: number;
    require_2fa?: boolean;
    max_login_attempts?: number;
  };
  email?: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_from?: string;
    enabled?: boolean;
  };
  integrations?: {
    ai_provider?: string;
    esco_enabled?: boolean;
    sap_enabled?: boolean;
  };
}

export default function PlatformSettingsPage() {
  const t = useTranslations('platform');
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<{ success: boolean; data: PlatformSettings }>(
        '/api/v1/platform/settings'
      );
      setSettings(result?.data || (result as unknown as PlatformSettings));
    } catch {
      // Fallback to display-only defaults if endpoint not available
      setSettings({
        general: {
          platform_name: 'Heuresys AI-Platform',
          default_language: 'it',
          timezone: 'Europe/Rome',
          max_tenants: 10,
        },
        security: {
          session_timeout_minutes: 30,
          password_min_length: 8,
          require_2fa: false,
          max_login_attempts: 5,
        },
        email: { smtp_host: '', smtp_port: 587, smtp_from: '', enabled: false },
        integrations: { ai_provider: 'gemini', esco_enabled: true, sap_enabled: true },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const sections = [
    {
      icon: Globe,
      title: 'Generale',
      description: 'Configurazione generale piattaforma',
      fields: [
        {
          label: 'Nome Piattaforma',
          value: settings.general?.platform_name || '-',
          type: 'text' as const,
        },
        {
          label: 'Lingua Predefinita',
          value: settings.general?.default_language || '-',
          type: 'text' as const,
        },
        { label: 'Fuso Orario', value: settings.general?.timezone || '-', type: 'text' as const },
        {
          label: 'Max Tenant',
          value: String(settings.general?.max_tenants ?? '-'),
          type: 'text' as const,
        },
      ],
    },
    {
      icon: Shield,
      title: 'Sicurezza',
      description: 'Politiche di sicurezza',
      fields: [
        {
          label: 'Timeout Sessione (min)',
          value: String(settings.security?.session_timeout_minutes ?? '-'),
          type: 'text' as const,
        },
        {
          label: 'Lunghezza Min. Password',
          value: String(settings.security?.password_min_length ?? '-'),
          type: 'text' as const,
        },
        {
          label: '2FA Obbligatorio',
          value: settings.security?.require_2fa ? 'Si' : 'No',
          type: 'badge' as const,
          warning: !settings.security?.require_2fa,
        },
        {
          label: 'Max Tentativi Login',
          value: String(settings.security?.max_login_attempts ?? '-'),
          type: 'text' as const,
        },
      ],
    },
    {
      icon: Mail,
      title: 'Email',
      description: 'Configurazione SMTP per notifiche, reset password e onboarding',
      fields: [
        {
          label: 'Server SMTP',
          value:
            settings.email?.smtp_host || "Da configurare via SMTP_HOST nelle variabili d'ambiente",
          type: 'text' as const,
        },
        {
          label: 'Porta',
          value: String(settings.email?.smtp_port ?? '587'),
          type: 'text' as const,
        },
        {
          label: 'Mittente',
          value:
            settings.email?.smtp_from || "Da configurare via SMTP_FROM nelle variabili d'ambiente",
          type: 'text' as const,
        },
        {
          label: 'Abilitato',
          value: settings.email?.enabled ? 'Si' : 'No',
          type: 'badge' as const,
        },
      ],
    },
    {
      icon: Puzzle,
      title: 'Integrazioni',
      description: 'Servizi esterni connessi',
      fields: [
        {
          label: 'Provider AI',
          value: settings.integrations?.ai_provider || '-',
          type: 'text' as const,
        },
        {
          label: 'ESCO',
          value: settings.integrations?.esco_enabled ? 'Attivo' : 'Inattivo',
          type: 'badge' as const,
        },
        {
          label: 'SAP HR',
          value: settings.integrations?.sap_enabled ? 'Attivo' : 'Inattivo',
          type: 'badge' as const,
        },
      ],
    },
  ];

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Impostazioni Globali
          </h1>
          <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchSettings} title={t('common.refresh')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* SMTP Alert */}
      {!loading && !settings.email?.enabled && (
        <motion.div variants={staggerItem}>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>SMTP non configurato</AlertTitle>
            <AlertDescription>
              Senza SMTP, reset password, notifiche e onboarding non funzionano. Per abilitare le
              email, configurare le variabili d&apos;ambiente{' '}
              <code className="text-xs bg-destructive/20 px-1 py-0.5 rounded">SMTP_HOST</code>,{' '}
              <code className="text-xs bg-destructive/20 px-1 py-0.5 rounded">SMTP_PORT</code>,{' '}
              <code className="text-xs bg-destructive/20 px-1 py-0.5 rounded">SMTP_FROM</code> nel
              file <code className="text-xs bg-destructive/20 px-1 py-0.5 rounded">.env</code> e
              riavviare il servizio.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Security Checklist */}
      {!loading && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Checklist Sicurezza
              </CardTitle>
              <CardDescription>Stato di conformita della piattaforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    label: 'SMTP configurato',
                    ok: !!settings.email?.enabled,
                  },
                  {
                    label: '2FA abilitato',
                    ok: !!settings.security?.require_2fa,
                  },
                  {
                    label: 'Timeout sessione < 60min',
                    ok: (settings.security?.session_timeout_minutes ?? 999) < 60,
                  },
                  {
                    label: 'Tentativi login max <= 5',
                    ok: (settings.security?.max_login_attempts ?? 999) <= 5,
                  },
                ].map((check) => (
                  <div
                    key={check.label}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <span className={check.ok ? 'text-green-500' : 'text-destructive'}>
                      {check.ok ? '\u2705' : '\u274C'}
                    </span>
                    <span className="text-sm">{check.label}</span>
                    {!check.ok && (
                      <Badge
                        variant="outline"
                        className="ml-auto text-xs text-amber-500 border-amber-500"
                      >
                        Rischio
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {sections.map((section) => (
        <motion.div key={section.title} variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <section.icon className="h-4 w-4 text-primary" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: section.fields.length }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {section.fields.map((field) => (
                    <div
                      key={field.label}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <span className="text-sm text-muted-foreground">{field.label}</span>
                      {field.type === 'badge' ? (
                        <span className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              field.value === 'Si' || field.value === 'Attivo'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {field.value}
                          </Badge>
                          {'warning' in field && (field as { warning?: boolean }).warning && (
                            <Badge
                              variant="outline"
                              className="text-xs text-amber-500 border-amber-500"
                            >
                              Rischio
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-sm font-medium">{field.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
