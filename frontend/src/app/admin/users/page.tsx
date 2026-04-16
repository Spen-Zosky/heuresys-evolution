'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  UserCog,
  Search,
  RefreshCw,
  AlertCircle,
  Plus,
  Shield,
  Mail,
  Clock,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

interface UserRecord {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  last_login_at?: string;
  [key: string]: unknown;
}

const roleBadge: Record<string, string> = {
  SUPERUSER: 'bg-red-100 text-red-800',
  TENANT_OWNER: 'bg-red-100 text-red-800',
  ADMIN: 'bg-purple-100 text-purple-800',
  HR: 'bg-blue-100 text-blue-800',
  USER: 'bg-gray-100 text-gray-800',
  DEMO: 'bg-yellow-100 text-yellow-800',
};

export default function UsersPage() {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [formData, setFormData] = useState({ username: '', email: '', role: 'USER' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Record<string, unknown>>('/api/v1/users');
      const inner = (data as Record<string, unknown>).data;
      const list = Array.isArray(inner)
        ? inner
        : (inner as Record<string, unknown>)?.users
          ? ((inner as Record<string, unknown>).users as UserRecord[])
          : Array.isArray((inner as Record<string, unknown>)?.items)
            ? ((inner as Record<string, unknown>).items as UserRecord[])
            : [];
      setUsers(list as UserRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento utenti');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditUser(null);
    setFormData({ username: '', email: '', role: 'USER' });
    setShowDialog(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditUser(user);
    setFormData({ username: user.username, email: user.email || '', role: user.role || 'USER' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editUser) {
        await apiClient.put(`/api/v1/users/${editUser.id}`, formData);
      } else {
        await apiClient.post('/api/v1/users', formData);
      }
      setShowDialog(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo utente?')) return;
    try {
      await apiClient.delete(`/api/v1/users/${id}`);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nell'eliminazione");
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UserCog className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newUser')}
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tCommon('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchUsers} aria-label="Aggiorna utenti">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">{tCommon('loading')}</div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={fetchUsers}>
                  {tCommon('retry')}
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{tCommon('noResults')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.username')}</TableHead>
                    <TableHead>{t('fields.name')}</TableHead>
                    <TableHead>{t('fields.email')}</TableHead>
                    <TableHead>{t('fields.role')}</TableHead>
                    <TableHead>{t('fields.status')}</TableHead>
                    <TableHead>{t('fields.lastLogin')}</TableHead>
                    <TableHead className="text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>
                        {u.first_name || u.last_name
                          ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {u.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {u.email}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={roleBadge[u.role || ''] || 'bg-gray-100 text-gray-800'}>
                          <Shield className="h-3 w-3 mr-1" />
                          {u.role || 'n/a'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_active !== false ? 'default' : 'secondary'}>
                          {u.is_active !== false ? 'Attivo' : 'Inattivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.last_login_at ? (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(u.last_login_at).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Mai</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete"
                            className="h-8 w-8"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(u.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? t('editUser') : t('newUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dlg-username">Username</Label>
              <Input
                id="dlg-username"
                value={formData.username}
                onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                disabled={!!editUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dlg-email">Email</Label>
              <Input
                id="dlg-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ruolo</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData((p) => ({ ...p, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPERUSER">Superuser</SelectItem>
                  <SelectItem value="TENANT_OWNER">Sysadmin</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="DEMO">Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
