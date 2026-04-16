'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { OrgUnitsView } from './_components/org-units-view';

export default function OrgUnitsPage() {
  const t = useTranslations('admin.orgUnits');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.orgUnits.deleteOrgUnit(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Errore eliminazione');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <OrgUnitsView
        headerActions={
          <Link href="/admin/org-units/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('newUnit')}
            </Button>
          </Link>
        }
        renderRowActions={(unit: OrgUnit) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/org-units/${unit.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  {tCommon('view')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/admin/org-units/${unit.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {tCommon('edit')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteTarget({ id: unit.id, name: unit.name })}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tCommon('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommon('confirmDelete')}</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare &quot;{deleteTarget?.name}&quot;? Questa azione non può
              essere annullata.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? tCommon('deleting') : tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
