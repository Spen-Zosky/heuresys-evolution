'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight,
  Users,
  TrendingUp,
  Shield,
  Sparkles,
  LayoutDashboard,
  Brain,
  Target,
  GraduationCap,
  Network,
  BarChart3,
  GitBranch,
  Zap,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/hooks/use-auth';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';

const FEATURE_ICONS = [Users, BarChart3, Sparkles, Shield, Network, GitBranch] as const;
const FEATURE_KEYS = [
  'employees',
  'analytics',
  'ai',
  'security',
  'taxonomies',
  'careerPaths',
] as const;
const STAT_KEYS = ['dbTables', 'apiEndpoints', 'frontendPages', 'aiEntities'] as const;
const STAT_VALUES = ['498', '108', '173', '4,080'] as const;

// Access gated via useAuth().hasRole('TENANT_OWNER') — RBP role hierarchy (P9).

function LandingContent() {
  const router = useRouter();
  const t = useTranslations('landing');
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

  const AI_CAPABILITIES = ['aiCap1', 'aiCap2', 'aiCap3', 'aiCap4'] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar with language switcher */}
      <div className="fixed top-0 right-0 z-50 p-3">
        <LanguageSwitcher />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 md:pt-36 md:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Zap className="h-4 w-4" />
              {t('badge')}
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 font-display leading-[1.1]">
              <span className="text-foreground">Heuresys</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                AI Platform
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('heroDescription')}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="text-base px-8 h-12 font-semibold">
                <Link href="/login">
                  {t('cta')} <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8 h-12">
                <Link href="/login">{t('ctaSecondary')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STAT_KEYS.map((key, i) => (
              <div key={key} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                  {STAT_VALUES[i]}
                </p>
                <p className="text-sm text-muted-foreground">{t(`stats.${key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('featuresTitle')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('featuresSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_KEYS.map((key, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <Card key={key} className="hover:shadow-md hover:border-primary/30 transition-all">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      {t(`featureItems.${key}.title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`featureItems.${key}.description`)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="py-24 bg-card/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Brain className="h-4 w-4" />
                {t('ai.badge')}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                {t('ai.title')}
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                {t('ai.description')}
              </p>
              <ul className="space-y-3">
                {AI_CAPABILITIES.map((key) => (
                  <li key={key} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    {t(`ai.capabilities.${key}`)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 rounded-3xl p-8 border border-border/40">
              <div className="text-center space-y-6">
                <div className="h-20 w-20 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
                  <Brain className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="text-5xl font-bold text-foreground">1,536</p>
                  <p className="text-muted-foreground mt-1">{t('ai.vectorDimensions')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-card/80 border border-border/40">
                    <p className="font-bold text-xl">4,080</p>
                    <p className="text-muted-foreground text-xs">{t('ai.indexedEntities')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card/80 border border-border/40">
                    <p className="font-bold text-xl">11</p>
                    <p className="text-muted-foreground text-xs">{t('ai.entityTypes')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Interface */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('dualInterface.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('dualInterface.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="hover:shadow-md transition-all">
              <CardContent className="p-8">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <LayoutDashboard className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-3">
                  {t('dualInterface.admin.title')}
                </h3>
                <p className="text-muted-foreground mb-6">{t('dualInterface.admin.description')}</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> {t('dualInterface.admin.goals')}
                  </li>
                  <li className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />{' '}
                    {t('dualInterface.admin.learning')}
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />{' '}
                    {t('dualInterface.admin.analytics')}
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all">
              <CardContent className="p-8">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-3">
                  {t('dualInterface.portal.title')}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {t('dualInterface.portal.description')}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> {t('dualInterface.portal.goals')}
                  </li>
                  <li className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />{' '}
                    {t('dualInterface.portal.learning')}
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />{' '}
                    {t('dualInterface.portal.payroll')}
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('ctaSection.title')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('ctaSection.description')}
          </p>
          <Button asChild size="lg" className="text-base px-10 h-12 font-semibold">
            <Link href="/login">
              {t('ctaSection.button')} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Heuresys. {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <AuthProvider>
      <LandingContent />
    </AuthProvider>
  );
}
