'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ShieldCheck, Info, Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

export default function SsoConfigPage() {
  const t = useTranslations('admin.settings.sso');
  const tCommon = useTranslations('common');
  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Configurazione SSO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Single Sign-On tramite protocollo OpenID Connect (OIDC)
          </p>
        </div>
        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
          In sviluppo
        </Badge>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <Construction className="h-16 w-16 text-muted-foreground/40 mb-6" />
            <h2 className="text-xl font-semibold mb-2">Funzionalita non ancora disponibile</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              La configurazione Single Sign-On (SSO) tramite protocollo OIDC e in fase di sviluppo.
              Sara possibile integrare provider come Azure AD, Okta, Google Workspace e Keycloak.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Azure AD', 'Okta', 'Google', 'Keycloak'].map((provider) => (
                <Badge key={provider} variant="secondary" className="py-1.5 px-3">
                  {provider}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Prossimi passi</p>
              <p>
                L&apos;integrazione SSO supportera i protocolli OpenID Connect e SAML 2.0,
                consentendo autenticazione centralizzata per tutti gli utenti del tenant.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
