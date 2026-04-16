'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import {
  Target,
  TrendingUp,
  BookOpen,
  FileText,
  Gem,
  Calendar,
  CheckCircle2,
  Award,
  Bot,
  type LucideIcon,
} from 'lucide-react';

interface DemoPageMeta {
  title: string;
  description: string;
  icon: LucideIcon;
}

const DEMO_PAGES: Record<string, DemoPageMeta> = {
  goals: {
    title: 'I Miei Obiettivi',
    description: 'Obiettivi personali, OKR e avanzamento verso i target assegnati.',
    icon: Target,
  },
  reviews: {
    title: 'Le Mie Valutazioni',
    description: 'Valutazioni performance, feedback ricevuti e storico review.',
    icon: TrendingUp,
  },
  learning: {
    title: 'La Mia Formazione',
    description: 'Corsi assegnati, certificazioni ottenute e percorsi formativi.',
    icon: BookOpen,
  },
  documents: {
    title: 'I Miei Documenti',
    description: 'Documenti personali, lettere, certificati e attestati.',
    icon: FileText,
  },
  payroll: {
    title: 'Cedolini',
    description: 'Buste paga, Certificazione Unica e documenti retributivi.',
    icon: Gem,
  },
  'time-off': {
    title: 'Ferie e Permessi',
    description: 'Richieste ferie, permessi, saldo residuo e calendario assenze.',
    icon: Calendar,
  },
  approvals: {
    title: 'Approvazioni',
    description: 'Richieste in attesa della tua approvazione o firma.',
    icon: CheckCircle2,
  },
  recognition: {
    title: 'Riconoscimenti',
    description: 'Riconoscimenti ricevuti e dati, badge e menzioni.',
    icon: Award,
  },
  'ai-chat': {
    title: 'AI Chat',
    description: 'Assistente AI per domande HR, policy aziendali e self-service.',
    icon: Bot,
  },
};

export default function PortalCatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const t = useTranslations('portal');
  const { slug } = use(params);
  const key = slug?.join('/') || '';
  const page = DEMO_PAGES[key];

  if (!page) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-6xl font-bold text-muted-foreground/20">404</div>
        <p className="mt-4 text-sm text-muted-foreground">{t('pageNotFound')}</p>
      </div>
    );
  }

  const Icon = page.icon;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="widget-card max-w-md px-10 py-12 text-center">
        <Icon className="mx-auto h-12 w-12 text-muted-foreground/30" strokeWidth={1.25} />
        <h2 className="mt-6 font-[Sora] text-xl font-semibold">{page.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
        <div
          className="relative mt-6 inline-block overflow-hidden rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
          style={{
            backgroundColor: 'oklch(0.638 0.200 310 / 0.12)',
            color: 'oklch(0.638 0.200 310)',
          }}
        >
          Coming Soon
          <span className="badge-shimmer absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
