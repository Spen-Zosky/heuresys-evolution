'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, Layout, Type, Layers, Grid3X3, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useTranslations } from 'next-intl';

const designSections = [
  {
    title: 'Color Palette',
    description: 'Colori primari, secondari e accent del sistema',
    icon: Palette,
    items: [
      { label: 'Primary', value: 'hsl(222.2, 47.4%, 11.2%)', color: 'bg-primary' },
      { label: 'Secondary', value: 'hsl(210, 40%, 96.1%)', color: 'bg-secondary' },
      { label: 'Accent', value: 'hsl(210, 40%, 96.1%)', color: 'bg-accent' },
      { label: 'Destructive', value: 'hsl(0, 84.2%, 60.2%)', color: 'bg-destructive' },
      { label: 'Muted', value: 'hsl(210, 40%, 96.1%)', color: 'bg-muted' },
    ],
  },
  {
    title: 'Typography',
    description: 'Gerarchia tipografica e font families',
    icon: Type,
    items: [
      { label: 'Heading 1', value: 'text-4xl font-bold', preview: 'Aa' },
      { label: 'Heading 2', value: 'text-3xl font-bold', preview: 'Aa' },
      { label: 'Heading 3', value: 'text-2xl font-semibold', preview: 'Aa' },
      { label: 'Body', value: 'text-base', preview: 'Aa' },
      { label: 'Small', value: 'text-sm text-muted-foreground', preview: 'Aa' },
    ],
  },
  {
    title: 'Layout Grid',
    description: 'Sistema di griglie e spacing',
    icon: Grid3X3,
    items: [
      { label: 'Container', value: 'max-w-7xl mx-auto px-4' },
      { label: 'Sidebar', value: '280px fixed' },
      { label: 'Content', value: 'flex-1 p-6' },
      { label: 'Gap', value: 'gap-4 / gap-6' },
    ],
  },
  {
    title: 'Components',
    description: 'Componenti UI basati su shadcn/ui',
    icon: Layers,
    items: [
      { label: 'Buttons', value: 'primary, secondary, outline, ghost, destructive' },
      { label: 'Cards', value: 'Card, CardHeader, CardContent, CardFooter' },
      { label: 'Tables', value: 'Table, DataTable con sorting e filtering' },
      { label: 'Forms', value: 'Input, Select, Checkbox, Radio, Switch' },
      { label: 'Feedback', value: 'Badge, Alert, Toast, Progress' },
      { label: 'Navigation', value: 'Tabs, Breadcrumb, Sidebar, Command Palette' },
    ],
  },
];

const breakpoints = [
  { name: 'Mobile', icon: Smartphone, size: '< 640px', cols: 1 },
  { name: 'Tablet', icon: Tablet, size: '640px - 1024px', cols: 2 },
  { name: 'Desktop', icon: Monitor, size: '> 1024px', cols: '3-4' },
];

export default function WireframesPage() {
  const t = useTranslations('admin.design.wireframes');
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layout className="h-6 w-6" /> Design System & Wireframes
        </h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* Responsive Breakpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Breakpoints Responsive</CardTitle>
          <CardDescription>Punti di rottura per il layout adattivo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {breakpoints.map((bp) => {
              const Icon = bp.icon;
              return (
                <div key={bp.name} className="flex items-center gap-3 p-4 rounded-lg border">
                  <Icon className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{bp.name}</p>
                    <p className="text-sm text-muted-foreground">{bp.size}</p>
                    <p className="text-xs text-muted-foreground">Colonne: {bp.cols}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Design Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {designSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Icon className="h-5 w-5" /> {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-3">
                        {'color' in item && item.color && (
                          <div className={`h-6 w-6 rounded ${item.color}`} />
                        )}
                        {'preview' in item && item.preview && (
                          <span className="text-lg font-semibold text-muted-foreground">
                            {item.preview}
                          </span>
                        )}
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {item.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Wireframe Placeholder Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Page Layout Wireframes</CardTitle>
          <CardDescription>Struttura delle pagine principali della piattaforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              'Dashboard Admin',
              'Lista Dipendenti',
              'Profilo Dipendente',
              'Analytics Hub',
              'Gestione Corsi',
              'Organigramma',
              'Portal Employee',
              'Login Page',
              'Settings',
            ].map((page) => (
              <div
                key={page}
                className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/25 hover:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="text-center">
                  <Layout className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">{page}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
