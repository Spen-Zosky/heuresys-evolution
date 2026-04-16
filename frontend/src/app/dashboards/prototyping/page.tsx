'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Beaker,
  LayoutGrid,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Target,
  GraduationCap,
  Settings,
  Eye,
} from 'lucide-react';

const availableWidgets = [
  { id: 'kpi-employees', name: 'KPI Dipendenti', icon: Users, type: 'KPI' },
  { id: 'kpi-goals', name: 'KPI Obiettivi', icon: Target, type: 'KPI' },
  { id: 'kpi-courses', name: 'KPI Formazione', icon: GraduationCap, type: 'KPI' },
  { id: 'chart-trends', name: 'Trend Line', icon: TrendingUp, type: 'Chart' },
  { id: 'chart-bar', name: 'Bar Chart', icon: BarChart3, type: 'Chart' },
  { id: 'chart-pie', name: 'Pie Chart', icon: PieChart, type: 'Chart' },
];

const previewWidgets = [
  { id: 'w1', name: 'Dipendenti Totali', value: '267', trend: '+3.2%', type: 'kpi' },
  { id: 'w2', name: 'Obiettivi Attivi', value: '1,065', trend: '+12%', type: 'kpi' },
  { id: 'w3', name: 'Corsi Attivi', value: '127', trend: '+5', type: 'kpi' },
  { id: 'w4', name: 'Valutazioni', value: '290', trend: '+8.5%', type: 'kpi' },
];

export default function PrototypingPage() {
  const t = useTranslations('dashboards');
  const [selectedLayout, setSelectedLayout] = useState<'grid-4' | 'grid-3' | 'grid-2'>('grid-4');

  const layoutClasses = {
    'grid-4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    'grid-3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    'grid-2': 'grid-cols-1 sm:grid-cols-2',
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('prototyping.title')} description={t('prototyping.description')}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configura
          </Button>
          <Button size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Anteprima
          </Button>
        </div>
      </PageHeader>

      {/* Layout Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            Layout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['grid-4', 'grid-3', 'grid-2'] as const).map((layout) => (
              <Button
                key={layout}
                variant={selectedLayout === layout ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLayout(layout)}
              >
                {layout === 'grid-4'
                  ? '4 Colonne'
                  : layout === 'grid-3'
                    ? '3 Colonne'
                    : '2 Colonne'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Anteprima Cruscotto
          </CardTitle>
          <CardDescription>Anteprima con layout selezionato e widget di esempio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 ${layoutClasses[selectedLayout]}`}>
            {previewWidgets.map((widget) => (
              <Card
                key={widget.id}
                className="border-dashed border-2 hover:border-primary/30 transition-colors"
              >
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{widget.name}</p>
                  <p className="text-2xl font-bold text-foreground">{widget.value}</p>
                  <p className="text-xs text-green-600 mt-1">{widget.trend} vs periodo prec.</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Placeholder chart area */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-dashed border-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-foreground">Trend Dipendenti</p>
                  <Badge variant="outline">Line Chart</Badge>
                </div>
                <div className="h-40 bg-muted/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-dashed border-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-foreground">Distribuzione Dipartimenti</p>
                  <Badge variant="outline">Pie Chart</Badge>
                </div>
                <div className="h-40 bg-muted/30 rounded-lg flex items-center justify-center">
                  <PieChart className="h-10 w-10 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Widget Palette */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Widget Disponibili</CardTitle>
          <CardDescription>Trascina i widget nella dashboard per personalizzarla</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {availableWidgets.map((widget) => (
              <div
                key={widget.id}
                className="p-3 border rounded-lg text-center cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <widget.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-medium text-foreground">{widget.name}</p>
                <Badge variant="outline" className="text-xs mt-1">
                  {widget.type}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
