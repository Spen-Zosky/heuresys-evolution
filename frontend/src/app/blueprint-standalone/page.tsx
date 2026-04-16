'use client';

import { useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useStandaloneIndustries,
  useGenerateStandaloneBlueprint,
} from '@/lib/hooks/use-standalone-queries';
import type {
  CompanySize,
  StandaloneBlueprintResult,
} from '@/lib/api/endpoints/blueprint-standalone';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: 'MICRO', label: 'Micro (1–9 dipendenti)' },
  { value: 'SMALL', label: 'Piccola (10–49 dipendenti)' },
  { value: 'MEDIUM', label: 'Media (50–249 dipendenti)' },
  { value: 'LARGE', label: 'Grande (250–999 dipendenti)' },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+ dipendenti)' },
];

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------

export default function BlueprintStandalonePage() {
  const t = useTranslations('dashboards');
  const router = useRouter();
  const { data: industries, isLoading: loadingIndustries } = useStandaloneIndustries();

  const [naceCode, setNaceCode] = useState('');
  const [companySize, setCompanySize] = useState<CompanySize | ''>('');
  const [customProcessesText, setCustomProcessesText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Raggruppa le industrie per codice NACE (mostra solo opzioni uniche per NACE code)
  const industryOptions = useMemo(() => {
    if (!industries) return [];
    const seen = new Set<string>();
    return industries
      .filter((i) => {
        if (seen.has(i.naceCode)) return false;
        seen.add(i.naceCode);
        return true;
      })
      .sort((a, b) => a.industryNameIt.localeCompare(b.industryNameIt));
  }, [industries]);

  const { mutate: generate, isPending } = useGenerateStandaloneBlueprint(
    (result: StandaloneBlueprintResult) => {
      sessionStorage.setItem('blueprint_standalone_result', JSON.stringify(result));
      router.push('/blueprint-standalone/result');
    }
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!naceCode || !companySize) {
      setError('Seleziona settore e dimensione aziendale.');
      return;
    }

    const customProcesses = customProcessesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

    generate({
      naceCode,
      companySize,
      customProcesses: customProcesses.length > 0 ? customProcesses : undefined,
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            H
          </div>
          <span className="font-semibold text-lg">Heuresys</span>
          <Badge variant="secondary" className="ml-2">
            Blueprint Generator
          </Badge>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-br from-primary/5 to-background">
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Genera il Blueprint della tua Organizzazione
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Inserisci settore e dimensione: ottieni processi, ruoli, skill e KPI suggeriti per la
            tua struttura aziendale — senza registrazione.
          </p>
        </div>
      </section>

      {/* Form */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Settore */}
          <div className="space-y-2">
            <Label htmlFor="nace-select" className="text-base font-medium">
              Settore industriale (codice NACE)
            </Label>
            <p className="text-sm text-muted-foreground">
              Seleziona il settore più vicino alla tua attività.
            </p>
            <Select value={naceCode} onValueChange={setNaceCode} disabled={loadingIndustries}>
              <SelectTrigger id="nace-select" className="w-full">
                <SelectValue
                  placeholder={loadingIndustries ? 'Caricamento settori...' : 'Seleziona settore'}
                />
              </SelectTrigger>
              <SelectContent>
                {industryOptions.map((opt) => (
                  <SelectItem key={opt.naceCode} value={opt.naceCode}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {opt.naceCode}
                    </span>
                    {opt.industryNameIt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dimensione */}
          <div className="space-y-2">
            <Label htmlFor="size-select" className="text-base font-medium">
              Dimensione aziendale
            </Label>
            <Select value={companySize} onValueChange={(v) => setCompanySize(v as CompanySize)}>
              <SelectTrigger id="size-select" className="w-full max-w-sm">
                <SelectValue placeholder="Seleziona dimensione" />
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

          {/* Processi custom */}
          <div className="space-y-2">
            <Label htmlFor="custom-processes" className="text-base font-medium">
              Processi aggiuntivi{' '}
              <span className="text-muted-foreground font-normal">(opzionale)</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Un processo per riga. Verranno aggiunti al blueprint generato (max 20).
            </p>
            <Textarea
              id="custom-processes"
              placeholder={'Gestione qualità\nCompliance ESG\nRelazioni con investitori'}
              value={customProcessesText}
              onChange={(e) => setCustomProcessesText(e.target.value)}
              rows={4}
              className="resize-none font-mono text-sm"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto px-10"
            disabled={isPending || loadingIndustries}
          >
            {isPending ? 'Generazione in corso...' : 'Genera Blueprint'}
          </Button>
        </form>

        {/* Info */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t pt-10">
          {[
            {
              title: 'Processi & Fasi',
              desc: 'Value chain completa con processi primari e di supporto',
            },
            { title: 'Ruoli & Skill', desc: 'Ruoli operativi con competenze ESCO richieste' },
            {
              title: 'KPI & Org Chart',
              desc: 'Indicatori di performance e struttura organizzativa suggerita',
            },
          ].map((item) => (
            <div key={item.title} className="text-center space-y-1">
              <p className="font-semibold text-sm">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Vuoi salvare e personalizzare il blueprint?{' '}
          <a href="/auth/register" className="underline hover:text-foreground">
            Crea un account gratuito
          </a>
        </p>
      </main>
    </div>
  );
}
