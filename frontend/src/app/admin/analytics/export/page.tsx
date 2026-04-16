'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  ArrowLeft,
  FileSpreadsheet,
  File,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { api, apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

interface LocalTemplate {
  id: string;
  name: string;
  description?: string;
  type?: string;
  format?: string;
}

export default function ExportReportingPage() {
  const t = useTranslations('admin.analytics.export');
  const [templates, setTemplates] = useState<LocalTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await api.analytics.getReportTemplates();
      const list = Array.isArray(data) ? data : [];
      setTemplates(
        list.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          type: t.report_type,
        }))
      );
    } catch {
      // If templates endpoint fails, use fallback options
      setTemplates([
        {
          id: 'workforce',
          name: 'Report Workforce',
          description: 'Headcount, assunzioni, cessazioni',
          type: 'workforce',
        },
        {
          id: 'compensation',
          name: 'Analisi Retribuzioni',
          description: 'Pay equity e salary bands',
          type: 'compensation',
        },
        {
          id: 'attendance',
          name: 'Presenze e Assenze',
          description: 'Assenze, straordinari e ferie',
          type: 'attendance',
        },
        {
          id: 'performance',
          name: 'Performance Review',
          description: 'Valutazioni e obiettivi',
          type: 'performance',
        },
        {
          id: 'employees',
          name: 'Export Dipendenti',
          description: 'Lista completa dipendenti',
          type: 'custom',
        },
      ]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiClient.post<{ download_url?: string; data?: unknown }>(
        '/api/v1/analytics/export',
        {
          template_id: selectedTemplate,
          dashboard: selectedTemplate || 'workforce',
          start_date: dateFrom || undefined,
          end_date: dateTo || undefined,
          format,
          include_charts: includeCharts,
        }
      );

      if (response.download_url) {
        window.open(response.download_url, '_blank');
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const getFormatIcon = (fmt: string) => {
    switch (fmt) {
      case 'pdf':
        return <File className="h-4 w-4 text-red-500" />;
      case 'xlsx':
        return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
      case 'csv':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'workforce':
        return 'bg-blue-100 text-blue-800';
      case 'compensation':
        return 'bg-green-100 text-green-800';
      case 'attendance':
        return 'bg-orange-100 text-orange-800';
      case 'performance':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          <Link href="/admin/analytics">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Export e Reporting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Report Generator */}
        <motion.div variants={staggerItem} className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('generateReport')}</CardTitle>
              <CardDescription>{t('configureReport')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Inizio</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fine</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-red-500" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="xlsx">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-green-500" />
                        Excel (XLSX)
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        CSV
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {format === 'pdf' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeCharts"
                    checked={includeCharts}
                    onCheckedChange={(checked) => setIncludeCharts(!!checked)}
                  />
                  <Label htmlFor="includeCharts" className="text-sm cursor-pointer">
                    Includi grafici nel report
                  </Label>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Report generato con successo
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleGenerateReport}
                disabled={!selectedTemplate || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generazione in corso...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Genera Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Templates List */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('availableTemplates')}</CardTitle>
              <CardDescription>{t('configuredTemplates')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="p-4 text-center text-muted-foreground">{t('loadingTemplates')}</div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getFormatIcon(template.format || 'pdf')}
                        <div>
                          <span className="font-medium text-sm">{template.name}</span>
                          {template.description && (
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {template.type && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${getTypeColor(template.type)}`}
                          >
                            {template.type}
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template.id);
                          }}
                        >
                          Seleziona
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
