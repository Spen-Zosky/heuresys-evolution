'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Globe, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

interface Tenant {
  id: string;
  code: string;
  name: string;
  description: string | null;
  verified_website: string | null;
  tax_id: string | null;
  nace_code: string | null;
  region: string | null;
  industry_type: string | null;
  status: string;
}

function normalizeWebsite(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function normalizeTaxId(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/g, '');
}

function validateWebsite(v: string): string | null {
  if (v === '') return null;
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(v)) {
    return 'Formato dominio non valido (es. example.com)';
  }
  return null;
}

function validateTaxId(v: string): string | null {
  if (v === '') return null;
  if (!/^[A-Z0-9]{8,32}$/.test(v)) {
    return 'Tax ID deve contenere 8-32 caratteri alfanumerici';
  }
  return null;
}

export default function TenantEditPage() {
  const t = useTranslations('platform');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [verifiedWebsite, setVerifiedWebsite] = useState('');
  const [taxId, setTaxId] = useState('');
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [taxIdError, setTaxIdError] = useState<string | null>(null);

  const fetchTenant = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: Tenant }>(`/api/v1/tenants/${id}`);
      setTenant(res.data);
      setName(res.data.name || '');
      setDescription(res.data.description || '');
      setVerifiedWebsite(res.data.verified_website || '');
      setTaxId(res.data.tax_id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento tenant');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tenant) return;

    const normalizedWebsite = normalizeWebsite(verifiedWebsite);
    const normalizedTaxId = normalizeTaxId(taxId);

    const wsErr = validateWebsite(normalizedWebsite);
    const tidErr = validateTaxId(normalizedTaxId);
    setWebsiteError(wsErr);
    setTaxIdError(tidErr);
    if (wsErr || tidErr) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, string | null> = {
        name: name.trim(),
        description: description.trim() || null,
        verified_website: normalizedWebsite || null,
        tax_id: normalizedTaxId || null,
      };
      const res = await apiClient.patch<{ success: boolean; data: Tenant }>(
        `/api/v1/tenants/${tenant.id}`,
        payload
      );
      setTenant(res.data);
      setVerifiedWebsite(res.data.verified_website || '');
      setTaxId(res.data.tax_id || '');
      setSuccess('Tenant aggiornato con successo. Le difese SEE Gate 1/3 sono ora attive.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio tenant');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h2 className="text-lg font-semibold">{t('common.loadingError')}</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={fetchTenant}>{t('common.retry')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <Link href={`/platform/tenants/${tenant.id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna al tenant
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t('tenants.edit.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {tenant.name} <span className="font-mono text-xs">({tenant.code})</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identità e configurazione SEE</CardTitle>
          <CardDescription>
            I campi <strong>Sito web verificato</strong> e <strong>Tax ID</strong> sono richiesti
            dalle difese SEE Gate 1 (source verification) e Gate 3 (strong identity pre-flight).
            Fino alla loro compilazione, gli enrichment job saranno rifiutati.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome legale *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="verified_website" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Sito web verificato (dominio canonico)
              </Label>
              <Input
                id="verified_website"
                value={verifiedWebsite}
                onChange={(e) => {
                  setVerifiedWebsite(e.target.value);
                  setWebsiteError(null);
                }}
                onBlur={() => {
                  const normalized = normalizeWebsite(verifiedWebsite);
                  setVerifiedWebsite(normalized);
                  setWebsiteError(validateWebsite(normalized));
                }}
                placeholder="es. rtl.it"
                className={websiteError ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Dominio lowercase, senza protocollo, senza www. Verrà normalizzato automaticamente.
              </p>
              {websiteError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {websiteError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_id" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tax ID (P.IVA / VAT / Codice Fiscale)
              </Label>
              <Input
                id="tax_id"
                value={taxId}
                onChange={(e) => {
                  setTaxId(e.target.value);
                  setTaxIdError(null);
                }}
                onBlur={() => {
                  const normalized = normalizeTaxId(taxId);
                  setTaxId(normalized);
                  setTaxIdError(validateTaxId(normalized));
                }}
                placeholder="es. IT12345678901"
                className={taxIdError ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                8-32 caratteri alfanumerici. Formato uppercase senza spazi.
              </p>
              {taxIdError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {taxIdError}
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {success}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvataggio…' : 'Salva modifiche'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/platform/tenants/${tenant.id}`)}
                disabled={saving}
              >
                Annulla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
