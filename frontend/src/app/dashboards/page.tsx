'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { LayoutDashboard, Beaker, Network, ArrowRight, BarChart3, Layers } from 'lucide-react';

const dashboardLinks = [
  {
    title: 'Prototipazione Cruscotti',
    description:
      'Strumento di prototipazione per creare e visualizzare dashboard personalizzate con widget configurabili e layout flessibili',
    href: '/dashboards/prototyping',
    icon: Beaker,
    status: 'Attivo',
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    title: 'Esploratore Tassonomie',
    description:
      'Esplora le tassonomie ESCO (competenze, occupazioni) e NACE (attivita economiche) integrate nella piattaforma',
    href: '/dashboards/taxonomies',
    icon: Network,
    status: 'Attivo',
    color: 'bg-purple-500/10 text-purple-600',
  },
];

export default function DashboardsPage() {
  const t = useTranslations('dashboards');
  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <LayoutDashboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">2</p>
                <p className="text-xs text-muted-foreground">Dashboard disponibili</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">ESCO + NACE</p>
                <p className="text-xs text-muted-foreground">Tassonomie integrate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">108</p>
                <p className="text-xs text-muted-foreground">Endpoint API disponibili</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dashboardLinks.map((dash) => (
          <Link key={dash.href} href={dash.href} className="group">
            <Card className="h-full hover:shadow-md transition-all hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${dash.color}`}
                  >
                    <dash.icon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-lg mt-3">{dash.title}</CardTitle>
                <CardDescription className="leading-relaxed">{dash.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
