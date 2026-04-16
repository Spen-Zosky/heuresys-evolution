'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Palette, Type, Layers, Square, Circle, Minus, Loader2 } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/hooks/use-auth';

const colors = [
  { name: 'Primary', var: '--primary', swatch: 'bg-primary', text: 'text-primary' },
  {
    name: 'Secondary',
    var: '--secondary',
    swatch: 'bg-secondary',
    text: 'text-secondary-foreground',
  },
  { name: 'Accent', var: '--accent', swatch: 'bg-accent', text: 'text-accent-foreground' },
  { name: 'Muted', var: '--muted', swatch: 'bg-muted', text: 'text-muted-foreground' },
  { name: 'Destructive', var: '--destructive', swatch: 'bg-destructive', text: 'text-destructive' },
  { name: 'Card', var: '--card', swatch: 'bg-card', text: 'text-card-foreground' },
  { name: 'Border', var: '--border', swatch: 'bg-border', text: 'text-foreground' },
  { name: 'Background', var: '--background', swatch: 'bg-background', text: 'text-foreground' },
];

const typographySamples = [
  {
    label: 'Display',
    className: 'text-5xl font-bold font-display tracking-tight',
    text: 'Heuresys AI Platform',
  },
  {
    label: 'Heading 1',
    className: 'text-3xl font-bold tracking-tight',
    text: 'Dashboard Overview',
  },
  { label: 'Heading 2', className: 'text-2xl font-semibold', text: 'Employee Analytics' },
  { label: 'Heading 3', className: 'text-xl font-semibold', text: 'Performance Metrics' },
  {
    label: 'Body Large',
    className: 'text-lg',
    text: 'Piattaforma HRMS enterprise con AI integrata.',
  },
  {
    label: 'Body',
    className: 'text-base',
    text: 'Gestisci il capitale umano con intelligenza artificiale e analytics avanzate.',
  },
  {
    label: 'Small',
    className: 'text-sm text-muted-foreground',
    text: 'Ultimo aggiornamento: 3 minuti fa',
  },
  {
    label: 'Caption',
    className: 'text-xs text-muted-foreground',
    text: 'ID: 0c54b84a-db6e-4da4-bc91-af5d480d524e',
  },
];

const spacings = [
  { label: 'xs', size: '0.25rem', px: '4px' },
  { label: 'sm', size: '0.5rem', px: '8px' },
  { label: 'md', size: '1rem', px: '16px' },
  { label: 'lg', size: '1.5rem', px: '24px' },
  { label: 'xl', size: '2rem', px: '32px' },
  { label: '2xl', size: '3rem', px: '48px' },
];

const radiusSamples = [
  { label: 'none', className: 'rounded-none' },
  { label: 'sm', className: 'rounded-sm' },
  { label: 'md', className: 'rounded-md' },
  { label: 'lg', className: 'rounded-lg' },
  { label: 'xl', className: 'rounded-xl' },
  { label: '2xl', className: 'rounded-2xl' },
  { label: 'full', className: 'rounded-full' },
];

// Access gated via useAuth().hasRole('TENANT_OWNER') — RBP role hierarchy (P9).

function DesignEditorContent() {
  const t = useTranslations('dashboards');
  const router = useRouter();
  const { user, isLoading, isAuthenticated, hasRole } = useAuth();
  const isAllowed = hasRole('TENANT_OWNER');
  const [activeSection, setActiveSection] = useState<
    'colors' | 'typography' | 'spacing' | 'components'
  >('colors');

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user && !isAllowed) {
        router.replace('/admin');
      }
    }
  }, [isLoading, isAuthenticated, user, router, isAllowed]);

  if (isLoading || !isAuthenticated || !user || !isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('designEditor.title')} description={t('designEditor.description')} />

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'colors' as const, label: 'Colori', icon: Palette },
          { key: 'typography' as const, label: 'Tipografia', icon: Type },
          { key: 'spacing' as const, label: 'Spaziatura & Raggi', icon: Layers },
          { key: 'components' as const, label: 'Componenti', icon: Square },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeSection === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection(tab.key)}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Colors Section */}
      {activeSection === 'colors' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Palette Colori
            </CardTitle>
            <CardDescription>
              Colori del design system generati da CSS custom properties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {colors.map((color) => (
                <div key={color.name} className="space-y-2">
                  <div
                    className={`h-20 rounded-xl ${color.swatch} border border-border/50 shadow-sm`}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{color.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{color.var}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Foreground/Background pairs */}
            <div className="mt-8 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Combinazioni Foreground/Background
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { bg: 'bg-background', fg: 'text-foreground', label: 'Default' },
                  { bg: 'bg-card', fg: 'text-card-foreground', label: 'Card' },
                  { bg: 'bg-primary', fg: 'text-primary-foreground', label: 'Primary' },
                  { bg: 'bg-secondary', fg: 'text-secondary-foreground', label: 'Secondary' },
                  { bg: 'bg-muted', fg: 'text-muted-foreground', label: 'Muted' },
                  { bg: 'bg-destructive', fg: 'text-destructive-foreground', label: 'Destructive' },
                ].map((pair) => (
                  <div key={pair.label} className={`p-4 rounded-lg ${pair.bg} ${pair.fg} border`}>
                    <p className="font-medium text-sm">{pair.label}</p>
                    <p className="text-xs opacity-80">
                      The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Typography Section */}
      {activeSection === 'typography' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-primary" />
              Tipografia
            </CardTitle>
            <CardDescription>Scala tipografica e stili del design system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {typographySamples.map((sample) => (
                <div key={sample.label} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {sample.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {sample.className}
                    </span>
                  </div>
                  <p className={`text-foreground ${sample.className}`}>{sample.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spacing & Radius Section */}
      {activeSection === 'spacing' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Minus className="h-5 w-5 text-primary" />
                Spaziatura
              </CardTitle>
              <CardDescription>
                Scala di spaziatura utilizzata per padding, margin e gap
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {spacings.map((s) => (
                  <div key={s.label} className="flex items-center gap-4">
                    <Badge variant="outline" className="font-mono w-12 justify-center">
                      {s.label}
                    </Badge>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary/30 rounded" style={{ width: s.size }} />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono w-16 text-right">
                      {s.px}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Circle className="h-5 w-5 text-primary" />
                Border Radius
              </CardTitle>
              <CardDescription>Raggi di bordo disponibili per elementi UI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {radiusSamples.map((r) => (
                  <div key={r.label} className="text-center">
                    <div
                      className={`h-16 w-16 bg-primary/20 border-2 border-primary/40 ${r.className}`}
                    />
                    <p className="text-xs text-muted-foreground mt-2 font-mono">{r.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Components Preview Section */}
      {activeSection === 'components' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Square className="h-5 w-5 text-primary" />
              Componenti UI
            </CardTitle>
            <CardDescription>Anteprima dei componenti del design system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Buttons */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Bottoni</p>
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button size="sm">Small</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            {/* Badges */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Badge</p>
              <div className="flex flex-wrap gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </div>

            {/* Cards */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Cards</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">Card Standard</p>
                    <p className="text-xs text-muted-foreground mt-1">Con bordo e ombra default</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">Card Highlighted</p>
                    <p className="text-xs text-muted-foreground mt-1">Con bordo primary accent</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed border-2">
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">Card Dashed</p>
                    <p className="text-xs text-muted-foreground mt-1">Per placeholder e dropzone</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* States */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Stati</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Success', color: 'bg-green-100 text-green-800 border-green-200' },
                  { label: 'Warning', color: 'bg-amber-100 text-amber-800 border-amber-200' },
                  { label: 'Error', color: 'bg-red-100 text-red-800 border-red-200' },
                  { label: 'Info', color: 'bg-blue-100 text-blue-800 border-blue-200' },
                ].map((state) => (
                  <div
                    key={state.label}
                    className={`p-3 rounded-lg border text-center text-sm font-medium ${state.color}`}
                  >
                    {state.label}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DesignEditorPage() {
  return (
    <AuthProvider>
      <DesignEditorContent />
    </AuthProvider>
  );
}
