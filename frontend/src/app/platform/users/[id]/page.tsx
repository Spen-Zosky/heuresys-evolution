'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  UserCog,
  RefreshCw,
  AlertCircle,
  Shield,
  Calendar,
  Building2,
  Mail,
  KeyRound,
  Ban,
  CheckCircle,
  ChevronRight,
  Clock,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserDetail {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  tenantId: string | null;
  tenantName: string | null;
  totpEnabled?: boolean;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  category?: string;
  resource_type?: string;
  resource_id?: string;
  details?: string;
  success?: boolean;
}

const ROLE_OPTIONS = ['SUPERUSER', 'TENANT_OWNER', 'HR', 'USER', 'DEMO'] as const;

const roleColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SUPERUSER: 'destructive',
  TENANT_OWNER: 'destructive',
  ADMIN: 'default',
  HR: 'default',
  MANAGER: 'secondary',
  EMPLOYEE: 'outline',
  DEMO: 'outline',
  USER: 'outline',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserDetailPage() {
  const t = useTranslations('platform');
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // 2FA setup
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'codes'>('qr');
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [setupLoading, setSetupLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.users.getUserById(userId);
      setUser(result as unknown as UserDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento utente');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchAuditEvents = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: { logs: AuditEvent[] };
      }>(`/api/v1/audit-logs/user/${userId}?limit=10`);
      const logs = response?.data?.logs || [];
      setAuditEvents(logs);
    } catch {
      // Non-critical — silently fail
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
    fetchAuditEvents();
  }, [fetchUser, fetchAuditEvents]);

  // --- Actions ---

  const handleRoleChange = async () => {
    if (!newRole || !user) return;
    setRoleLoading(true);
    try {
      await api.users.updateUser(userId, { role: newRole });
      setUser((prev) => (prev ? { ...prev, role: newRole } : prev));
      setShowRoleDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel cambio ruolo');
    } finally {
      setRoleLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetLoading(true);
    setTempPassword(null);
    try {
      // Generate a secure password client-side for the reset
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const generated = Array.from(array, (b) => chars[b % chars.length]).join('');

      await api.users.resetPassword(userId, { new_password: generated });
      setTempPassword(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    setToggleLoading(true);
    try {
      const newState = !user.isActive;
      await api.users.updateUser(userId, { is_active: newState });
      setUser((prev) => (prev ? { ...prev, isActive: newState } : prev));
      setShowToggleDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel cambio stato');
    } finally {
      setToggleLoading(false);
    }
  };

  const handle2FASetup = async () => {
    setSetupLoading(true);
    try {
      const result = await apiClient.post<{
        success: boolean;
        data: { secret: string; qrCode: string };
      }>('/api/v1/auth/2fa/setup', {});
      setQrCode(result.data.qrCode);
      setTotpSecret(result.data.secret);
      setSetupStep('qr');
      setShow2FASetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore setup 2FA');
    } finally {
      setSetupLoading(false);
    }
  };

  const handle2FAVerify = async () => {
    setSetupLoading(true);
    try {
      const result = await apiClient.post<{ success: boolean; data: { recoveryCodes: string[] } }>(
        '/api/v1/auth/2fa/verify-setup',
        { code: verifyCode }
      );
      setRecoveryCodes(result.data.recoveryCodes);
      setSetupStep('codes');
      setUser((prev) => (prev ? { ...prev, totpEnabled: true } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Codice non valido');
    } finally {
      setSetupLoading(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.push('/platform/users')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Torna alla lista
              </Button>
              <Button onClick={fetchUser}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Riprova
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Breadcrumb */}
      <motion.div
        variants={staggerItem}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link href="/platform" className="hover:text-foreground transition-colors">
          Piattaforma
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/platform/users" className="hover:text-foreground transition-colors">
          Utenti
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{fullName}</span>
      </motion.div>

      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCog className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
            <p className="text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-sm">
            {user.isActive ? 'Attivo' : 'Inattivo'}
          </Badge>
          <Badge variant={roleColors[user.role] || 'outline'} className="text-sm">
            {user.role}
          </Badge>
        </div>
      </motion.div>

      {error && (
        <motion.div variants={staggerItem}>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        </motion.div>
      )}

      {/* Profile + Actions grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('users.detail.profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow
                  icon={<UserCog className="h-4 w-4" />}
                  label="Username"
                  value={user.username}
                />
                <InfoRow icon={<Shield className="h-4 w-4" />} label="Ruolo" value={user.role} />
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={user.email || '-'}
                />
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Tenant"
                  value={user.tenantName || '-'}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Ultimo accesso"
                  value={user.lastLogin ? new Date(user.lastLogin).toLocaleString('it-IT') : 'Mai'}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Creato il"
                  value={new Date(user.createdAt).toLocaleDateString('it-IT')}
                />
                {user.jobTitle && (
                  <InfoRow
                    icon={<UserCog className="h-4 w-4" />}
                    label="Posizione"
                    value={user.jobTitle}
                  />
                )}
                {user.department && (
                  <InfoRow
                    icon={<Building2 className="h-4 w-4" />}
                    label="Reparto"
                    value={user.department}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('users.detail.actions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setNewRole(user.role);
                  setShowRoleDialog(true);
                }}
              >
                <Shield className="h-4 w-4 mr-2" />
                Modifica Ruolo
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setTempPassword(null);
                  setShowResetDialog(true);
                }}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Reset Password
              </Button>
              {user.totpEnabled ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300">2FA Attivo</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handle2FASetup}
                  disabled={setupLoading}
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Abilita 2FA
                </Button>
              )}
              <Button
                variant={user.isActive ? 'destructive' : 'default'}
                className="w-full justify-start"
                onClick={() => setShowToggleDialog(true)}
              >
                {user.isActive ? (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Disabilita Account
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Riabilita Account
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Attività Recente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {auditEvents.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nessuna attività recente registrata per questo utente.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Azione</TableHead>
                    <TableHead>Risorsa</TableHead>
                    <TableHead>Esito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditEvents.map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleString('it-IT')}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{evt.action}</code>
                      </TableCell>
                      <TableCell className="text-sm">{evt.resource_type || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={evt.success !== false ? 'default' : 'destructive'}>
                          {evt.success !== false ? 'OK' : 'Errore'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Ruolo</DialogTitle>
            <DialogDescription>
              Cambia il ruolo di {user.username}. Il nuovo ruolo sarà effettivo immediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nuovo ruolo</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRoleDialog(false)}
              disabled={roleLoading}
            >
              Annulla
            </Button>
            <Button onClick={handleRoleChange} disabled={roleLoading || newRole === user.role}>
              {roleLoading ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={showResetDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowResetDialog(false);
            setTempPassword(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Verrà generata una nuova password temporanea per {user.username}.
            </DialogDescription>
          </DialogHeader>
          {tempPassword ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 space-y-2">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Password resettata con successo!
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nuova password temporanea:</p>
                  <code className="block text-sm font-mono bg-background border rounded px-3 py-2 select-all">
                    {tempPassword}
                  </code>
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Copia questa password ora. Non sarà più visibile dopo la chiusura.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowResetDialog(false);
                    setTempPassword(null);
                  }}
                >
                  Chiudi
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(false)}
                disabled={resetLoading}
              >
                Annulla
              </Button>
              <Button onClick={handleResetPassword} disabled={resetLoading}>
                {resetLoading ? 'Generazione...' : 'Genera Nuova Password'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog
        open={show2FASetup}
        onOpenChange={(open) => {
          if (!open && setupStep !== 'codes') setShow2FASetup(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configura Autenticazione a Due Fattori</DialogTitle>
          </DialogHeader>

          {setupStep === 'qr' && (
            <div className="space-y-4">
              <DialogDescription>
                Scansiona il QR code con la tua app di autenticazione (Google Authenticator, Authy,
                1Password).
              </DialogDescription>
              {qrCode && (
                <div className="flex justify-center">
                  <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Oppure inserisci manualmente:</p>
                <code className="block text-xs font-mono bg-muted px-3 py-2 rounded select-all break-all">
                  {totpSecret}
                </code>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShow2FASetup(false)}>
                  Annulla
                </Button>
                <Button
                  onClick={() => {
                    setSetupStep('verify');
                    setVerifyCode('');
                  }}
                >
                  Avanti
                </Button>
              </DialogFooter>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              <DialogDescription>
                Inserisci il codice a 6 cifre mostrato nell&apos;app per confermare la
                configurazione.
              </DialogDescription>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                className="text-center text-xl font-mono tracking-[0.5em]"
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSetupStep('qr')}
                  disabled={setupLoading}
                >
                  Indietro
                </Button>
                <Button onClick={handle2FAVerify} disabled={setupLoading || verifyCode.length < 6}>
                  {setupLoading ? 'Verifica...' : 'Conferma'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {setupStep === 'codes' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-4">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                  Salva questi recovery codes — non saranno più mostrati!
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((code, i) => (
                    <code
                      key={i}
                      className="text-xs font-mono bg-background border rounded px-2 py-1 text-center select-all"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setShow2FASetup(false);
                    setSetupStep('qr');
                  }}
                >
                  Ho salvato i codici — Continua
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Toggle Active Dialog */}
      <Dialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user.isActive ? 'Disabilita Account' : 'Riabilita Account'}</DialogTitle>
            <DialogDescription>
              {user.isActive
                ? `L'utente ${user.username} non potrà più accedere alla piattaforma. Questa azione è reversibile.`
                : `L'utente ${user.username} potrà nuovamente accedere alla piattaforma.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowToggleDialog(false)}
              disabled={toggleLoading}
            >
              Annulla
            </Button>
            <Button
              variant={user.isActive ? 'destructive' : 'default'}
              onClick={handleToggleActive}
              disabled={toggleLoading}
            >
              {toggleLoading ? 'Operazione...' : user.isActive ? 'Disabilita' : 'Riabilita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
