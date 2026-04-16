'use client';

import { Button } from '@/components/ui/button';
import type { WizardState } from './OnboardingWizard';
import type { OrgStructureType } from '@/lib/api/endpoints/onboarding-wizard';

const ORG_TEMPLATES: {
  value: OrgStructureType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'flat',
    label: 'Piatta',
    description: 'Pochi livelli gerarchici. Ideale per startup e micro imprese.',
    icon: '▬',
  },
  {
    value: 'functional',
    label: 'Funzionale',
    description: 'Divisa per funzioni (HR, Finance, Ops). Standard per PMI.',
    icon: '⊞',
  },
  {
    value: 'divisional',
    label: 'Divisionale',
    description: 'Divisa per business unit o linee di prodotto.',
    icon: '⊟',
  },
  {
    value: 'matrix',
    label: 'A Matrice',
    description: 'Combina funzioni e progetti. Adatta a grandi organizzazioni.',
    icon: '⊠',
  },
];

interface Props {
  state: WizardState;
  patch: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2OrgStructure({ state, patch, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Struttura organizzativa</h2>
        <p className="text-slate-500 text-sm mt-1">
          Scegli il modello che meglio descrive la tua organizzazione.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ORG_TEMPLATES.map((tmpl) => {
          const selected = state.orgStructureType === tmpl.value;
          return (
            <button
              key={tmpl.value}
              type="button"
              onClick={() => patch({ orgStructureType: tmpl.value })}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="text-2xl mb-2">{tmpl.icon}</div>
              <div className="font-semibold text-slate-800">{tmpl.label}</div>
              <div className="text-xs text-slate-500 mt-1">{tmpl.description}</div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onNext}>
            Salta
          </Button>
          <Button onClick={onNext} disabled={!state.orgStructureType}>
            Avanti
          </Button>
        </div>
      </div>
    </div>
  );
}
