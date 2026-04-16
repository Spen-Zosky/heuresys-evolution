'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, LogIn, AlertCircle, Sun, Moon, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { setCurrentTenant, getAuthToken } from '@/lib/api-config';
import { HeuresysLogo } from '@/components/branding/HeuresysLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { easing } from '@/lib/motion-presets';
import { DotGrid, ConcentricCircles } from '@/components/ui/decorative';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easing.out },
  },
};

const showDemoCredentials =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutReason = searchParams.get('reason') === 'timeout';

  // Check if already logged in
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/admin';
      sessionStorage.removeItem('redirectAfterLogin');
      router.push(redirectTo);
    }
  }, [router]);

  // Load saved username if remember me was checked
  useEffect(() => {
    const savedUsername = localStorage.getItem('heuresys_remember_username');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!username.trim()) {
      setError(t('usernameRequired'));
      return;
    }
    if (!password) {
      setError(t('passwordRequired'));
      return;
    }

    setLoading(true);

    try {
      const response = await api.auth.login({ username, password });

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('heuresys_remember_username', username);
      } else {
        localStorage.removeItem('heuresys_remember_username');
      }

      // Check if 2FA is required
      const responseData = response as unknown as Record<string, unknown>;
      if (responseData.requires2FA && responseData.tempToken) {
        sessionStorage.setItem('heuresys_2fa_temp_token', responseData.tempToken as string);
        const user2fa = responseData.user as Record<string, unknown> | undefined;
        if (user2fa?.role) sessionStorage.setItem('heuresys_2fa_role', user2fa.role as string);
        if (user2fa?.tenant_code)
          sessionStorage.setItem('heuresys_2fa_tenant_code', user2fa.tenant_code as string);
        router.push('/login/2fa');
        return;
      }

      // Set tenant context based on role
      const userRole = response.user.role;
      if (userRole === 'SUPERUSER') {
        // SUPERUSER parte con "Tutti i Tenant" (nessun filtro)
        localStorage.removeItem('heuresys_tenant');
      } else {
        const tenantCode = response.user.tenant_code || 'rtl-bank';
        setCurrentTenant(tenantCode);
      }

      // Redirect based on role
      const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
      sessionStorage.removeItem('redirectAfterLogin');
      const defaultPath =
        userRole === 'SUPERUSER' ? '/platform' : userRole === 'EMPLOYEE' ? '/portal' : '/admin';
      const redirectTo = savedRedirect || defaultPath;
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <h1 className="sr-only">Login</h1>
      {/* Layered background: mesh gradient + grain + decorative patterns */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-mesh-login" />
        <div className="absolute inset-0 bg-grain" />
        <DotGrid className="absolute inset-0 opacity-[0.03]" />
        <ConcentricCircles className="absolute -right-32 -top-32 w-[500px] h-[500px] opacity-[0.04]" />
        <ConcentricCircles className="absolute -left-20 -bottom-20 w-[400px] h-[400px] opacity-[0.03]" />
      </div>

      {/* Fixed Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easing.out }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-border/30 bg-card/60"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <HeuresysLogo size="small" />
            </Link>
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label={theme === 'dark' ? t('themeLight') : t('themeDark')}
            >
              {theme === 'dark' ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen pt-14 p-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[420px]"
        >
          <motion.div variants={itemVariants}>
            <Card className="border-border/60 bg-card/85 backdrop-blur-xl shadow-floating rounded-2xl overflow-hidden">
              {/* Accent bar top */}
              <div className="h-1 bg-gradient-to-r from-primary via-[var(--brand-accent)] to-[var(--accent-warm)]" />

              <CardHeader className="space-y-5 text-center pb-2 pt-8">
                <motion.div
                  className="mx-auto"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: easing.out }}
                >
                  <HeuresysLogo size="large" animated showLoadAnimation />
                </motion.div>
                <div>
                  <CardTitle className="text-2xl font-bold font-display tracking-tight">
                    {t('login')}
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-sm">{t('loginSubtitle')}</CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-6 pb-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {timeoutReason && !error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{t('sessionExpiredDesc')}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}

                  <motion.div variants={itemVariants} className="space-y-2">
                    <label htmlFor="username" className="text-sm font-medium text-foreground">
                      {t('username')}
                    </label>
                    <Input
                      id="username"
                      type="text"
                      placeholder={t('usernamePlaceholder')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="username"
                      className="bg-background/60 border-border/70 focus:border-primary h-11"
                    />
                  </motion.div>

                  <motion.div variants={itemVariants} className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                      {t('password')}
                    </label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={t('passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="current-password"
                      className="bg-background/60 border-border/70 focus:border-primary h-11"
                    />
                  </motion.div>

                  <motion.div variants={itemVariants} className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                      disabled={loading}
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm text-muted-foreground cursor-pointer select-none"
                    >
                      {t('rememberMe')}
                    </label>
                  </motion.div>

                  <motion.div variants={itemVariants} className="pt-1">
                    <Button
                      type="submit"
                      className="w-full h-11 font-semibold"
                      size="lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('loggingIn')}
                        </>
                      ) : (
                        <>
                          <LogIn className="mr-2 h-4 w-4" />
                          {t('login')}
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {showDemoCredentials && (
                  <motion.div
                    variants={itemVariants}
                    className="mt-6 p-3 rounded-xl bg-secondary/20 border border-border/40"
                  >
                    <p className="text-xs text-muted-foreground text-center mb-2 font-medium">
                      {t('demoCredentials')}
                    </p>
                    <div className="flex justify-center gap-6 text-xs">
                      <div className="text-center">
                        <span className="text-muted-foreground">{t('username')}:</span>
                        <span className="font-mono ml-1.5 text-foreground font-medium">
                          sysadmin
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-muted-foreground">{t('password')}:</span>
                        <span className="font-mono ml-1.5 text-foreground font-medium">
                          Admin2026
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.p
            variants={itemVariants}
            className="text-center text-xs text-muted-foreground/70 mt-8"
          >
            &copy; {new Date().getFullYear()} Heuresys. {t('loginFooter')}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
