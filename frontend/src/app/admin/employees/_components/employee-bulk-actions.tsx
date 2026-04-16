'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Send, UserCheck, UserX, Trash2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Employee } from '@/lib/api/types';

type BulkActionType = 'deactivate' | 'activate' | 'delete' | 'export' | 'email';

interface EmployeeBulkActionsProps {
  selectedIds: Set<string>;
  employees: Employee[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

export function EmployeeBulkActions({
  selectedIds,
  employees,
  onClearSelection,
  onRefresh,
}: EmployeeBulkActionsProps) {
  const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  const handleBulkAction = useCallback((action: BulkActionType) => {
    setBulkAction(action);
    setShowBulkDialog(true);
  }, []);

  const getBulkActionDetails = useCallback(() => {
    const count = selectedIds.size;
    switch (bulkAction) {
      case 'deactivate':
        return {
          title: 'Disattiva Dipendenti',
          description: `Sei sicuro di voler disattivare ${count} dipendente${count > 1 ? 'i' : ''}? I dipendenti disattivati non potranno accedere al sistema.`,
          confirmText: 'Disattiva',
          destructive: true,
        };
      case 'activate':
        return {
          title: 'Attiva Dipendenti',
          description: `Sei sicuro di voler riattivare ${count} dipendente${count > 1 ? 'i' : ''}?`,
          confirmText: 'Attiva',
          destructive: false,
        };
      case 'delete':
        return {
          title: 'Elimina Dipendenti',
          description: `Sei sicuro di voler eliminare definitivamente ${count} dipendente${count > 1 ? 'i' : ''}? Questa azione non puo essere annullata.`,
          confirmText: 'Elimina',
          destructive: true,
        };
      case 'export':
        return {
          title: 'Esporta Dipendenti',
          description: `Esportare i dati di ${count} dipendente${count > 1 ? 'i' : ''} in formato CSV?`,
          confirmText: 'Esporta',
          destructive: false,
        };
      case 'email':
        return {
          title: 'Invia Email',
          description: `Inviare un'email a ${count} dipendente${count > 1 ? 'i' : ''}?`,
          confirmText: 'Invia',
          destructive: false,
        };
      default:
        return { title: '', description: '', confirmText: '', destructive: false };
    }
  }, [bulkAction, selectedIds.size]);

  const executeBulkAction = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      switch (bulkAction) {
        case 'export': {
          const selectedEmployees = employees.filter((e) => selectedIds.has(e.id));
          const csv = [
            ['Nome', 'Cognome', 'Email', 'Ruolo', 'Dipartimento', 'Sede', 'Stato'].join(','),
            ...selectedEmployees.map((e) =>
              [
                e.first_name,
                e.last_name,
                e.email,
                e.job_title,
                e.department_name,
                e.location_name,
                e.is_active ? 'Attivo' : 'Inattivo',
              ].join(',')
            ),
          ].join('\n');

          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `dipendenti_export_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
        case 'deactivate':
        case 'activate':
        case 'delete':
        case 'email':
          await new Promise((resolve) => setTimeout(resolve, 1000));
          break;
      }

      setShowBulkDialog(false);
      setBulkAction(null);
      onClearSelection();

      if (bulkAction !== 'export' && bulkAction !== 'email') {
        onRefresh();
      }
    } catch (err) {
      console.error('Bulk action failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  }, [bulkAction, selectedIds, employees, onClearSelection, onRefresh]);

  return (
    <>
      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50"
          >
            <Card className="shadow-lg border-primary/20">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="font-mono">
                      {selectedIds.size}
                    </Badge>
                    <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                      selezionat{selectedIds.size > 1 ? 'i' : 'o'}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('export')}>
                      <Download className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Esporta</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('email')}>
                      <Send className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Email</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('activate')}
                    >
                      <UserCheck className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Attiva</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('deactivate')}
                    >
                      <UserX className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Disattiva</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleBulkAction('delete')}
                    >
                      <Trash2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Elimina</span>
                    </Button>
                  </div>
                  <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
                  <Button size="sm" variant="ghost" onClick={onClearSelection} className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getBulkActionDetails().title}</DialogTitle>
            <DialogDescription>{getBulkActionDetails().description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDialog(false)}
              disabled={bulkActionLoading}
            >
              Annulla
            </Button>
            <Button
              variant={getBulkActionDetails().destructive ? 'destructive' : 'default'}
              onClick={executeBulkAction}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Elaborazione...
                </>
              ) : (
                getBulkActionDetails().confirmText
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
