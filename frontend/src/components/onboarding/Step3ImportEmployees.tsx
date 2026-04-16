'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { WizardState } from './OnboardingWizard';

interface Props {
  state: WizardState;
  patch: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3ImportEmployees({ state, patch, onNext, onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);

  async function handleFile(file: File) {
    setFileName(file.name);
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'employees');
      const { getApiBaseUrl, getAuthToken, getCurrentTenant } = await import('@/lib/api-config');
      const res = await fetch(`${getApiBaseUrl()}/api/v1/import/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'X-Tenant-Code': getCurrentTenant() ?? '',
        },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setUploadDone(true);
      patch({ employeesSkipped: false });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Errore upload.');
    } finally {
      setUploading(false);
    }
  }

  function handleSkip() {
    patch({ employeesSkipped: true });
    onNext();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Importa dipendenti</h2>
        <p className="text-slate-500 text-sm mt-1">
          Carica un CSV con i tuoi dipendenti oppure salta e usa i dati demo.
        </p>
      </div>

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {uploading ? (
          <p className="text-blue-600 text-sm">Caricamento in corso...</p>
        ) : uploadDone ? (
          <p className="text-green-600 text-sm font-medium">✓ {fileName} caricato correttamente</p>
        ) : (
          <>
            <p className="text-slate-500 text-sm">
              Trascina qui un file CSV/XLSX o clicca per selezionarlo
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Campi: nome, cognome, email, ruolo, unità organizzativa
            </p>
          </>
        )}
        {uploadError && <p className="text-red-500 text-xs mt-2">{uploadError}</p>}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Salta — usa dati demo
          </Button>
          {uploadDone && <Button onClick={onNext}>Avanti</Button>}
        </div>
      </div>
    </div>
  );
}
