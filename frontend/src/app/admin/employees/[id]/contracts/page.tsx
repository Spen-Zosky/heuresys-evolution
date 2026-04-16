'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  ArrowLeft,
  Plus,
  Download,
  Eye,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, apiClient } from '@/lib/api';
import type { Employee } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface Contract {
  id: string;
  type: 'permanent' | 'fixed_term' | 'internship' | 'apprenticeship' | 'consulting';
  status: 'active' | 'expired' | 'terminated' | 'pending';
  start_date: string;
  end_date?: string;
  renewal_date?: string;
  ccnl: string;
  level: string;
  hours_per_week: number;
  probation_end?: string;
  notes?: string;
  document_id?: string;
}

// No hardcoded data - fetched from API

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getTypeLabel = (type: Contract['type']): string => {
  const labels: Record<string, string> = {
    permanent: 'Tempo Indeterminato',
    fixed_term: 'Tempo Determinato',
    internship: 'Stage',
    apprenticeship: 'Apprendistato',
    consulting: 'Collaborazione',
  };
  return labels[type] || type;
};

const getStatusBadge = (status: Contract['status']) => {
  const variants = {
    active: {
      label: 'Attivo',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    expired: {
      label: 'Scaduto',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
    terminated: {
      label: 'Terminato',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    pending: {
      label: 'In Attesa',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
  };
  const variant = variants[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
};

const daysUntil = (dateString: string): number => {
  const date = new Date(dateString);
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function EmployeeContractsPage() {
  const t = useTranslations('admin.employees.contracts');
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [employeeData, contractsResp] = await Promise.all([
        api.employees.getEmployeeById(employeeId),
        apiClient
          .get<{
            success: boolean;
            data: Contract[];
          }>(`/api/v1/contracts?employee_id=${employeeId}`)
          .catch(() => ({ data: [] as Contract[] })),
      ]);
      setEmployee(employeeData);
      setContracts(contractsResp.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dipendente');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeContract = contracts.find((c) => c.status === 'active');
  const expiringContracts = contracts.filter(
    (c) =>
      c.end_date &&
      c.status === 'active' &&
      daysUntil(c.end_date) <= 90 &&
      daysUntil(c.end_date) > 0
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error || !employee) {
    return <ApiError message={error || 'Dipendente non trovato'} onRetry={fetchData} />;
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            onClick={() => router.push(`/admin/employees/${employeeId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Contratti
            </h1>
            <p className="text-muted-foreground">
              {employee.first_name} {employee.last_name}
            </p>
          </div>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Contratto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuovo Contratto</DialogTitle>
              <DialogDescription>
                Aggiungi un nuovo contratto per {employee.first_name} {employee.last_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo Contratto</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Tempo Indeterminato</SelectItem>
                      <SelectItem value="fixed_term">Tempo Determinato</SelectItem>
                      <SelectItem value="internship">Stage</SelectItem>
                      <SelectItem value="apprenticeship">Apprendistato</SelectItem>
                      <SelectItem value="consulting">Collaborazione</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CCNL</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona CCNL" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metalmeccanici">CCNL Metalmeccanici</SelectItem>
                      <SelectItem value="commercio">CCNL Commercio</SelectItem>
                      <SelectItem value="terziario">CCNL Terziario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Inizio</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Data Fine (se applicabile)</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Livello</Label>
                  <Input placeholder="es. Quadro A1" />
                </div>
                <div className="space-y-2">
                  <Label>Ore Settimanali</Label>
                  <Input type="number" placeholder="40" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Documento Contratto</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Trascina il PDF del contratto o clicca per selezionare
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setAddDialogOpen(false)}>Crea Contratto</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Active Contract Card */}
      {activeContract && (
        <motion.div variants={staggerItem}>
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Contratto Attivo
                </CardTitle>
                {getStatusBadge(activeContract.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium">{getTypeLabel(activeContract.type)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CCNL</p>
                  <p className="font-medium">{activeContract.ccnl}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Livello</p>
                  <p className="font-medium">{activeContract.level}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ore/Settimana</p>
                  <p className="font-medium">{activeContract.hours_per_week}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data Inizio</p>
                  <p className="font-medium">{formatDate(activeContract.start_date)}</p>
                </div>
                {activeContract.end_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Data Fine</p>
                    <p className="font-medium">{formatDate(activeContract.end_date)}</p>
                  </div>
                )}
              </div>
              {activeContract.document_id && (
                <div className="mt-4 pt-4 border-t flex gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizza Contratto
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Scarica PDF
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Expiring Alert */}
      {expiringContracts.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Contratto in scadenza
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-300">
                    Il contratto scade il {formatDate(expiringContracts[0].end_date!)}(
                    {daysUntil(expiringContracts[0].end_date!)} giorni)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Totale Contratti</span>
            </div>
            <p className="text-2xl font-bold">{contracts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Attivo</span>
            </div>
            <p className="text-2xl font-bold">
              {contracts.filter((c) => c.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Ore/Settimana</span>
            </div>
            <p className="text-2xl font-bold">{activeContract?.hours_per_week || 0}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Dal</span>
            </div>
            <p className="text-2xl font-bold">
              {activeContract ? formatDate(activeContract.start_date).split(' ')[2] : '-'}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Contracts History */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Storico Contratti</CardTitle>
            <CardDescription>Tutti i contratti passati e presenti</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>CCNL / Livello</TableHead>
                    <TableHead>Ore</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{getTypeLabel(contract.type)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDate(contract.start_date)}</p>
                          {contract.end_date && (
                            <p className="text-muted-foreground">
                              - {formatDate(contract.end_date)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{contract.ccnl}</p>
                          <p className="text-muted-foreground">{contract.level}</p>
                        </div>
                      </TableCell>
                      <TableCell>{contract.hours_per_week}h/sett</TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More options">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizza
                            </DropdownMenuItem>
                            {contract.document_id && (
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Scarica PDF
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
