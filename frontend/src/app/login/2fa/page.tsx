'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { setAuthToken, setRefreshToken, setCurrentTenant } from '@/lib/api-config';
import { easing } from '@/lib/motion-presets';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easing.out } },
};

function TwoFactorContent() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tempToken =
    typeof window !== 'undefined' ? sessionStorage.getItem('heuresys_2fa_temp_token') : null;
  const tenantCode =
    typeof window !== 'undefined' ? sessionStorage.getItem('heuresys_2fa_tenant_code') : null;

  useEffect(() => {
    if (!tempToken) {
      router.push('/login');
    }
    inputRef.current?.focus();
  }, [tempToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('Inserisci il codice a 6 cifre o un recovery code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          user: { role: string; tenantId?: string; tenant_code?: string };
        };
      }>(
        '/api/v1/auth/2fa/verify',
        {
          code: code.trim(),
          tempToken,
        },
        { skipAuth: true }
      );

      const { accessToken, refreshToken } = response.data;
      setAuthToken(accessToken);
      if (refreshToken) setRefreshToken(refreshToken);

      // Set tenant context
      const role = response.data.user.role;
      if (role === 'SUPERUSER') {
        localStorage.removeItem('heuresys_tenant');
      } else {
        setCurrentTenant(response.data.user.tenant_code || tenantCode || 'rtl-bank');
      }

      // Clean up session storage
      sessionStorage.removeItem('heuresys_2fa_temp_token');
      sessionStorage.removeItem('heuresys_2fa_role');
      sessionStorage.removeItem('heuresys_2fa_tenant_code');

      const redirectTo =
        sessionStorage.getItem('redirectAfterLogin') ||
        (role === 'SUPERUSER' ? '/platform' : '/admin');
      sessionStorage.removeItem('redirectAfterLogin');
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Codice non valido');
    } finally {
      setLoading(false);
    }
  };

  if (!tempToken) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <h1 className="sr-only">Two-Factor Authentication</h1>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-[420px]"
      >
        <motion.div variants={itemVariants}>
          <Card className="border-border/60 bg-card/85 backdrop-blur-xl shadow-floating rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary via-[var(--brand-accent)] to-[var(--accent-warm)]" />

            <CardHeader className="space-y-4 text-center pb-2 pt-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Verifica in due passaggi</CardTitle>
                <CardDescription className="mt-1.5">
                  Inserisci il codice a 6 cifre dalla tua app di autenticazione
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <motion.div variants={itemVariants} className="space-y-2">
                  <Input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={loading}
                    maxLength={12}
                    className="text-center text-2xl font-mono tracking-[0.5em] h-14 bg-background/60"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifica...
                      </>
                    ) : (
                      'Verifica'
                    )}
                  </Button>
                </motion.div>

                <motion.div variants={itemVariants} className="text-center">
                  <p className="text-xs text-muted-foreground">Puoi anche usare un recovery code</p>
                </motion.div>

                <motion.div variants={itemVariants} className="text-center pt-2">
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    onClick={() => {
                      sessionStorage.removeItem('heuresys_2fa_temp_token');
                      sessionStorage.removeItem('heuresys_2fa_role');
                      sessionStorage.removeItem('heuresys_2fa_tenant_code');
                    }}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Torna al login
                  </Link>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorContent />
    </Suspense>
  );
}
