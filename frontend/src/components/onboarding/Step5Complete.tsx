'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { WizardState } from './OnboardingWizard';

interface Props {
  state: WizardState;
}

const QUICK_LINKS = [
  { href: '/admin/org-units', label: 'Struttura organizzativa', icon: '🏢' },
  { href: '/admin/employees', label: 'Dipendenti', icon: '👥' },
  { href: '/admin/processes', label: 'Processi', icon: '⚙️' },
];

export default function Step5Complete({ state }: Props) {
  const bp = state.setupResult?.blueprint;

  return (
    <div className="space-y-6 text-center">
      <div className="text-6xl">🎉</div>
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Configurazione completata!</h2>
        <p className="text-slate-500 text-sm mt-2">
          La tua organizzazione è pronta. Esplora le sezioni qui sotto per iniziare.
        </p>
      </div>

      {/* Blueprint stats */}
      {bp && (
        <div className="grid grid-cols-3 gap-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div>
            <p className="text-2xl font-bold text-blue-700">{bp.departmentsGenerated}</p>
            <p className="text-xs text-slate-500">Reparti generati</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-700">{bp.positionsGenerated}</p>
            <p className="text-xs text-slate-500">Posizioni generate</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-700">{bp.skillRequirementsGenerated}</p>
            <p className="text-xs text-slate-500">Competenze mappate</p>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-col gap-2">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Button variant="outline" className="w-full justify-start gap-2">
              <span>{link.icon}</span>
              {link.label}
            </Button>
          </Link>
        ))}
      </div>

      <Link href="/panoramica">
        <Button className="w-full mt-2">Esplora la tua organizzazione</Button>
      </Link>
    </div>
  );
}
