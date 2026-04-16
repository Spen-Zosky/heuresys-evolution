'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Layers, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { pageTransition } from '@/lib/motion-presets';
import { useBlueprintStore } from '@/lib/stores/blueprint-store';
import {
  useBlueprintTemplates,
  useIndustries,
  useCreateBlueprintRun,
  useBlueprintRun,
} from '@/lib/hooks/use-blueprint-queries';
import { StepIndicator } from './step-indicator';

const STEPS = [
  { label: 'Modalità' },
  { label: 'Configurazione' },
  { label: 'Riepilogo' },
  { label: 'Esecuzione' },
];

const COMPANY_SIZES = ['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'] as const;

export function BlueprintWizard() {
  const router = useRouter();
  const store = useBlueprintStore();
  const { data: templates, isLoading: templatesLoading } = useBlueprintTemplates();
  const { data: industries, isLoading: industriesLoading } = useIndustries(2);
  const createRun = useCreateBlueprintRun();

  const { data: runDetail } = useBlueprintRun(store.runId);
  const runStatus = runDetail?.run?.status;

  // Auto-advance when run completes or fails
  if (store.currentStep === 3 && runStatus && runStatus !== store.runStatus) {
    if (runStatus === 'completed' || runStatus === 'failed') {
      store.setRunStatus(runStatus as 'completed' | 'failed');
    }
  }

  const canAdvance = (): boolean => {
    if (store.currentStep === 1 && store.mode === 'overlay' && !store.selectedTemplateId) {
      return false;
    }
    return true;
  };

  const handleExecute = async () => {
    const payload = {
      templateId: store.selectedTemplateId || '',
      runMode: store.mode,
      inputConfig:
        store.mode === 'greenfield'
          ? { industryCode: store.industryCode, companySize: store.companySize }
          : undefined,
    };
    const result = await createRun.mutateAsync(payload);
    store.setRunId(result.id);
    store.setRunStatus('running');
    store.nextStep();
  };

  const handleCancel = () => {
    store.reset();
    router.push('/platform/blueprint');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <StepIndicator currentStep={store.currentStep} steps={STEPS} />

      <AnimatePresence mode="wait">
        {/* Step 0 — Modalità */}
        {store.currentStep === 0 && (
          <motion.div
            key="step-0"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/50',
                  store.mode === 'greenfield' && 'border-primary ring-1 ring-primary/30'
                )}
                onClick={() => store.setMode('greenfield')}
              >
                <CardContent className="pt-6 text-center space-y-2">
                  <span className="flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary mx-auto" />
                  </span>
                  <h3 className="font-semibold">Genera da zero</h3>
                  <p className="text-sm text-muted-foreground">
                    Crea un modello organizzativo partendo dal settore e dalla dimensione aziendale
                  </p>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/50',
                  store.mode === 'overlay' && 'border-primary ring-1 ring-primary/30'
                )}
                onClick={() => store.setMode('overlay')}
              >
                <CardContent className="pt-6 text-center space-y-2">
                  <span className="flex items-center justify-center">
                    <Layers className="h-8 w-8 text-primary mx-auto" />
                  </span>
                  <h3 className="font-semibold">Analizza tenant</h3>
                  <p className="text-sm text-muted-foreground">
                    Confronta il tenant esistente con un modello di riferimento e identifica i gap
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Step 1 — Configurazione */}
        {store.currentStep === 1 && (
          <motion.div
            key="step-1"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Card>
              <CardContent className="pt-6 space-y-4">
                {store.mode === 'overlay' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Template di riferimento</label>
                    {templatesLoading ? (
                      <div className="h-10 animate-pulse rounded-md bg-muted" />
                    ) : (
                      <Select
                        value={store.selectedTemplateId || ''}
                        onValueChange={(v) => store.setTemplate(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.templateName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {store.mode === 'greenfield' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Settore industriale</label>
                      {industriesLoading ? (
                        <div className="h-10 animate-pulse rounded-md bg-muted" />
                      ) : (
                        <Select
                          value={store.industryCode || ''}
                          onValueChange={(v) => store.setIndustryCode(v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona un settore" />
                          </SelectTrigger>
                          <SelectContent>
                            {industries?.map((ind) => (
                              <SelectItem key={ind.id} value={ind.code}>
                                {ind.code} — {ind.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Dimensione azienda</label>
                      <Select
                        value={store.companySize || ''}
                        onValueChange={(v) => store.setCompanySize(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona dimensione" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANY_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Alert>
                      <AlertDescription>
                        La modalità greenfield è in sviluppo. Al momento è disponibile solo la
                        modalità overlay.
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2 — Riepilogo */}
        {store.currentStep === 2 && (
          <motion.div
            key="step-2"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Riepilogo configurazione</h3>
                <Separator />
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Modalità</dt>
                    <dd className="text-sm font-medium capitalize">{store.mode}</dd>
                  </div>
                  {store.mode === 'overlay' && store.selectedTemplateId && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Template</dt>
                      <dd className="text-sm font-medium">
                        {templates?.find((t) => t.id === store.selectedTemplateId)?.templateName ||
                          store.selectedTemplateId}
                      </dd>
                    </div>
                  )}
                  {store.mode === 'greenfield' && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Settore</dt>
                        <dd className="text-sm font-medium">{store.industryCode || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Dimensione</dt>
                        <dd className="text-sm font-medium">{store.companySize || '—'}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3 — Esecuzione */}
        {store.currentStep === 3 && (
          <motion.div
            key="step-3"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Card>
              <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[200px] space-y-4">
                {store.runStatus === 'running' && (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Analisi in corso...</p>
                  </>
                )}

                {store.runStatus === 'completed' && (
                  <>
                    <span className="flex items-center justify-center">
                      <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                    </span>
                    <p className="font-medium">Analisi completata</p>
                    <Button onClick={() => router.push(`/platform/blueprint/${store.runId}`)}>
                      Vedi Risultati
                    </Button>
                  </>
                )}

                {store.runStatus === 'failed' && (
                  <>
                    <span className="flex items-center justify-center">
                      <XCircle className="h-10 w-10 text-destructive" />
                    </span>
                    <Alert variant="destructive">
                      <AlertDescription>
                        L&apos;analisi non è riuscita. Riprova o verifica la configurazione.
                      </AlertDescription>
                    </Alert>
                    <Button variant="outline" onClick={() => store.setStep(2)}>
                      Riprova
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer navigation */}
      {store.currentStep < 3 && (
        <div className="flex justify-between">
          <Button variant="ghost" onClick={handleCancel}>
            Annulla
          </Button>
          <div className="flex gap-2">
            {store.currentStep > 0 && (
              <Button variant="outline" onClick={() => store.prevStep()}>
                Indietro
              </Button>
            )}
            {store.currentStep < 2 && (
              <Button onClick={() => store.nextStep()} disabled={!canAdvance()}>
                Avanti
              </Button>
            )}
            {store.currentStep === 2 && (
              <Button
                onClick={handleExecute}
                disabled={createRun.isPending || store.mode === 'greenfield'}
              >
                {createRun.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Avvio...
                  </>
                ) : (
                  'Esegui Analisi'
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
