'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { motion } from 'framer-motion';
import {
  FileText,
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  Eye,
  FolderOpen,
  File,
  FileSpreadsheet,
  FileImage,
  MoreHorizontal,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import type { Employee, EmployeeDocument as ApiDocument } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface EmployeeDocument {
  id: string;
  name: string;
  category: 'contract' | 'id' | 'certificate' | 'review' | 'other';
  file_type: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
  expiry_date?: string;
  description?: string;
}

// ============================================
// ADAPTERS: Map API response to local types
// ============================================

function mapApiDocToLocal(apiDoc: ApiDocument): EmployeeDocument {
  const categoryMap: Record<string, EmployeeDocument['category']> = {
    contract: 'contract',
    contratto: 'contract',
    identity: 'id',
    id_document: 'id',
    certificate: 'certificate',
    certificato: 'certificate',
    review: 'review',
    valutazione: 'review',
  };
  return {
    id: apiDoc.id,
    name: apiDoc.file_name || apiDoc.title,
    category: categoryMap[apiDoc.document_type || ''] || 'other',
    file_type: apiDoc.mime_type || 'application/octet-stream',
    file_size: apiDoc.file_size || 0,
    uploaded_at: apiDoc.created_at,
    uploaded_by: apiDoc.issued_by || '',
    expiry_date: apiDoc.expiry_date,
    description: apiDoc.description,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return <File className="h-5 w-5 text-red-500" />;
  if (fileType.includes('spreadsheet') || fileType.includes('excel'))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (fileType.includes('image')) return <FileImage className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-gray-500" />;
};

const getCategoryBadge = (category: EmployeeDocument['category']) => {
  const variants: Record<EmployeeDocument['category'], { label: string; className: string }> = {
    contract: {
      label: 'Contratto',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    id: {
      label: 'Identità',
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    certificate: {
      label: 'Certificato',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    review: {
      label: 'Valutazione',
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    },
    other: {
      label: 'Altro',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
  };
  const { label, className } = variants[category];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function EmployeeDocumentsPage() {
  const t = useTranslations('admin.employees.documents');
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [employeeData, docsData] = await Promise.all([
        api.employees.getEmployeeById(employeeId),
        api.documents.getEmployeeDocuments(employeeId).catch(() => [] as ApiDocument[]),
      ]);
      setEmployee(employeeData);
      setDocuments(docsData.map(mapApiDocToLocal));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dipendente');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !searchInput ||
      doc.name.toLowerCase().includes(searchInput.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchInput.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Eliminare il documento "${name}"?`)) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
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
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {employee.first_name} {employee.last_name}
            </p>
          </div>
        </div>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Carica Documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Carica Documento</DialogTitle>
              <DialogDescription>
                Seleziona un file da caricare per {employee.first_name} {employee.last_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select defaultValue="other">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Contratto</SelectItem>
                    <SelectItem value="id">Documento Identità</SelectItem>
                    <SelectItem value="certificate">Certificato</SelectItem>
                    <SelectItem value="review">Valutazione</SelectItem>
                    <SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Input placeholder="Descrizione del documento..." />
              </div>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Trascina qui il file o clicca per selezionare
                </p>
                <Button variant="secondary" size="sm">
                  Sfoglia File
                </Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setUploadDialogOpen(false)}>Carica</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-sm text-muted-foreground">Totale Documenti</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {documents.filter((d) => d.category === 'contract').length}
            </div>
            <p className="text-sm text-muted-foreground">Contratti</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {
                documents.filter(
                  (d) =>
                    d.expiry_date &&
                    new Date(d.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                ).length
              }
            </div>
            <p className="text-sm text-muted-foreground">In Scadenza</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {formatFileSize(documents.reduce((sum, d) => sum + d.file_size, 0))}
            </div>
            <p className="text-sm text-muted-foreground">Spazio Usato</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca documenti..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  <SelectItem value="contract">Contratti</SelectItem>
                  <SelectItem value="id">Identità</SelectItem>
                  <SelectItem value="certificate">Certificati</SelectItem>
                  <SelectItem value="review">Valutazioni</SelectItem>
                  <SelectItem value="other">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Documents Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documenti ({filteredDocuments.length})</CardTitle>
            <CardDescription>Elenco dei documenti del dipendente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome File</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Dimensione</TableHead>
                    <TableHead>Caricato</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nessun documento trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getFileIcon(doc.file_type)}
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              {doc.description && (
                                <p className="text-xs text-muted-foreground">{doc.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryBadge(doc.category)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFileSize(doc.file_size)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDate(doc.uploaded_at)}</p>
                            <p className="text-xs text-muted-foreground">{doc.uploaded_by}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.expiry_date ? (
                            <Badge
                              variant={
                                new Date(doc.expiry_date) < new Date() ? 'destructive' : 'outline'
                              }
                            >
                              {formatDate(doc.expiry_date)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
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
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Scarica
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(doc.id, doc.name)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
