'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  LayoutTemplate,
  Copy,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';

interface WorkspaceTemplate {
  id: number;
  target_role_id: number;
  tenant_id: string | null;
  name: string;
  layout_config: Record<string, unknown>;
  widget_config: unknown[];
  is_active: boolean;
  role_name: string;
  role_code: string;
  hierarchy_level: number;
  widget_count: number;
  created_at: string;
  updated_at: string;
}

export default function WorkspaceTemplatesPage() {
  const t = useTranslations('admin.workspaceTemplates');
  const tCommon = useTranslations('common');
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get<{ success: boolean; data: WorkspaceTemplate[] }>(
        '/api/v1/workspace/templates'
      );
      setTemplates(resp.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleClone = async (id: number) => {
    setActionLoading(id);
    try {
      await apiClient.post(`/api/v1/workspace/templates/${id}/clone`, {});
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: number) => {
    setActionLoading(id);
    try {
      await apiClient.patch(`/api/v1/workspace/templates/${id}/toggle`, {});
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutTemplate className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-destructive text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('roleTemplates')}</CardTitle>
          <CardDescription>
            Each role has a default template. Users without a personal workspace will see the
            template for their role. Tenant-specific templates override platform defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No templates found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.role')}</TableHead>
                  <TableHead>{t('fields.templateName')}</TableHead>
                  <TableHead className="text-center">{t('fields.widgets')}</TableHead>
                  <TableHead className="text-center">{t('fields.scope')}</TableHead>
                  <TableHead className="text-center">{t('fields.status')}</TableHead>
                  <TableHead className="text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{t.role_name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          L{t.hierarchy_level}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{t.widget_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={t.tenant_id ? 'default' : 'outline'}>
                        {t.tenant_id ? 'Tenant' : 'Platform'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={t.is_active ? 'default' : 'destructive'}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(t.id)}
                          disabled={actionLoading === t.id}
                          title={t.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {actionLoading === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : t.is_active ? (
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClone(t.id)}
                          disabled={actionLoading === t.id}
                          title="Clone template"
                        >
                          {actionLoading === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
