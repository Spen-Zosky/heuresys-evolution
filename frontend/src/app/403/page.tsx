'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ShieldX, ArrowLeft, Home, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeuresysLogo } from '@/components/branding/HeuresysLogo';
import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { easing } from '@/lib/motion-presets';
import { DotGrid } from '@/components/ui/decorative';

function ForbiddenContent() {
  const { user, logout } = useAuth();
  const t = useTranslations('errors');
  const tNav = useTranslations('nav');

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col">
      <h1 className="sr-only">Access Denied</h1>
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-destructive/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grain" />
        <DotGrid className="absolute inset-0 opacity-[0.03]" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easing.out }}
        className="border-b border-border/50 bg-card/70 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link href="/">
              <HeuresysLogo size="small" />
            </Link>
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {user.firstName || user.username} ({user.role})
                </span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {tNav('logout')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: easing.out }}
          className="w-full max-w-md"
        >
          <Card className="text-center border-border/60 bg-card/85 backdrop-blur-xl shadow-floating rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-destructive/80 via-destructive/40 to-transparent" />
            <CardHeader className="pb-4 pt-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2, ease: easing.out }}
                className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4"
              >
                <ShieldX className="h-10 w-10 text-destructive" />
              </motion.div>
              <CardTitle className="text-2xl font-bold font-display">{t('403.title')}</CardTitle>
              <CardDescription className="text-base mt-1">{t('403.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-6">
              <div className="p-4 bg-muted/30 rounded-xl text-sm text-muted-foreground border border-border/40">
                <p>{t('403.roleMessage', { role: user?.role || 'N/A' })}</p>
                <p className="mt-2">{t('403.contactAdmin')}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('goBack')}
                </Button>
                <Button asChild className="flex-1">
                  <Link href={user?.role === 'SUPERUSER' ? '/platform' : '/admin'}>
                    <Home className="h-4 w-4 mr-2" />
                    {t('403.action')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="py-4 text-center text-xs text-muted-foreground/70"
      >
        &copy; {new Date().getFullYear()} Heuresys. AI-Powered HR Platform.
      </motion.footer>
    </div>
  );
}

export default function ForbiddenPage() {
  return (
    <AuthProvider>
      <ForbiddenContent />
    </AuthProvider>
  );
}
