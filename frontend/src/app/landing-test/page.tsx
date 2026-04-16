'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Sparkles, Users, BarChart3, Shield, Brain, Zap, Loader2 } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/hooks/use-auth';

const highlights = [
  {
    icon: Sparkles,
    title: 'AI-Powered',
    desc: 'Intelligenza artificiale integrata in ogni funzionalita',
  },
  {
    icon: Users,
    title: 'Multi-Tenant',
    desc: 'Architettura enterprise per organizzazioni complesse',
  },
  { icon: BarChart3, title: 'Analytics', desc: 'Dashboard e insights in tempo reale' },
  { icon: Shield, title: 'Enterprise Security', desc: 'RBAC, RLS, audit logging completo' },
];

// Access gated via useAuth().hasRole('TENANT_OWNER') — RBP role hierarchy (P9).

function LandingTestContent() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, hasRole } = useAuth();
  const isAllowed = hasRole('TENANT_OWNER');

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user && !isAllowed) {
        router.replace('/admin');
      }
    }
  }, [isLoading, isAuthenticated, user, router, isAllowed]);

  if (isLoading || !isAuthenticated || !user || !isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 to-background -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            A/B Test Variant
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              HR Intelligente.
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Decisioni Migliori.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            Heuresys trasforma dati HR in conoscenza strategica con AI, tassonomie ESCO/NACE e
            analytics predittive.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="text-base px-10 h-13 font-semibold">
              <Link href="/login">
                Prova Gratuita <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="text-base px-8 h-13">
              <Link href="/login">Scopri di piu</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-20 border-t border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {highlights.map((h) => (
              <Card key={h.title} className="text-center hover:shadow-sm transition-shadow">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <h.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{h.title}</h3>
                  <p className="text-sm text-muted-foreground">{h.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-card/30 border-y border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Brain className="h-4 w-4" />
            Semantic Intelligence
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            4,080 Entita Semantiche Indicizzate
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Il nostro motore semantico comprende le relazioni tra competenze, ruoli e percorsi di
            carriera con embeddings a 1,536 dimensioni.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="p-4 rounded-xl border bg-card">
              <p className="text-2xl font-bold text-foreground">11</p>
              <p className="text-xs text-muted-foreground">Tipi Entita</p>
            </div>
            <div className="p-4 rounded-xl border bg-card">
              <p className="text-2xl font-bold text-foreground">4</p>
              <p className="text-xs text-muted-foreground">Tenant Attivi</p>
            </div>
            <div className="p-4 rounded-xl border bg-card">
              <p className="text-2xl font-bold text-foreground">100%</p>
              <p className="text-xs text-muted-foreground">Copertura</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Inizia subito, gratis</h2>
          <p className="text-muted-foreground mb-8">
            Nessuna carta di credito richiesta. Setup in 5 minuti.
          </p>
          <Button asChild size="lg" className="text-base px-10 h-12 font-semibold">
            <Link href="/login">
              Crea Account <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Heuresys | Landing Test Variant B
        </p>
      </footer>
    </div>
  );
}

export default function LandingTestPage() {
  return (
    <AuthProvider>
      <LandingTestContent />
    </AuthProvider>
  );
}
