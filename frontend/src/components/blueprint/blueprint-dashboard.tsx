'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useBlueprintRuns } from '@/lib/hooks/use-blueprint-queries';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'running':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'failed':
      return 'bg-destructive text-destructive-foreground';
    default:
      return '';
  }
}

export function BlueprintDashboard() {
  const router = useRouter();
  const { data: runs, isLoading } = useBlueprintRuns();

  return (
    <div>
      <PageHeader
        title="Blueprint"
        description="Analisi organizzative basate su modelli di riferimento"
      >
        <Button onClick={() => router.push('/platform/blueprint/new')}>
          <span className="flex items-center">
            <Plus className="h-4 w-4 mr-2" />
          </span>
          Nuova Analisi
        </Button>
      </PageHeader>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (!runs || runs.length === 0) && (
        <EmptyState
          title="Nessuna analisi blueprint"
          description="Esegui la prima analisi per confrontare il tuo tenant con un modello di riferimento."
          action={{
            label: 'Nuova Analisi',
            onClick: () => router.push('/platform/blueprint/new'),
          }}
        />
      )}

      {!isLoading && runs && runs.length > 0 && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Modalità</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <motion.tr
                  key={run.id}
                  variants={staggerItem}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <TableCell>{formatDate(run.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{run.runMode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusVariant(run.status)}>{run.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/platform/blueprint/${run.id}`)}
                    >
                      Dettagli
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </div>
  );
}
