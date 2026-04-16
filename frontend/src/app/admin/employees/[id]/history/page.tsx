'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  History,
  ArrowLeft,
  Briefcase,
  MapPin,
  TrendingUp,
  Award,
  Calendar,
  User,
  DollarSign,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { Employee } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface CareerEvent {
  id: string;
  type:
    | 'hire'
    | 'promotion'
    | 'transfer'
    | 'role_change'
    | 'salary_change'
    | 'training'
    | 'award'
    | 'leave';
  title: string;
  description: string;
  date: string;
  details?: Record<string, string>;
}

// Career events fetched from API - no hardcoded data

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const getEventIcon = (type: CareerEvent['type']) => {
  const icons = {
    hire: <Briefcase className="h-5 w-5" />,
    promotion: <TrendingUp className="h-5 w-5" />,
    transfer: <MapPin className="h-5 w-5" />,
    role_change: <User className="h-5 w-5" />,
    salary_change: <DollarSign className="h-5 w-5" />,
    training: <GraduationCap className="h-5 w-5" />,
    award: <Award className="h-5 w-5" />,
    leave: <Calendar className="h-5 w-5" />,
  };
  return icons[type];
};

const getEventColor = (type: CareerEvent['type']): string => {
  const colors = {
    hire: 'bg-blue-500',
    promotion: 'bg-green-500',
    transfer: 'bg-purple-500',
    role_change: 'bg-orange-500',
    salary_change: 'bg-emerald-500',
    training: 'bg-cyan-500',
    award: 'bg-yellow-500',
    leave: 'bg-gray-500',
  };
  return colors[type];
};

const getEventLabel = (type: CareerEvent['type']): string => {
  const labels = {
    hire: 'Assunzione',
    promotion: 'Promozione',
    transfer: 'Trasferimento',
    role_change: 'Cambio Ruolo',
    salary_change: 'Revisione Salariale',
    training: 'Formazione',
    award: 'Riconoscimento',
    leave: 'Congedo',
  };
  return labels[type];
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function EmployeeHistoryPage() {
  const t = useTranslations('admin.employees.history');
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [events, setEvents] = useState<CareerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [empData, eventsResp] = await Promise.allSettled([
        api.employees.getEmployeeById(employeeId),
        import('@/lib/api').then(({ apiClient }) =>
          apiClient
            .get<{ data: CareerEvent[] }>(`/api/v1/career-history/${employeeId}`)
            .catch(() => ({ data: [] }))
        ),
      ]);

      if (empData.status === 'fulfilled') {
        setEmployee(empData.value);
      } else {
        throw empData.reason;
      }

      if (eventsResp.status === 'fulfilled') {
        const evData = eventsResp.value?.data;
        setEvents(Array.isArray(evData) ? evData : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dipendente');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const filteredEvents = events
    .filter((e) => typeFilter === 'all' || e.type === typeFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate tenure
  const tenure = employee
    ? (() => {
        const hire = new Date(employee.hire_date);
        const now = new Date();
        const years = Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365));
        const months = Math.floor(
          ((now.getTime() - hire.getTime()) % (1000 * 60 * 60 * 24 * 365)) /
            (1000 * 60 * 60 * 24 * 30)
        );
        return { years, months };
      })()
    : { years: 0, months: 0 };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (error || !employee) {
    return <ApiError message={error || 'Dipendente non trovato'} onRetry={fetchEmployee} />;
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
              <History className="h-6 w-6" />
              Storico Carriera
            </h1>
            <p className="text-muted-foreground">
              {employee.first_name} {employee.last_name}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Anzianita</span>
            </div>
            <p className="text-2xl font-bold">
              {tenure.years}a {tenure.months}m
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Promozioni</span>
            </div>
            <p className="text-2xl font-bold">
              {events.filter((e) => e.type === 'promotion').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <GraduationCap className="h-4 w-4" />
              <span className="text-sm">Formazioni</span>
            </div>
            <p className="text-2xl font-bold">
              {events.filter((e) => e.type === 'training').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Award className="h-4 w-4" />
              <span className="text-sm">Riconoscimenti</span>
            </div>
            <p className="text-2xl font-bold">{events.filter((e) => e.type === 'award').length}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filter */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardContent className="pt-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtra per tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli eventi</SelectItem>
                <SelectItem value="hire">Assunzione</SelectItem>
                <SelectItem value="promotion">Promozioni</SelectItem>
                <SelectItem value="transfer">Trasferimenti</SelectItem>
                <SelectItem value="role_change">Cambio Ruolo</SelectItem>
                <SelectItem value="salary_change">Revisioni Salariali</SelectItem>
                <SelectItem value="training">Formazione</SelectItem>
                <SelectItem value="award">Riconoscimenti</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </motion.div>

      {/* Timeline */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timeline ({filteredEvents.length} eventi)</CardTitle>
            <CardDescription>Cronologia degli eventi di carriera</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessun evento di carriera trovato.
              </p>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-6">
                  {filteredEvents.map((event) => (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div
                        className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${getEventColor(event.type)} text-white shadow-lg`}
                      >
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="outline">{getEventLabel(event.type)}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(event.date)}
                          </span>
                        </div>
                        <h4 className="font-semibold">{event.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                        {event.details && (
                          <div className="bg-muted/50 rounded-lg p-3 text-sm">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {Object.entries(event.details).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-muted-foreground">{key}:</span>{' '}
                                  <span className="font-medium">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
