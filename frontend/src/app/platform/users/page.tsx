'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  UserCog,
  RefreshCw,
  AlertCircle,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  UserPlus,
  Ban,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface UserRow {
  id: string;
  username: string;
  email?: string;
  role: string;
  firstName?: string;
  lastName?: string;
  tenantId?: string;
  tenantName?: string;
  isActive?: boolean;
  lastLogin?: string;
}

type SortBy = 'username' | 'first_name' | 'role' | 'last_login';
type SortOrder = 'asc' | 'desc';

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

const ROLE_OPTIONS = ['SUPERUSER', 'TENANT_OWNER', 'HR', 'USER', 'DEMO'] as const;

function PlatformUsersContent() {
  const t = useTranslations('platform');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('is_active') || '');
  const [sortBy, setSortBy] = useState<SortBy>(
    (searchParams.get('sort_by') as SortBy) || 'username'
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (searchParams.get('sort_order') as SortOrder) || 'asc'
  );

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Invite user dialog
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    username: '',
    email: '',
    role: 'USER',
    tenant_id: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    success: boolean;
    temporaryPassword?: string;
    error?: string;
  } | null>(null);
  const [tenants, setTenants] = useState<{ id: string; name: string; code: string }[]>([]);

  const updateUrl = useCallback(
    (overrides: Record<string, string | number>) => {
      const params = new URLSearchParams();
      const merged = {
        search,
        page: String(page),
        role: roleFilter,
        is_active: activeFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
      };
      for (const [key, value] of Object.entries(merged)) {
        if (
          value &&
          value !== '' &&
          !(key === 'page' && value === '1') &&
          !(key === 'sort_by' && value === 'username') &&
          !(key === 'sort_order' && value === 'asc')
        ) {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [search, page, roleFilter, activeFilter, sortBy, sortOrder, pathname, router]
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (activeFilter) params.is_active = activeFilter;
      if (sortBy) params.sort_by = sortBy;
      if (sortOrder) params.sort_order = sortOrder;

      const result = await api.users.getUsers(params);
      const data = result as unknown as Record<string, unknown>;
      const userList = data.users || data.items || (Array.isArray(result) ? result : []);
      setUsers(userList as unknown as UserRow[]);
      const meta = data.meta as Record<string, unknown> | undefined;
      setTotalPages(
        (meta?.totalPages as number) ||
          ((data.pagination as Record<string, unknown>)?.totalPages as number) ||
          1
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento utenti');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, activeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Clear selection when users change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [users]);

  // Fetch tenants for invite form
  const fetchTenants = useCallback(async () => {
    try {
      const result = await api.users.getAvailableTenants();
      const list = Array.isArray(result) ? result : [];
      setTenants(
        list.map((t: Record<string, unknown>) => ({
          id: String(t.id || ''),
          name: String(t.name || ''),
          code: String(t.code || ''),
        }))
      );
    } catch {
      // Silently fail — tenants dropdown will be empty
    }
  }, []);

  const handleSort = (column: SortBy) => {
    let newOrder: SortOrder = 'asc';
    if (sortBy === column) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(column);
    setSortOrder(newOrder);
    setPage(1);
    updateUrl({ sort_by: column, sort_order: newOrder, page: 1 });
  };

  const renderSortIcon = (column: SortBy) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const SortableHead = ({ column, children }: { column: SortBy; children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        className="flex items-center gap-0 hover:text-foreground transition-colors font-medium"
        onClick={() => handleSort(column)}
      >
        {children}
        {renderSortIcon(column)}
      </button>
    </TableHead>
  );

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  // Bulk disable
  const handleBulkDisable = async () => {
    setBulkLoading(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        api.users.updateUser(id, { is_active: false })
      );
      await Promise.all(promises);
      setShowBulkConfirm(false);
      setSelectedIds(new Set());
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella disabilitazione bulk');
    } finally {
      setBulkLoading(false);
    }
  };

  // Invite user
  const handleInvite = async () => {
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const payload: Record<string, unknown> = {
        username: inviteForm.username,
        role: inviteForm.role,
        generate_password: true,
        is_active: true,
      };
      // employee_id not required for TENANT_OWNER/SUPERUSER/DEMO roles
      // For other roles, we'd need to link an employee — simplified for platform admin
      const result = await api.users.createUser(payload);
      const data = result as Record<string, unknown>;
      setInviteResult({
        success: true,
        temporaryPassword: data.temporaryPassword as string | undefined,
      });
      await fetchUsers();
    } catch (err) {
      setInviteResult({
        success: false,
        error: err instanceof Error ? err.message : 'Errore nella creazione utente',
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const openInviteDialog = () => {
    setInviteForm({ username: '', email: '', role: 'USER', tenant_id: '' });
    setInviteResult(null);
    setShowInvite(true);
    fetchTenants();
  };

  const closeInviteDialog = () => {
    setShowInvite(false);
    setInviteResult(null);
  };

  const exportCSV = () => {
    const headers = ['Username', 'Nome', 'Ruolo', 'Tenant', 'Stato', 'Ultimo Accesso'];
    const rows = users.map((user) => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const active = user.isActive ?? true;
      const lastLogin = user.lastLogin
        ? new Date(user.lastLogin).toLocaleDateString('it-IT')
        : 'Mai';
      return [
        user.username,
        fullName || '-',
        user.role,
        user.tenantName || '-',
        active ? 'Attivo' : 'Inattivo',
        lastLogin,
      ];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'utenti-piattaforma.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (error && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">{error}</p>
            <Button onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            Utenti Sistema
          </h1>
          <p className="text-muted-foreground mt-1">{t('users.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkConfirm(true)}>
              <Ban className="h-4 w-4 mr-1" />
              Disabilita ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" onClick={openInviteDialog}>
            <UserPlus className="h-4 w-4 mr-1" />
            Invita Utente
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={users.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="icon" onClick={fetchUsers} title={t('common.refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Search + Filters row */}
      <motion.div variants={staggerItem}>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                updateUrl({ search: e.target.value, page: 1 });
              }}
              placeholder="Cerca utenti..."
              className="pl-9"
            />
          </div>

          <Select
            value={roleFilter || '_all'}
            onValueChange={(value) => {
              const v = value === '_all' ? '' : value;
              setRoleFilter(v);
              setPage(1);
              updateUrl({ role: v, page: 1 });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Ruolo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tutti i ruoli</SelectItem>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={activeFilter || '_all'}
            onValueChange={(value) => {
              const v = value === '_all' ? '' : value;
              setActiveFilter(v);
              setPage(1);
              updateUrl({ is_active: v, page: 1 });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tutti</SelectItem>
              <SelectItem value="true">Attivi</SelectItem>
              <SelectItem value="false">Inattivi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={users.length > 0 && selectedIds.size === users.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Seleziona tutti"
                      />
                    </TableHead>
                    <SortableHead column="username">Username</SortableHead>
                    <SortableHead column="first_name">Nome</SortableHead>
                    <SortableHead column="role">Ruolo</SortableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Stato</TableHead>
                    <SortableHead column="last_login">Ultimo Accesso</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    const active = user.isActive ?? true;
                    const lastLogin = user.lastLogin;
                    return (
                      <TableRow
                        key={user.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/platform/users/${user.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            aria-label={`Seleziona ${user.username}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{fullName || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={roleColors[user.role] || 'outline'}>{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {user.tenantName || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={active ? 'default' : 'secondary'}>
                            {active ? 'Attivo' : 'Inattivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lastLogin ? new Date(lastLogin).toLocaleDateString('it-IT') : 'Mai'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <UserCog className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Nessun utente trovato
                          </p>
                          <p className="text-xs text-muted-foreground/70 max-w-sm">
                            Non ci sono utenti che corrispondono ai filtri selezionati. Prova a
                            modificare la ricerca o i criteri di filtro.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div variants={staggerItem} className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              const p = page - 1;
              setPage(p);
              updateUrl({ page: p });
            }}
          >
            Precedente
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} di {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              const p = page + 1;
              setPage(p);
              updateUrl({ page: p });
            }}
          >
            Successiva
          </Button>
        </motion.div>
      )}

      {/* Bulk Disable Confirmation Dialog */}
      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma disabilitazione</DialogTitle>
            <DialogDescription>
              Stai per disabilitare {selectedIds.size} utent{selectedIds.size === 1 ? 'e' : 'i'}.
              Gli utenti disabilitati non potranno effettuare il login. Confermi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkConfirm(false)}
              disabled={bulkLoading}
            >
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleBulkDisable} disabled={bulkLoading}>
              {bulkLoading ? 'Disabilitazione...' : `Disabilita ${selectedIds.size} utenti`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog
        open={showInvite}
        onOpenChange={(open) => {
          if (!open) closeInviteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invita Utente</DialogTitle>
            <DialogDescription>
              Crea un nuovo utente di piattaforma. Verrà generata una password temporanea.
            </DialogDescription>
          </DialogHeader>

          {inviteResult?.success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 space-y-2">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Utente creato con successo!
                </p>
                {inviteResult.temporaryPassword && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Password temporanea:</p>
                    <code className="block text-sm font-mono bg-background border rounded px-3 py-2 select-all">
                      {inviteResult.temporaryPassword}
                    </code>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Copia questa password ora. Non sarà più visibile dopo la chiusura.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={closeInviteDialog}>Chiudi</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inv-username">Username *</Label>
                <Input
                  id="inv-username"
                  value={inviteForm.username}
                  onChange={(e) => setInviteForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="es. mario.rossi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-role">Ruolo *</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) => setInviteForm((p) => ({ ...p, role: value }))}
                >
                  <SelectTrigger id="inv-role">
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
              <div className="space-y-2">
                <Label htmlFor="inv-tenant">Tenant</Label>
                <Select
                  value={inviteForm.tenant_id || '_none'}
                  onValueChange={(value) =>
                    setInviteForm((p) => ({ ...p, tenant_id: value === '_none' ? '' : value }))
                  }
                >
                  <SelectTrigger id="inv-tenant">
                    <SelectValue placeholder="Nessun tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nessun tenant</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {inviteResult?.error && (
                <p className="text-sm text-destructive">{inviteResult.error}</p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={closeInviteDialog} disabled={inviteLoading}>
                  Annulla
                </Button>
                <Button onClick={handleInvite} disabled={inviteLoading || !inviteForm.username}>
                  {inviteLoading ? 'Creazione...' : 'Crea Utente'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default function PlatformUsersPage() {
  const t = useTranslations('platform');
  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      }
    >
      <PlatformUsersContent />
    </Suspense>
  );
}
