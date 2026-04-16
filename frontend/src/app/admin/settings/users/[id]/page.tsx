'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserCog, ArrowLeft, Calendar, Shield, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { api } from '@/lib/api';

interface UserDetail {
  id: string;
  username: string;
  email?: string;
  role: string;
  is_active?: boolean;
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

const roleLabels: Record<string, { label: string; className: string }> = {
  SUPERUSER: { label: 'Superuser', className: 'bg-purple-500 text-white' },
  TENANT_OWNER: { label: 'Amministratore Sistema', className: 'bg-red-500 text-white' },
  ADMIN: { label: 'Amministratore', className: 'bg-orange-500 text-white' },
  HR: { label: 'HR Manager', className: 'bg-blue-500 text-white' },
  MANAGER: { label: 'Manager', className: 'bg-green-500 text-white' },
  EMPLOYEE: { label: 'Dipendente', className: 'bg-gray-500 text-white' },
  DEMO: { label: 'Demo', className: 'bg-gray-400 text-white' },
};

export default function UserDetailPage() {
  const t = useTranslations('admin.settings.users');
  const tCommon = useTranslations('common');
  const params = useParams();
  const id = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await api.users.getUserById(id)) as unknown as UserDetail;
      setUser(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento utente');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ApiError message={error} onRetry={fetchUser} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <ApiError message="Utente non trovato" />
      </div>
    );
  }

  const roleConfig = roleLabels[user.role] || {
    label: user.role,
    className: 'bg-gray-500 text-white',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCog className="h-6 w-6" />
              {user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username}
            </h1>
            <p className="text-muted-foreground font-mono">@{user.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={roleConfig.className}>{roleConfig.label}</Badge>
          {user.is_active !== undefined && (
            <Badge variant={user.is_active ? 'default' : 'secondary'}>
              {user.is_active ? 'Attivo' : 'Inattivo'}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Dettagli Utente</CardTitle>
              <CardDescription>Informazioni account</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Username</p>
                <p className="font-mono font-medium">{user.username}</p>
              </div>
              {user.email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ruolo</p>
                  <p className="font-medium">{roleConfig.label}</p>
                </div>
              </div>
              {user.employee_id && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dipendente Collegato</p>
                  <Link
                    href={`/admin/employees/${user.employee_id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    Visualizza profilo dipendente
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {user.last_login && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Ultimo accesso</p>
                    <p>{new Date(user.last_login).toLocaleString('it-IT')}</p>
                  </div>
                </div>
              )}
              {user.created_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Creato</p>
                    <p>{new Date(user.created_at).toLocaleDateString('it-IT')}</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono text-xs break-all">{user.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
