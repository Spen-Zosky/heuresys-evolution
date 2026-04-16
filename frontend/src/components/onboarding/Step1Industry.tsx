'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIndustriesL4 } from '@/lib/hooks/use-onboarding-wizard';
import type { WizardState } from './OnboardingWizard';
import type { CompanySize } from '@/lib/api/endpoints/onboarding-wizard';

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: 'MICRO', label: 'Micro (1–9 dipendenti)' },
  { value: 'SMALL', label: 'Piccola (10–49 dipendenti)' },
  { value: 'MEDIUM', label: 'Media (50–249 dipendenti)' },
  { value: 'LARGE', label: 'Grande (250–999 dipendenti)' },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+ dipendenti)' },
];

interface Props {
  state: WizardState;
  patch: (partial: Partial<WizardState>) => void;
  onNext: () => void;
}

export default function Step1Industry({ state, patch, onNext }: Props) {
  const [search, setSearch] = useState('');
  const { data: industries, isLoading } = useIndustriesL4();

  const filtered = useMemo(() => {
    if (!industries) return [];
    const q = search.toLowerCase();
    return industries
      .filter((i) => i.nameIt.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
      .slice(0, 80);
  }, [industries, search]);

  const canProceed = !!state.nacePrimary && !!state.companySize;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Settore e dimensione</h2>
        <p className="text-slate-500 text-sm mt-1">
          Seleziona il settore principale e la dimensione della tua azienda.
        </p>
      </div>

      {/* Industry search */}
      <div className="space-y-2">
        <Label>Settore (NACE L4)</Label>
        <Input
          placeholder="Cerca settore..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="border rounded-lg overflow-auto max-h-48 text-sm">
          {isLoading && <p className="p-4 text-slate-400">Caricamento settori...</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="p-4 text-slate-400">Nessun risultato.</p>
          )}
          {filtered.map((ind) => (
            <button
              key={ind.code}
              type="button"
              onClick={() => patch({ nacePrimary: ind.code, industryNameIt: ind.nameIt })}
              className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b last:border-b-0 ${
                state.nacePrimary === ind.code
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-slate-700'
              }`}
            >
              <span className="text-slate-400 mr-2 font-mono text-xs">{ind.code}</span>
              {ind.nameIt}
            </button>
          ))}
        </div>
        {state.nacePrimary && (
          <p className="text-xs text-blue-600">
            Selezionato: <strong>{state.nacePrimary}</strong> — {state.industryNameIt}
          </p>
        )}
      </div>

      {/* Company size */}
      <div className="space-y-2">
        <Label>Dimensione aziendale</Label>
        <Select
          value={state.companySize}
          onValueChange={(val) => patch({ companySize: val as CompanySize })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleziona dimensione..." />
          </SelectTrigger>
          <SelectContent>
            {COMPANY_SIZES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!canProceed}>
          Avanti
        </Button>
      </div>
    </div>
  );
}
