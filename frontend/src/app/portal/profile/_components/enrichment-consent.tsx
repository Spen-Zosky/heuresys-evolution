'use client';

/**
 * EnrichmentConsent — GDPR consent card for employee profile enrichment
 *
 * P3-17: Employees Descriptor + GDPR Consent
 *
 * Displays current consent status, allows granting/revoking enrichment consent
 * with scope selection.  Revoke triggers confirmation dialog (GDPR data erasure).
 *
 * Review fix C2: errors are NEVER silently swallowed — shows error state + retry.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient, ApiClientError } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsentStatus {
  consented: boolean;
  consentedAt: string | null;
  scopes: string[];
}

interface RevokeResult {
  consented: boolean;
  dataRemoved: boolean;
  recordsPurged: number;
}

const AVAILABLE_SCOPES = [
  { value: 'professional_profile', label: 'Profilo Professionale' },
  { value: 'skills', label: 'Competenze' },
  { value: 'education', label: 'Formazione' },
  { value: 'certifications', label: 'Certificazioni' },
] as const;

const BASE_PATH = '/api/v1/enrichment-consent';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EnrichmentConsent() {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  // ---------------------------------------------------------------------------
  // Fetch consent status
  // ---------------------------------------------------------------------------

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: ConsentStatus }>(`${BASE_PATH}/me`);
      setStatus(res.data);
      setSelectedScopes(res.data.scopes ?? []);
    } catch (err) {
      // Review fix C2: do NOT use bare catch {} — surface error
      if (err instanceof ApiClientError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Errore nel caricamento consenso');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // Grant consent
  // ---------------------------------------------------------------------------

  const handleGrant = async () => {
    if (selectedScopes.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post<{ success: boolean; data: ConsentStatus }>(
        `${BASE_PATH}/me/grant`,
        { scopes: selectedScopes }
      );
      setStatus(res.data);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio consenso');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Revoke consent
  // ---------------------------------------------------------------------------

  const handleRevoke = async () => {
    setSaving(true);
    setError(null);
    setShowRevokeDialog(false);
    try {
      const res = await apiClient.post<{ success: boolean; data: RevokeResult }>(
        `${BASE_PATH}/me/revoke`
      );
      setStatus({ consented: false, consentedAt: null, scopes: [] });
      setSelectedScopes([]);
      if (res.data.recordsPurged > 0) {
        // Silently acknowledge — the user sees the toggle flip
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Errore nella revoca consenso');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Scope toggle
  // ---------------------------------------------------------------------------

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arricchimento Profilo AI</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (error && !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arricchimento Profilo AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  const consented = status?.consented ?? false;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arricchimento Profilo AI</CardTitle>
          <CardDescription>
            Consenti alla piattaforma di arricchire il tuo profilo con dati professionali tramite
            AI. Puoi revocare il consenso in qualsiasi momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Consenso attivo</span>
            <Switch
              checked={consented}
              disabled={saving}
              onCheckedChange={(checked) => {
                if (!checked) {
                  setShowRevokeDialog(true);
                } else if (selectedScopes.length > 0) {
                  handleGrant();
                }
              }}
            />
          </div>

          {/* Status badge */}
          {consented && status?.consentedAt && (
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600">
                Consenso attivo
              </Badge>
              <span className="text-xs text-muted-foreground">
                dal {new Date(status.consentedAt).toLocaleDateString('it-IT')}
              </span>
            </div>
          )}

          {/* Scope selection */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Ambiti di arricchimento
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map((scope) => {
                const active = selectedScopes.includes(scope.value);
                return (
                  <Badge
                    key={scope.value}
                    variant={active ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => {
                      if (!saving) toggleScope(scope.value);
                    }}
                  >
                    {scope.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Save button (when scopes changed and not yet consented, or scopes differ) */}
          {!consented && selectedScopes.length > 0 && (
            <Button size="sm" disabled={saving} onClick={handleGrant}>
              {saving ? 'Salvataggio...' : 'Concedi consenso'}
            </Button>
          )}

          {consented &&
            selectedScopes.sort().join(',') !== (status?.scopes ?? []).sort().join(',') && (
              <Button size="sm" variant="outline" disabled={saving} onClick={handleGrant}>
                {saving ? 'Aggiornamento...' : 'Aggiorna ambiti'}
              </Button>
            )}

          {/* Inline error */}
          {error && (
            <p className="text-xs text-destructive">
              {error}{' '}
              <button className="underline" onClick={fetchStatus}>
                Riprova
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Revoke confirmation dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoca consenso arricchimento</DialogTitle>
            <DialogDescription>
              Revocando il consenso, tutti i dati di arricchimento associati al tuo profilo verranno
              eliminati in modo permanente (GDPR). Questa azione non e' reversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={saving}>
              {saving ? 'Revoca in corso...' : 'Revoca e cancella dati'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
