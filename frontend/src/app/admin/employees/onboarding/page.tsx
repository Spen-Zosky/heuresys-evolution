'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  UserPlus,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  User,
  Building2,
  Eye,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface OnboardingTask {
  id: string;
  name: string;
  category: 'hr' | 'it' | 'manager' | 'employee';
  completed: boolean;
  due_date?: string;
  assigned_to?: string;
}

interface OnboardingEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  department_name: string;
  hire_date: string;
  start_date: string;
  onboarding_status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  tasks: OnboardingTask[];
  buddy_name?: string;
  manager_name?: string;
}

// ============================================
// (data fetched from API)
// ============================================

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

const getStatusBadge = (status: OnboardingEmployee['onboarding_status']) => {
  const variants = {
    pending: {
      label: 'In Attesa',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      icon: Clock,
    },
    in_progress: {
      label: 'In Corso',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      icon: Clock,
    },
    completed: {
      label: 'Completato',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: CheckCircle,
    },
    overdue: {
      label: 'In Ritardo',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      icon: AlertCircle,
    },
  };
  const { label, className, icon: Icon } = variants[status];
  return (
    <Badge variant="outline" className={`${className} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

const getCategoryColor = (category: OnboardingTask['category']): string => {
  const colors = {
    hr: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    it: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    manager: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    employee: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };
  return colors[category];
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function OnboardingDashboardPage() {
  const t = useTranslations('admin.employees.onboarding');
  const [employees, setEmployees] = useState<OnboardingEmployee[]>([]);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await apiClient
          .get<{
            success: boolean;
            data: OnboardingEmployee[];
          }>('/api/v1/employees?employment_status=onboarding')
          .catch(() => ({ data: null }));
        if (resp?.data) {
          setEmployees(Array.isArray(resp.data) ? resp.data : []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore nel caricamento dati onboarding');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<OnboardingEmployee | null>(null);

  const stats = useMemo(
    () => ({
      total: employees.length,
      pending: employees.filter((e) => e.onboarding_status === 'pending').length,
      in_progress: employees.filter((e) => e.onboarding_status === 'in_progress').length,
      completed: employees.filter((e) => e.onboarding_status === 'completed').length,
      overdue: employees.filter((e) => e.onboarding_status === 'overdue').length,
    }),
    [employees]
  );

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      !searchInput ||
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchInput.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchInput.toLowerCase());
    const matchesStatus = statusFilter === 'all' || emp.onboarding_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleTask = (employeeId: string, taskId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === employeeId) {
          const updatedTasks = emp.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          );
          const completedCount = updatedTasks.filter((t) => t.completed).length;
          const newStatus: OnboardingEmployee['onboarding_status'] =
            completedCount === updatedTasks.length
              ? 'completed'
              : completedCount > 0
                ? 'in_progress'
                : emp.onboarding_status;
          return { ...emp, tasks: updatedTasks, onboarding_status: newStatus };
        }
        return emp;
      })
    );
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
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-6 w-6" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Aggiorna dati">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Totale</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">In Attesa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
            <p className="text-sm text-muted-foreground">In Corso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Completati</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-sm text-muted-foreground">In Ritardo</p>
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
                  placeholder="Cerca dipendente..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="pending">In Attesa</SelectItem>
                  <SelectItem value="in_progress">In Corso</SelectItem>
                  <SelectItem value="completed">Completati</SelectItem>
                  <SelectItem value="overdue">In Ritardo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Employee List */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nuovi Assunti ({filteredEmployees.length})</CardTitle>
              <CardDescription>Dipendenti in fase di onboarding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredEmployees.map((emp) => {
                  const completedTasks = emp.tasks.filter((t) => t.completed).length;
                  const progress = (completedTasks / emp.tasks.length) * 100;

                  return (
                    <div
                      key={emp.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedEmployee?.id === emp.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedEmployee(emp)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {emp.first_name[0]}
                            {emp.last_name[0]}
                          </div>
                          <div>
                            <p className="font-medium">
                              {emp.first_name} {emp.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{emp.job_title}</p>
                          </div>
                        </div>
                        {getStatusBadge(emp.onboarding_status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {emp.department_name}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Inizio: {formatDate(emp.start_date)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progresso</span>
                          <span>
                            {completedTasks}/{emp.tasks.length} task
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Task Details */}
        <motion.div variants={staggerItem}>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedEmployee ? 'Checklist Onboarding' : 'Seleziona Dipendente'}
              </CardTitle>
              {selectedEmployee && (
                <CardDescription>
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedEmployee ? (
                <div className="space-y-4">
                  {/* Info */}
                  <div className="space-y-2 text-sm">
                    {selectedEmployee.manager_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Manager:</span>
                        <span>{selectedEmployee.manager_name}</span>
                      </div>
                    )}
                    {selectedEmployee.buddy_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Buddy:</span>
                        <span>{selectedEmployee.buddy_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2">
                    {selectedEmployee.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          task.completed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-muted/30'
                        }`}
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => toggleTask(selectedEmployee.id, task.id)}
                        />
                        <div className="flex-1">
                          <p
                            className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                          >
                            {task.name}
                          </p>
                          {task.due_date && !task.completed && (
                            <p className="text-xs text-muted-foreground">
                              Scadenza: {formatDate(task.due_date)}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getCategoryColor(task.category)}`}
                        >
                          {task.category.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Mail className="h-4 w-4 mr-2" />
                      Invia Email
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/employees/${selectedEmployee.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    Seleziona un dipendente dalla lista per vedere i dettagli dell&apos;onboarding
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
