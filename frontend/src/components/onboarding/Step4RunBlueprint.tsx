'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRunOnboardingSetup } from '@/lib/hooks/use-onboarding-wizard';
import type { WizardState } from './OnboardingWizard';
import type { SetupResult, OrgStructureType } from '@/lib/api/endpoints/onboarding-wizard';

const ORG_LABELS: Record<OrgStructureType, string> = {
  flat: 'Piatta',
  functional: 'Funzionale',
  divisional: 'Divisionale',
  matrix: 'A Matrice',
};

const SIZE_LABELS: Record<string, string> = {
  MICRO: 'Micro',
  SMALL: 'Piccola',
  MEDIUM: 'Media',
  LARGE: 'Grande',
  ENTERPRISE: 'Enterprise',
};

interface Props {
  state: WizardState;
  patch: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step4RunBlueprint({ state, patch, onNext, onBack }: Props) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { mutate: runSetup, isPending } = useRunOnboardingSetup((result: SetupResult) => {
    patch({ setupResult: result });
    setProgress(100);
    setTimeout(onNext, 800);
  });

  function handleGenerate() {
    if (!state.nacePrimary || !state.companySize) return;
    setError(null);
    // Animate progress while waiting
    setProgress(10);
    const interval = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 5 : p));
    }, 400);

    runSetup(
      {
        nacePrimary: state.nacePrimary,
        companySize: state.companySize,
        orgStructureType: state.orgStructureType || undefined,
      },
      {
        onError: (err) => {
          clearInterval(interval);
          setProgress(0);
          setError(err instanceof Error ? err.message : 'Errore durante la generazione.');
        },
        onSettled: () => clearInterval(interval),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Genera Blueprint</h2>
        <p className="text-slate-500 text-sm mt-1">
          Verifica la configurazione e avvia la generazione del tuo blueprint organizzativo.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="bg-slate-50 rounded-xl p-5 space-y-3 border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Riepilogo configurazione
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-400">Settore NACE</span>
            <p className="font-medium text-slate-800">{state.nacePrimary || '—'}</p>
            <p className="text-xs text-slate-500">{state.industryNameIt}</p>
          </div>
          <div>
            <span className="text-slate-400">Dimensione</span>
            <p className="font-medium text-slate-800">
              {state.companySize ? SIZE_LABELS[state.companySize] : '—'}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Struttura</span>
            <p className="font-medium text-slate-800">
              {state.orgStructureType ? (
                ORG_LABELS[state.orgStructureType]
              ) : (
                <span className="text-slate-400 italic">Auto</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Dipendenti</span>
            <Badge variant={state.employeesSkipped ? 'secondary' : 'default'} className="mt-1">
              {state.employeesSkipped ? 'Dati demo' : 'CSV importato'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress */}
      {isPending && (
        <div className="space-y-2">
          <p className="text-sm text-blue-600">Generazione blueprint in corso...</p>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg p-3">{error}</p>}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          Indietro
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={isPending || !state.nacePrimary || !state.companySize}
        >
          {isPending ? 'Generazione...' : 'Genera Blueprint'}
        </Button>
      </div>
    </div>
  );
}
