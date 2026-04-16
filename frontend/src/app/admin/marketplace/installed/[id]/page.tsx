'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Webhook, Settings, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function InstalledPluginDetailPage() {
  const t = useTranslations('admin.marketplace.installed');
  const tCommon = useTranslations('common');
  const params = useParams();
  const pluginId = params.id as string;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" asChild>
          <Link href="/admin/marketplace/installed">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dettaglio Plugin</h1>
          <p className="text-muted-foreground">ID: {pluginId}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href={`/admin/marketplace/installed/${pluginId}/webhooks`}>
          <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Webhook className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Webhooks</CardTitle>
              <CardDescription>
                Gestisci le configurazioni webhook per questo plugin.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/marketplace/installed">
          <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Configurazione</CardTitle>
              <CardDescription>Impostazioni e parametri del plugin installato.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href={`/admin/marketplace/${pluginId}`}>
          <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Scheda Marketplace</CardTitle>
              <CardDescription>
                Visualizza la pagina del plugin nel catalogo marketplace.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
