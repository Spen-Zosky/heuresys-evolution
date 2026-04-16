'use client';

/**
 * Widget Composer with DnD Layout Editor
 *
 * Lists widget_catalog entries and the workspace widgets for a specific
 * dashboard context. Every user can maintain independent per-dashboard
 * workspaces. Includes a drag-and-drop layout editor (react-grid-layout)
 * to reposition and resize widgets visually.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
  Check,
  LayoutGrid,
  Move,
  Save,
  X,
} from 'lucide-react';
import WorkspaceRenderer from '@/components/widgets/workspace-renderer';
import type { WidgetPosition } from '@/components/widgets/workspace-renderer';

interface CatalogItem {
  code: string;
  name: string;
  description: string | null;
  widget_type: string;
  functional_area_code: string | null;
}

interface DashboardOption {
  id: number;
  code: string;
  name: string;
  icon: string | null;
}

interface WorkspaceWidgetFull {
  code: string;
  name?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

interface WorkspaceResponse {
  source: 'user' | 'template' | 'empty';
  widgets: WorkspaceWidgetFull[];
  layout_config?: { columns?: number; gap?: number };
}

const DEFAULT_DASHBOARD_CODE = 'employee_portal';
const DEFAULT_LAYOUT = { columns: 12, gap: 16 };

export default function WidgetComposerPage() {
  const t = useTranslations('portal');
  const locale = useLocale();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<string>(DEFAULT_DASHBOARD_CODE);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // DnD state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingLayoutRef = useRef<WidgetPosition[] | null>(null);

  // Bootstrap: load catalog + dashboard options once.
  useEffect(() => {
    void (async () => {
      try {
        const [catRes, dashRes] = await Promise.all([
          apiClient.get<{ success: boolean; data: CatalogItem[] }>('/api/v1/workspace/catalog'),
          apiClient.get<{ success: boolean; data: DashboardOption[] }>(
            '/api/v1/workspace/my-dashboards'
          ),
        ]);
        setCatalog(catRes?.data ?? []);
        setDashboards(dashRes?.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // Reload the workspace whenever the dashboard selector changes.
  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedDashboard ? `?dashboard=${encodeURIComponent(selectedDashboard)}` : '';
      const res = await apiClient.get<{ success: boolean; data: WorkspaceResponse }>(
        `/api/v1/workspace/me${qs}`
      );
      setWorkspace(res?.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedDashboard]);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  const activeCodes = useMemo(
    () => new Set((workspace?.widgets ?? []).map((w) => w.code)),
    [workspace]
  );

  const dashboardLabel = useMemo(
    () => dashboards.find((d) => d.code === selectedDashboard)?.name ?? selectedDashboard,
    [dashboards, selectedDashboard]
  );

  const widgetPositions: WidgetPosition[] = useMemo(
    () =>
      (workspace?.widgets ?? []).map((w, i) => ({
        code: w.code,
        x: w.position_x ?? (i % 3) * 4,
        y: w.position_y ?? Math.floor(i / 3) * 2,
        w: w.width ?? 4,
        h: w.height ?? 2,
      })),
    [workspace]
  );

  const layoutConfig = useMemo(
    () => ({
      columns: workspace?.layout_config?.columns ?? DEFAULT_LAYOUT.columns,
      gap: workspace?.layout_config?.gap ?? DEFAULT_LAYOUT.gap,
    }),
    [workspace]
  );

  // ============================================
  // DnD handlers
  // ============================================

  function handleLayoutChange(updated: WidgetPosition[]) {
    pendingLayoutRef.current = updated;
  }

  async function handleSaveLayout() {
    const layout = pendingLayoutRef.current;
    if (!layout || layout.length === 0) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    setError(null);
    const qs = selectedDashboard ? `?dashboard=${encodeURIComponent(selectedDashboard)}` : '';
    let savedCount = 0;

    // Save each widget position sequentially to avoid partial-failure confusion.
    // On any error, stop, refresh from server, and report how many saved.
    for (const widget of layout) {
      try {
        await apiClient.patch(
          `/api/v1/workspace/me/widgets/${encodeURIComponent(widget.code)}${qs}`,
          {
            position_x: widget.x,
            position_y: widget.y,
            width: widget.w,
            height: widget.h,
          }
        );
        savedCount++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          savedCount > 0
            ? `Salvataggio parziale: ${savedCount}/${layout.length} widget aggiornati. Errore: ${msg}. Layout ricaricato dal server.`
            : `Errore salvataggio layout: ${msg}`
        );
        await refreshWorkspace();
        setSaving(false);
        return;
      }
    }

    pendingLayoutRef.current = null;
    setEditMode(false);
    setFlash(`Layout salvato (${savedCount} widget)`);
    await refreshWorkspace();
    setSaving(false);
    setTimeout(() => setFlash(null), 2000);
  }

  function handleCancelEdit() {
    pendingLayoutRef.current = null;
    setEditMode(false);
  }

  // ============================================
  // Add/remove handlers
  // ============================================

  async function handleAdd(code: string) {
    setPendingCode(code);
    setError(null);
    try {
      const qs = selectedDashboard ? `?dashboard=${encodeURIComponent(selectedDashboard)}` : '';
      await apiClient.post(`/api/v1/workspace/me/widgets${qs}`, { code });
      setFlash(`Aggiunto ${code} (${dashboardLabel})`);
      await refreshWorkspace();
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingCode(null);
    }
  }

  async function handleRemove(code: string) {
    setPendingCode(code);
    setError(null);
    try {
      const qs = selectedDashboard ? `?dashboard=${encodeURIComponent(selectedDashboard)}` : '';
      await apiClient.delete(`/api/v1/workspace/me/widgets/${encodeURIComponent(code)}${qs}`);
      setFlash(`Rimosso ${code} (${dashboardLabel})`);
      await refreshWorkspace();
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingCode(null);
    }
  }

  const byArea = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of catalog) {
      const key = item.functional_area_code || 'OTHER';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [catalog]);
  const sortedAreas = useMemo(() => [...byArea.keys()].sort(), [byArea]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" /> {t('composer.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t('composer.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(true)}
                disabled={loading || widgetPositions.length === 0}
              >
                <Move className="h-4 w-4 mr-2" />
                {t('composer.editLayout')}
              </Button>
              <Button variant="outline" size="sm" onClick={refreshWorkspace} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('common.refresh')}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={handleSaveLayout} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? t('composer.saving') : t('composer.saveLayout')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dashboard context switcher */}
      {!editMode && (
        <Card className="p-4">
          <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-2">
            {t('composer.dashboardContext')}
          </label>
          <div className="flex flex-wrap gap-2">
            {dashboards.length === 0 && (
              <span className="text-xs text-muted-foreground">{t('common.loading')}</span>
            )}
            {dashboards.map((d) => {
              const active = d.code === selectedDashboard;
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => setSelectedDashboard(d.code)}
                  className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border/50 hover:border-primary/60'
                  }`}
                >
                  {d.name}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {locale === 'en' ? 'Active context' : 'Contesto attivo'}:{' '}
            <code>{selectedDashboard}</code>
          </p>
        </Card>
      )}

      {flash && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-500">
          <Check className="h-4 w-4" />
          {flash}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-600 dark:text-blue-400">
          <Move className="h-4 w-4" />
          Trascina i widget dalla barra in alto. Ridimensiona dal bordo in basso a destra. Premi
          &quot;Salva Layout&quot; per confermare.
        </div>
      )}

      {/* Widget grid preview / editor */}
      {widgetPositions.length > 0 && (
        <WorkspaceRenderer
          widgets={widgetPositions}
          layout={layoutConfig}
          loading={loading}
          editMode={editMode}
          onLayoutChange={handleLayoutChange}
        />
      )}

      {/* Workspace widget list (non-edit mode) */}
      {!editMode && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3">
            {t('composer.currentWorkspace')} — {dashboardLabel}
          </h2>
          {loading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
          {!loading && workspace && workspace.widgets.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('composer.noWidgets')}</p>
          )}
          {!loading && workspace && workspace.widgets.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {workspace.widgets.map((w) => (
                <li
                  key={w.code}
                  className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs"
                >
                  <span>{w.name || w.code}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${w.code}`}
                    className="hover:text-red-500"
                    disabled={pendingCode === w.code}
                    onClick={() => handleRemove(w.code)}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            {locale === 'en' ? 'Source' : 'Sorgente'}: <code>{workspace?.source ?? '—'}</code>
            {workspace?.source === 'template' && (
              <span className="ml-2">
                (aggiungendo un widget verra&apos; creato un workspace personale per{' '}
                <strong>{dashboardLabel}</strong> partendo da zero)
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Catalog (non-edit mode) */}
      {!editMode && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3">
            {t('composer.availableCatalog', { count: catalog.length })}
          </h2>
          {catalog.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          )}
          {sortedAreas.map((area) => (
            <div key={area} className="mb-4">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{area}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {byArea.get(area)!.map((item) => {
                  const isActive = activeCodes.has(item.code);
                  const disabled = pendingCode === item.code;
                  return (
                    <div
                      key={item.code}
                      className="flex items-start gap-2 rounded-md border border-border/50 p-3 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {item.code} — {item.widget_type}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isActive ? 'outline' : 'default'}
                        disabled={disabled}
                        onClick={() => (isActive ? handleRemove(item.code) : handleAdd(item.code))}
                      >
                        {isActive ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
