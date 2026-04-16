'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import Step1Industry from './Step1Industry';
import Step2OrgStructure from './Step2OrgStructure';
import Step3ImportEmployees from './Step3ImportEmployees';
import Step4RunBlueprint from './Step4RunBlueprint';
import Step5Complete from './Step5Complete';
import type {
  CompanySize,
  OrgStructureType,
  SetupResult,
} from '@/lib/api/endpoints/onboarding-wizard';

// -------------------------------------------------------------------------
// TYPES
// -------------------------------------------------------------------------

export interface WizardState {
  nacePrimary: string;
  industryNameIt: string;
  companySize: CompanySize | '';
  orgStructureType: OrgStructureType | '';
  employeesSkipped: boolean;
  setupResult: SetupResult | null;
}

const STEP_LABELS = ['Settore', 'Struttura', 'Dipendenti', 'Blueprint', 'Completato'];

// -------------------------------------------------------------------------
// COMPONENT
// -------------------------------------------------------------------------

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    nacePrimary: '',
    industryNameIt: '',
    companySize: '',
    orgStructureType: '',
    employeesSkipped: false,
    setupResult: null,
  });

  const totalSteps = 5;
  const progressPct = ((step - 1) / (totalSteps - 1)) * 100;

  function patch(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function next() {
    setStep((s) => Math.min(s + 1, totalSteps));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-start px-4 py-12">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Configura la tua organizzazione</h1>
        <p className="text-slate-500 text-sm">
          Passo {step} di {totalSteps} — {STEP_LABELS[step - 1]}
        </p>
        <Progress value={progressPct} className="mt-3 h-2" />
        {/* Step pills */}
        <div className="flex gap-2 mt-4">
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div
                key={n}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                  done
                    ? 'bg-blue-600 text-white'
                    : active
                      ? 'bg-blue-100 text-blue-700 font-semibold ring-1 ring-blue-400'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                <span>{done ? '✓' : n}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        {step === 1 && <Step1Industry state={state} patch={patch} onNext={next} />}
        {step === 2 && (
          <Step2OrgStructure state={state} patch={patch} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <Step3ImportEmployees state={state} patch={patch} onNext={next} onBack={back} />
        )}
        {step === 4 && (
          <Step4RunBlueprint state={state} patch={patch} onNext={next} onBack={back} />
        )}
        {step === 5 && <Step5Complete state={state} />}
      </div>
    </div>
  );
}
